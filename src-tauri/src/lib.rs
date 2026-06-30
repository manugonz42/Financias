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

// OCR nativo de macOS: usa Apple Vision (VNRecognizeTextRequest).
#[cfg(target_os = "macos")]
#[tauri::command]
fn ocr_image(path: String) -> Result<Vec<String>, String> {
    use objc2::rc::autoreleasepool;
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send, msg_send_id};

    autoreleasepool(|| unsafe {
        // 1. Leer la imagen de disco a NSData.
        let ns_path = objc2_foundation::NSString::from_str(&path);
        let ns_url = objc2_foundation::NSURL::fileURLWithPath(&ns_path);
        let data = objc2_foundation::NSData::dataWithContentsOfURL(&ns_url)
            .ok_or_else(|| "No se pudo leer la imagen".to_string())?;

        // 2. Crear CIImage desde los datos.
        let ci_image_class = class!(CIImage);
        let ci_image: *mut AnyObject = msg_send![ci_image_class, imageWithData: &*data];
        if ci_image.is_null() {
            return Err("No se pudo crear CIImage desde los datos".to_string());
        }

        // 3. Crear VNRecognizeTextRequest.
        let request_class = class!(VNRecognizeTextRequest);
        let request: *mut AnyObject = msg_send![request_class, new];
        // Nivel accurado (1) y corrección de idioma.
        let _: () = msg_send![request, setRecognitionLevel: 1u64];
        let _: () = msg_send![request, setUsesLanguageCorrection: true];
        // Idiomas: español + inglés.
        let es = objc2_foundation::NSString::from_str("es-ES");
        let en = objc2_foundation::NSString::from_str("en-US");
        let languages =
            objc2_foundation::NSArray::from_vec(vec![es, en]);
        let _: () = msg_send![request, setRecognitionLanguages: &*languages];

        // 4. Crear VNImageRequestHandler y ejecutar.
        let handler_class = class!(VNImageRequestHandler);
        let empty_opts = objc2_foundation::NSDictionary::new();
        let handler: *mut AnyObject = msg_send![handler_class, alloc];
        let handler: *mut AnyObject =
            msg_send![handler, initWithCIImage: &*ci_image options: &*empty_opts];
        let requests = objc2_foundation::NSArray::from_vec(vec![request]);
        let _: () = msg_send![handler, performRequests: &*requests];

        // 5. Recoger resultados del request.
        let results: *mut AnyObject = msg_send![request, results];
        if results.is_null() {
            return Ok(Vec::new());
        }
        let count: usize = msg_send![results, count];
        let mut lines = Vec::with_capacity(count);
        for i in 0..count {
            let obs: *mut AnyObject = msg_send![results, objectAtIndex: i];
            // VNRecognizedTextObservation → topCandidates(1) → firstObject → string
            let candidates: *mut AnyObject = msg_send![obs, topCandidates: 1u64];
            if candidates.is_null() {
                continue;
            }
            let candidate: *mut AnyObject = msg_send![candidates, firstObject];
            if candidate.is_null() {
                continue;
            }
            let text: objc2_foundation::NSString = msg_send_id![candidate, string];
            let rust_str = text.to_string();
            if !rust_str.is_empty() {
                lines.push(rust_str);
            }
        }
        Ok(lines)
    })
}

// Fallback para Linux (sin OCR nativo).
#[cfg(not(any(windows, target_os = "macos")))]
#[tauri::command]
fn ocr_image(_path: String) -> Result<Vec<String>, String> {
    Err("El OCR nativo solo está disponible en Windows y macOS.".to_string())
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
