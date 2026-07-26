use std::sync::Mutex;
use std::sync::PoisonError;

use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_fs::FsExt;

/// Name of the event emitted (from Rust to the frontend) to signal that a
/// new pending file path is available to be drained via
/// `take_pending_file_open`. On a cold launch this event can be emitted
/// before the webview's listener is registered, and a dropped emit is
/// exactly the bug this exists to fix — the frontend therefore also drains
/// once on mount to cover that race. See `PendingFileOpen`.
const FILE_OPENED_EVENT: &str = "file-opened";

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
    let path_str = path_str.to_owned();

    if let Some(scope) = app_handle.try_fs_scope() {
        let _ = scope.allow_file(&path_str);
    }

    if let Some(state) = app_handle.try_state::<PendingFileOpen>() {
        *state
            .0
            .lock()
            .unwrap_or_else(PoisonError::into_inner) = Some(path_str);
    }

    let _ = app_handle.emit(FILE_OPENED_EVENT, ());
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn list_monospace_fonts() -> Vec<String> {
    use core_text::font_collection::create_for_all_families;
    use core_text::font_descriptor::kCTFontMonoSpaceTrait;
    use core_text::font_descriptor::TraitAccessors;

    let collection = create_for_all_families();
    let descriptors = collection.get_descriptors();

    let mut fonts: Vec<String> = Vec::new();
    if let Some(descriptors) = descriptors {
        for i in 0..descriptors.len() {
            let descriptor = descriptors.get(i).unwrap();
            let traits = descriptor.traits();
            let symbolic = traits.symbolic_traits();
            if (symbolic & kCTFontMonoSpaceTrait) != 0 {
                let name = descriptor.family_name();
                if !name.starts_with('.') && !fonts.contains(&name) {
                    fonts.push(name);
                }
            }
        }
    }
    fonts.sort();
    fonts
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn list_monospace_fonts() -> Vec<String> {
    vec![
        "Consolas".into(),
        "Courier New".into(),
        "Menlo".into(),
        "Monaco".into(),
    ]
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

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "about" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.eval("window.dispatchEvent(new Event('menu-about'))");
                        let _ = window.set_focus();
                    }
                }
                "settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.eval("window.dispatchEvent(new Event('menu-settings'))");
                        let _ = window.set_focus();
                    }
                }
                _ => {}
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
