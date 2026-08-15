use std::sync::Mutex;

use serde::Serialize;

// ── Headless import/export ───────────────────────────────────────────────────
// Supports launching the app with `--import <path.pxp> [--export-dir <dir>]`
// so a scheduled task can generate an article and export it to PDF with zero
// human interaction. Normal interactive launches (no --import flag) leave
// this entirely inert.

#[derive(Clone, Serialize)]
struct HeadlessImport {
    pxp_json: String,
    export_dir: String,
}

struct HeadlessState(Mutex<Option<HeadlessImport>>);

/// Parses `--import <path>` and `--export-dir <dir>` from the process args.
/// Returns `None` if `--import` was not passed (normal interactive launch).
fn parse_headless_args() -> Option<HeadlessImport> {
    let args: Vec<String> = std::env::args().collect();

    let import_path = args
        .iter()
        .position(|a| a == "--import")
        .and_then(|i| args.get(i + 1))
        .cloned()?;

    let export_dir = args
        .iter()
        .position(|a| a == "--export-dir")
        .and_then(|i| args.get(i + 1))
        .cloned()
        .unwrap_or_else(default_export_dir);

    let pxp_json = std::fs::read_to_string(&import_path)
        .unwrap_or_else(|e| panic!("failed to read --import file '{import_path}': {e}"));

    Some(HeadlessImport {
        pxp_json,
        export_dir,
    })
}

/// `<Documents>\PixelNews`, falling back to `%USERPROFILE%\Documents\PixelNews`
/// if the `dirs` crate can't resolve the documents folder.
fn default_export_dir() -> String {
    let documents = dirs::document_dir().or_else(|| {
        std::env::var("USERPROFILE")
            .ok()
            .map(|home| std::path::PathBuf::from(home).join("Documents"))
    });

    match documents {
        Some(dir) => dir.join("PixelNews").to_string_lossy().to_string(),
        None => "PixelNews".to_string(),
    }
}

/// Returns the pending headless import (if the app was launched with
/// `--import`), consuming it so it's only ever handed to the frontend once.
#[tauri::command]
fn get_headless_import(state: tauri::State<HeadlessState>) -> Option<HeadlessImport> {
    state.0.lock().unwrap().take()
}

/// Writes `data` to `<dir>/<filename>` via a raw `std::fs::write`, bypassing
/// tauri-plugin-fs's scope system (which only grants access within the app's
/// own scoped directories, never an arbitrary path like the user's Documents
/// folder). Same pattern already used by captain-log and nyomcraft for their
/// own custom save commands. Exits the app once the file is written so a
/// scheduled task sees the process terminate cleanly.
#[tauri::command]
fn save_pdf_and_exit(
    app: tauri::AppHandle,
    dir: String,
    filename: String,
    data: Vec<u8>,
) -> Result<String, String> {
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = std::path::Path::new(&dir).join(&filename);
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    let written_path = path.to_string_lossy().to_string();
    app.exit(0);
    Ok(written_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let headless_import = parse_headless_args();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(HeadlessState(Mutex::new(headless_import)))
        .invoke_handler(tauri::generate_handler![
            get_headless_import,
            save_pdf_and_exit
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
