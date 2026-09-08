use tauri::menu::{Menu, MenuBuilder, MenuItem, SubmenuBuilder};
// Every `PredefinedMenuItem` still referenced by name lives in the macOS-only
// menu; the Linux/Windows menu reaches its supported predefines through
// `SubmenuBuilder`'s `cut()`/`copy()`/`paste()`/`select_all()` helpers.
#[cfg(target_os = "macos")]
use tauri::menu::PredefinedMenuItem;
use tauri::{AppHandle, Emitter, Manager, Wry};

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

/// Builds the native application menu. Called from `setup`, before the
/// webview mounts, so `app` is the only handle available at this point.
pub fn build_menu(app: &tauri::App) -> tauri::Result<Menu<Wry>> {
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

    Ok(menu)
}

/// Handles a native menu item selection, translating it into either a
/// webview event (`about`/`settings`) or a direct Rust-side action (Quit,
/// off macOS).
pub fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
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
}
