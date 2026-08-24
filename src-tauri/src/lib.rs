use std::sync::Mutex;
use std::sync::PoisonError;

use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};
// Every `PredefinedMenuItem` still referenced by name lives in the macOS-only
// menu; the Linux/Windows menu reaches its supported predefines through
// `SubmenuBuilder`'s `cut()`/`copy()`/`paste()`/`select_all()` helpers.
#[cfg(target_os = "macos")]
use tauri::menu::PredefinedMenuItem;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_fs::FsExt;

/// Name of the event emitted (from Rust to the frontend) to signal that a
/// new pending file path is available to be drained via
/// `take_pending_file_open`. On a cold launch this event can be emitted
/// before the webview's listener is registered, and a dropped emit is
/// exactly the bug this exists to fix — the frontend therefore also drains
/// once on mount to cover that race. See `PendingFileOpen`.
///
/// Only the `RunEvent::Opened` platforms emit this. The argv route used
/// everywhere else runs during `setup`, before any webview exists, and is
/// picked up solely by that cold-start drain — see `handle_cli_file_open`.
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
const FILE_OPENED_EVENT: &str = "file-opened";

/// Events emitted to the webview when the corresponding native menu item is
/// chosen. These go through `Window::emit` (and `listen()` on the frontend)
/// rather than `Window::eval` with a `dispatchEvent` source string: the
/// payload is then serialized and type-checked by Tauri instead of being
/// injected as JavaScript source, and emit failures surface as an `Err`.
const MENU_ABOUT_EVENT: &str = "menu-about";
const MENU_SETTINGS_EVENT: &str = "menu-settings";

/// Id of the custom Quit item used off macOS. Handled directly in
/// `on_menu_event` rather than emitted to the webview — quitting is a
/// Rust-side concern and there is nothing for the frontend to do with it.
#[cfg(not(target_os = "macos"))]
const MENU_QUIT_ID: &str = "quit";

/// Holds the most recently opened-from-Finder file path until the frontend
/// drains it via `take_pending_file_open`. `Mutex::take` (via `Option::take`)
/// makes the drain atomic, so a path delivered through the cold-start drain
/// and a path delivered through the `file-opened` event can never both be
/// processed — whichever call reaches the mutex first empties it for the
/// other.
struct PendingFileOpen(Mutex<Option<String>>);

#[tauri::command]
fn take_pending_file_open(state: tauri::State<'_, PendingFileOpen>) -> Option<String> {
    state
        .0
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .take()
}

/// Grants the fs plugin's scope read access to `path` and buffers it for the
/// frontend to drain via `take_pending_file_open`.
///
/// Shared by both file-association routes - `RunEvent::Opened` on macOS/iOS/Android
/// and the argv route everywhere else - which differ only in how they discover
/// the path, not in what they do with it. Deliberately carries no `cfg`: the two
/// callers' cfgs are complementary and exhaustive, so exactly one of them exists
/// on any target and this is never dead code.
fn buffer_pending_file(app_handle: &AppHandle, path: String) {
    if let Some(scope) = app_handle.try_fs_scope() {
        let _ = scope.allow_file(&path);
    }

    if let Some(state) = app_handle.try_state::<PendingFileOpen>() {
        *state.0.lock().unwrap_or_else(PoisonError::into_inner) = Some(path);
    }
}

/// Converts the `file://` URLs from `RunEvent::Opened` into a usable path,
/// grants the fs plugin's scope read access to it (mirroring the drag-drop
/// precedent in `tauri-plugin-fs`), and buffers it for the frontend to pick
/// up either via the cold-start drain or the `file-opened` event.
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
fn handle_opened_urls(app_handle: &AppHandle, urls: Vec<tauri::Url>) {
    let Some(path) = urls.into_iter().find_map(|url| url.to_file_path().ok()) else {
        return;
    };
    let Some(path_str) = path.to_str() else {
        return;
    };

    buffer_pending_file(app_handle, path_str.to_string());

    let _ = app_handle.emit(FILE_OPENED_EVENT, ());
}

