# Порт Теней — приложение для Windows

Это тонкая Tauri-оболочка над опубликованной игрой:

`GitHub → Cloudflare Workers → Порт Теней.exe`

При каждом запуске приложение открывает
`https://kordim.kastartorij.workers.dev/game/port/`. Поэтому изменения игровой
логики, текстов и изображений доходят до приложения после обычного push в `main`
и деплоя Cloudflare; новый установщик для них не нужен.

Сохранения принадлежат HTTPS-origin игры и хранятся WebView2 в постоянном профиле
приложения. Обновление страницы и обновление файлов на Cloudflare их не стирают.

Удалённая страница не включена ни в одну capability Tauri и не имеет доступа к
IPC, файловой системе или shell. Навигация оболочки ограничена доменом Кордима и
путём `/game/port/`.

## Сборка

Основной способ — workflow `.github/workflows/port-desktop.yml`. Он собирает
Windows NSIS-установщик и сохраняет его как artifact запуска GitHub Actions.

Локально, если установлены Rust, Microsoft C++ Build Tools и WebView2:

```powershell
npm ci
npm run build
```
