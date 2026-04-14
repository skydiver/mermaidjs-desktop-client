use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};

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
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_monospace_fonts])
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
