use tauri::Url;

const GAME_URL: &str = "https://kordim.kastartorij.workers.dev/Игра/Порт/";

pub fn allowed(url: &Url) -> bool {
    // Url::path() is percent-encoded, including Cyrillic. Compare parsed paths.
    let game = Url::parse(GAME_URL).expect("valid game URL");
    url.scheme() == game.scheme()
        && url.host_str() == game.host_str()
        && url.port_or_known_default() == game.port_or_known_default()
        && url.path().starts_with(game.path())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_startup_and_game_pages() {
        for address in [GAME_URL,
            "https://kordim.kastartorij.workers.dev/Игра/Порт/?desktop=1",
            "https://kordim.kastartorij.workers.dev/%D0%98%D0%B3%D1%80%D0%B0/%D0%9F%D0%BE%D1%80%D1%82/index.html",
            "https://kordim.kastartorij.workers.dev/Игра/Порт/index.html#menu",
        ] {
            assert!(allowed(&Url::parse(address).unwrap()), "{address}");
        }
        assert_ne!(Url::parse(GAME_URL).unwrap().path(), "/Игра/Порт/");
    }

    #[test]
    fn rejects_other_origins_and_paths() {
        for address in [
            "http://kordim.kastartorij.workers.dev/Игра/Порт/",
            "https://example.com/Игра/Порт/",
            "https://kordim.kastartorij.workers.dev.evil.example/Игра/Порт/",
            "https://kordim.kastartorij.workers.dev:444/Игра/Порт/",
            "https://kordim.kastartorij.workers.dev/Приложение/",
            "https://kordim.kastartorij.workers.dev/Игра/Порт-другой/",
            "https://kordim.kastartorij.workers.dev/Игра/Порт/../Истории/",
            "https://kordim.kastartorij.workers.dev/Игра/Порт/%2e%2e/Истории/",
        ] {
            assert!(!allowed(&Url::parse(address).unwrap()), "{address}");
        }
    }
}