/// Linux and Windows deliver a file-association launch as a plain `argv`
/// entry; only macOS/iOS/Android get `RunEvent::Opened`. Without this the
/// `.desktop` MimeType registration generated from `bundle.fileAssociations`
/// still launches the app when a `.mmd` is double-clicked, but the path is
/// dropped and the editor opens empty.
///
/// Mirrors `handle_opened_urls`: grant the fs plugin's scope read access,
/// then buffer the path for the frontend. No `FILE_OPENED_EVENT` emit here —
/// this runs inside `setup`, long before a webview listener could exist, so
/// `App.tsx`'s drain-once-on-mount is the only route that can observe it.
#[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
fn handle_cli_file_open(app_handle: &AppHandle) {
    // argv[0] is the executable and WebKitGTK/Tauri inject their own flags,
    // so select the first argument that names an existing file rather than
    // trusting a fixed position. Canonicalizing matters because the scope
    // entry and the frontend's later read both have to resolve the path
    // independently of whatever cwd the app was launched from.
    let Some(path) = std::env::args_os()
        .skip(1)
        .map(std::path::PathBuf::from)
        .find(|path| path.is_file())
    else {
        return;
    };
    let path = path.canonicalize().unwrap_or(path);
    let Some(path_str) = path.to_str() else {
        return;
    };

    buffer_pending_file(app_handle, path_str.to_string());
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn list_monospace_fonts() -> Vec<String> {
    use core_text::font_collection::create_for_all_families;
    use core_text::font_descriptor::kCTFontMonoSpaceTrait;
    use core_text::font_descriptor::TraitAccessors;
    use std::collections::BTreeSet;

    let collection = create_for_all_families();
    let Some(descriptors) = collection.get_descriptors() else {
        return Vec::new();
    };

    // A `BTreeSet` dedupes and orders in a single step. The previous `Vec`
    // needed a linear `contains` per family — O(n²) string comparisons over
    // every installed family — plus a final `sort`.
    let mut fonts: BTreeSet<String> = BTreeSet::new();
    for i in 0..descriptors.len() {
        // The index comes from `0..len()`, so this can never miss; still,
        // `get` returning `Option` is not worth a panic inside a command.
        let Some(descriptor) = descriptors.get(i) else {
            continue;
        };
        let traits = descriptor.traits();
        if (traits.symbolic_traits() & kCTFontMonoSpaceTrait) == 0 {
            continue;
        }
        let name = descriptor.family_name();
        if !name.starts_with('.') {
            fonts.insert(name);
        }
    }
    fonts.into_iter().collect()
}

/// Families offered when the platform has no enumeration path of its own
/// (Windows) or when fontconfig is unavailable / yields nothing usable.
#[cfg(not(target_os = "macos"))]
fn fallback_monospace_fonts() -> Vec<String> {
    vec![
        "Consolas".into(),
        "Courier New".into(),
        "Menlo".into(),
        "Monaco".into(),
    ]
}

/// The frontend's `createEditorTheme` interpolates `editorFontFamily` raw
/// into a CSS declaration, so `validate-settings.ts` rejects any family
/// outside `/^[A-Za-z0-9 _-]+$/` and falls back to the default stack.
/// Applying the same filter here keeps the Settings dropdown from offering
/// a font that would be silently discarded the moment it is persisted.
#[cfg(target_os = "linux")]
fn is_css_safe_family(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '_' | '-'))
}

