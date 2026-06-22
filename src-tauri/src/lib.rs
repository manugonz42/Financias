// Lee un fichero del disco (p.ej. el PDF seleccionado con el diálogo) y
// devuelve sus bytes. Evita tener que abrir permisos de FS amplios: el
// frontend pasa la ruta que el usuario eligió en el diálogo del sistema.
#[tauri::command]
fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

// Escribe texto en disco (p.ej. exportar a CSV en la ruta elegida en el diálogo).
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![read_file_bytes, write_text_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
