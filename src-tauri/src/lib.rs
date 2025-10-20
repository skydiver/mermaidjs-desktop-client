use serde::Deserialize;
use tauri::{Manager, PhysicalPosition, PhysicalSize, Size};
use tauri_plugin_store::StoreBuilder;

const SETTINGS_STORE_NAME: &str = "settings.store";
const WINDOW_STATE_KEY: &str = "windowState";

#[derive(Debug, Deserialize)]
struct WindowState {
    width: Option<f64>,
    height: Option<f64>,
    x: Option<f64>,
    y: Option<f64>,
    maximized: Option<bool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("failed to get main window");

            let store = StoreBuilder::new(app, SETTINGS_STORE_NAME).build()?;
            if let Err(err) = store.reload() {
                if !err.to_string().contains("No such file") {
                    eprintln!("Unable to load settings store: {err}");
                }
            }

            if let Some(raw_state) = store.get(WINDOW_STATE_KEY) {
                if let Ok(state) = serde_json::from_value::<WindowState>(raw_state) {
                    if let (Some(width), Some(height)) = (state.width, state.height) {
                        if width.is_finite() && height.is_finite() && width > 0.0 && height > 0.0 {
                            let size =
                                PhysicalSize::new(width.round() as u32, height.round() as u32);
                            let _ = window.set_size(Size::Physical(size));
                        }
                    }
                    if let (Some(x), Some(y)) = (state.x, state.y) {
                        if x.is_finite() && y.is_finite() {
                            let position =
                                PhysicalPosition::new(x.round() as i32, y.round() as i32);
                            let _ = window.set_position(position);
                        }
                    }
                    if state.maximized.unwrap_or(false) {
                        let _ = window.maximize();
                    }
                } else {
                    eprintln!("Invalid window state found in store");
                }
            }

            if let Err(err) = window.show() {
                eprintln!("Unable to show window: {err}");
            }
            if let Err(err) = window.set_focus() {
                eprintln!("Unable to focus window: {err}");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
