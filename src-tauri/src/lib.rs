use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            use tauri::Manager;
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
