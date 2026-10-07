mod navigation;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Удалённая игра не получает IPC-доступ к компьютеру. Навигация остаётся
        // только внутри опубликованного пути игры на нашем Cloudflare Worker.
        .plugin(
            tauri::plugin::Builder::<tauri::Wry, ()>::new("navigation-policy")
                .on_navigation(|_webview, url| navigation::allowed(url))
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