/// Enumerates monospace families through fontconfig's `fc-list`. Shelling
/// out keeps `libfontconfig1-dev` off the Linux build prerequisites —
/// fontconfig is present on every desktop install, and the hardcoded list
/// covers the case where it somehow is not. `:spacing=100` is fontconfig's
/// monospace selector.
#[cfg(target_os = "linux")]
#[tauri::command]
fn list_monospace_fonts() -> Vec<String> {
    use std::collections::BTreeSet;
    use std::process::Command;

    let Ok(output) = Command::new("fc-list")
        .args([":spacing=100", "family"])
        .output()
    else {
        return fallback_monospace_fonts();
    };
    if !output.status.success() {
        return fallback_monospace_fonts();
    }

    // Each line holds one font file's comma-separated family aliases, the
    // first being the canonical name and the rest localized or legacy
    // spellings. A `BTreeSet` dedupes across the many files sharing a
    // family and orders the result in a single step.
    let mut fonts: BTreeSet<String> = BTreeSet::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let Some(name) = line.split(',').next() else {
            continue;
        };
        let name = name.trim();
        if !name.starts_with('.') && is_css_safe_family(name) {
            fonts.insert(name.to_owned());
        }
    }

    if fonts.is_empty() {
        fallback_monospace_fonts()
    } else {
        fonts.into_iter().collect()
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
#[tauri::command]
fn list_monospace_fonts() -> Vec<String> {
    fallback_monospace_fonts()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(PendingFileOpen(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            list_monospace_fonts,
            take_pending_file_open
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            // Must run before the webview mounts: the frontend drains the
            // buffered path once on mount, and there is no second chance.
            #[cfg(not(any(
                target_os = "macos",
                target_os = "ios",
                target_os = "android"
            )))]
            handle_cli_file_open(app.handle());

            #[cfg(target_os = "macos")]
            let menu = {
                let app_menu = SubmenuBuilder::new(app, "MermaidJS Desktop")
                    .item(&MenuItem::with_id(
                        app,
                        "about",
                        "About MermaidJS Desktop",
                        true,
                        None::<&str>,
                    )?)
                    .separator()
                    .item(&MenuItem::with_id(
                        app,
                        "settings",
                        "Settings...",
                        true,
                        Some("CmdOrCtrl+,"),
                    )?)
                    .separator()
                    .item(&PredefinedMenuItem::services(app, None)?)
                    .separator()
                    .item(&PredefinedMenuItem::hide(app, Some("Hide MermaidJS Desktop"))?)
                    .item(&PredefinedMenuItem::hide_others(app, None)?)
                    .item(&PredefinedMenuItem::show_all(app, None)?)
                    .separator()
                    .item(&PredefinedMenuItem::quit(app, Some("Quit MermaidJS Desktop"))?)
                    .build()?;

                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;

                MenuBuilder::new(app)
                    .item(&app_menu)
                    .item(&edit_menu)
                    .build()?
            };

            // muda documents `services`, `hide`, `hide_others`, `show_all`,
            // `quit`, `undo` and `redo` as "Linux: Unsupported" — they are
            // dropped silently rather than erroring, which is why the macOS
            // menu above renders here as an App menu holding nothing but
            // About/Settings and an Edit menu whose first two entries do
            // nothing. This variant carries only items that actually work:
            // the two custom items, a custom Quit (the predefined one is
            // among the unsupported), and the clipboard predefines, which
            // *are* supported on Linux. Undo/redo are left out instead of
            // shown dead — CodeMirror already handles Ctrl+Z / Ctrl+Shift+Z
            // inside the webview, so the accelerators work regardless.
            #[cfg(not(target_os = "macos"))]
            let menu = {
                let file_menu = SubmenuBuilder::new(app, "File")
                    .item(&MenuItem::with_id(
                        app,
                        "about",
                        "About Mermaid Desktop",
                        true,
                        None::<&str>,
                    )?)
                    .item(&MenuItem::with_id(
                        app,
                        "settings",
                        "Settings...",
                        true,
                        Some("CmdOrCtrl+,"),
                    )?)
                    .separator()
                    .item(&MenuItem::with_id(
                        app,
                        MENU_QUIT_ID,
                        "Quit",
                        true,
                        Some("CmdOrCtrl+Q"),
                    )?)
                    .build()?;

                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .cut()
                    .copy()
                    .paste()
                    .separator()
                    .select_all()
                    .build()?;

                MenuBuilder::new(app)
                    .item(&file_menu)
                    .item(&edit_menu)
                    .build()?
            };

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            // `PredefinedMenuItem::quit` is unsupported on Linux, so off
            // macOS this is a plain custom item and the exit has to be
            // issued by hand.
            #[cfg(not(target_os = "macos"))]
            if event.id().as_ref() == MENU_QUIT_ID {
                app.exit(0);
                return;
            }

            let event_name = match event.id().as_ref() {
                "about" => MENU_ABOUT_EVENT,
                "settings" => MENU_SETTINGS_EVENT,
                _ => return,
            };

            let Some(window) = app.get_webview_window("main") else {
                return;
            };
            if let Err(error) = window.emit(event_name, ()) {
                eprintln!("Failed to emit {event_name}: {error}");
            }
            if let Err(error) = window.set_focus() {
                eprintln!("Failed to focus the main window: {error}");
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        if let tauri::RunEvent::Opened { urls } = _event {
            handle_opened_urls(_app_handle, urls);
        }
    });
}
