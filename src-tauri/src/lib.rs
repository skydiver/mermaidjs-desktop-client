mod ai;
mod commands;
mod file_open;
mod fonts;
mod keyring;
mod menu;

use std::sync::Mutex;

use tokio_util::sync::CancellationToken;

use ai::HttpClient;
use commands::ai::CancelState;
use file_open::PendingFileOpen;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(PendingFileOpen(Mutex::new(None)))
        // Shared `reqwest::Client` so every AI provider request reuses one
        // connection pool instead of paying TLS/DNS setup per request.
        .manage(HttpClient(reqwest::Client::new()))
        // Holds the `CancellationToken` for the in-flight AI stream, if any,
        // so `cancel_ai_stream` can stop it and a new `send_ai_message` call
        // can supersede it. `None` means no stream is currently running.
        .manage(CancelState(Mutex::new(None::<CancellationToken>)))
        .invoke_handler(tauri::generate_handler![
            fonts::list_monospace_fonts,
            file_open::take_pending_file_open,
            commands::ai::list_ai_providers,
            commands::ai::save_ai_api_key,
            commands::ai::delete_ai_api_key,
            commands::ai::test_ai_provider,
            commands::ai::send_ai_message,
            commands::ai::cancel_ai_stream,
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
            file_open::handle_cli_file_open(app.handle());

            let app_menu = menu::build_menu(app)?;
            app.set_menu(app_menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event);
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        if let tauri::RunEvent::Opened { urls } = _event {
            file_open::handle_opened_urls(_app_handle, urls);
        }
    });
}
