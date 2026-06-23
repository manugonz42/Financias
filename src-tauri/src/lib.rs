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

// OCR nativo: extrae las líneas de texto de una imagen (recibo) usando el motor
// del sistema operativo. Devuelve una línea de texto por cada renglón detectado.
// El parseo a producto/precio/fecha se hace en el frontend.
#[cfg(windows)]
#[tauri::command]
fn ocr_image(path: String) -> Result<Vec<String>, String> {
    // Se ejecuta en su propio hilo con COM en modo multihilo (MTA), porque las
    // APIs WinRT requieren un apartamento COM inicializado.
    std::thread::spawn(move || ocr_windows(path))
        .join()
        .map_err(|_| "El hilo de OCR ha fallado".to_string())?
}

#[cfg(windows)]
fn ocr_windows(path: String) -> Result<Vec<String>, String> {
    use windows::core::HSTRING;
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::{FileAccessMode, StorageFile};
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }

    let run = || -> windows::core::Result<Vec<String>> {
        let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path.as_str()))?.get()?;
        let stream = file.OpenAsync(FileAccessMode::Read)?.get()?;
        let decoder = BitmapDecoder::CreateAsync(&stream)?.get()?;
        let bitmap = decoder.GetSoftwareBitmapAsync()?.get()?;
        // Usa los idiomas del perfil del usuario (es/en si están instalados).
        let engine = OcrEngine::TryCreateFromUserProfileLanguages()?;
        let result = engine.RecognizeAsync(&bitmap)?.get()?;
        let mut lines = Vec::new();
        for line in result.Lines()? {
            lines.push(line.Text()?.to_string());
        }
        Ok(lines)
    };

    run().map_err(|e| {
        format!(
            "No se pudo leer la imagen con el OCR de Windows ({e}). \
             Comprueba que tienes instalado el paquete de idioma con OCR \
             (Configuración → Hora e idioma → Idioma)."
        )
    })
}

#[cfg(not(windows))]
#[tauri::command]
fn ocr_image(_path: String) -> Result<Vec<String>, String> {
    Err("El OCR nativo solo está disponible en Windows por ahora.".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![read_file_bytes, write_text_file, ocr_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
