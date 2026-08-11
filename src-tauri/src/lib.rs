use tauri::Manager;

// Resolve the Anthropic API key at RUNTIME — never bundled into the app binary.
// Order: (1) ANTHROPIC_API_KEY environment variable, (2) a local config file
// `<app_config_dir>/anthropic_key.txt`. On a machine with neither (e.g. a shared
// copy given to a friend), this returns "" and the AI features stay disabled —
// so a shared copy cannot spend on the owner's account.
#[tauri::command]
fn get_anthropic_key(app: tauri::AppHandle) -> String {
  if let Ok(k) = std::env::var("ANTHROPIC_API_KEY") {
    let k = k.trim().to_string();
    if !k.is_empty() {
      return k;
    }
  }
  if let Ok(dir) = app.path().app_config_dir() {
    let path = dir.join("anthropic_key.txt");
    if let Ok(contents) = std::fs::read_to_string(&path) {
      let k = contents.trim().to_string();
      if !k.is_empty() {
        return k;
      }
    }
  }
  String::new()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_opener::init());

  // Auto-updater + relaunch — desktop only.
  #[cfg(desktop)]
  {
    builder = builder
      .plugin(tauri_plugin_updater::Builder::new().build())
      .plugin(tauri_plugin_process::init());
  }

  builder
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
    .invoke_handler(tauri::generate_handler![get_anthropic_key])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
