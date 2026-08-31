use std::sync::Mutex;
use std::sync::PoisonError;

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
pub const FILE_OPENED_EVENT: &str = "file-opened";

/// Holds the most recently opened-from-Finder file path until the frontend
/// drains it via `take_pending_file_open`. `Mutex::take` (via `Option::take`)
/// makes the drain atomic, so a path delivered through the cold-start drain
/// and a path delivered through the `file-opened` event can never both be
/// processed — whichever call reaches the mutex first empties it for the
/// other.
pub struct PendingFileOpen(pub Mutex<Option<String>>);

#[tauri::command]
pub fn take_pending_file_open(state: tauri::State<'_, PendingFileOpen>) -> Option<String> {
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
pub fn handle_opened_urls(app_handle: &AppHandle, urls: Vec<tauri::Url>) {
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
pub fn handle_cli_file_open(app_handle: &AppHandle) {
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
