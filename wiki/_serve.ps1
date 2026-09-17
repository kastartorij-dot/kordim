# Локальный статический сервер для просмотра реестра.
# Запуск:  powershell -ExecutionPolicy Bypass -File _serve.ps1
# Остановка: закрыть окно или Ctrl+C
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
# папку мини-игры ищем по её файлу, а не по имени: скрипт может читаться не в UTF-8
$gameDir = Get-ChildItem (Split-Path -Parent $root) -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'kordim-rpg-handoff.md') } | Select-Object -First 1
$gameRoot = if ($gameDir) { $gameDir.FullName } else { $root }
$prefix = 'http://localhost:8791/'

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.png'  = 'image/png'
  '.webp' = 'image/webp'
  '.svg'  = 'image/svg+xml'
  '.json' = 'application/json; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "Реестр Кордима: $prefix"

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }

    # /game/… отдаётся из папки «Мини-игра» рядом с вики
    $base = $root
    if ($rel -like 'game/*') { $base = $gameRoot; $rel = $rel.Substring(5) }
    $path = Join-Path $base $rel
    # не выпускаем запросы за пределы папки
    $full = [System.IO.Path]::GetFullPath($path)
    if (-not $full.StartsWith([System.IO.Path]::GetFullPath($base))) {
      $ctx.Response.StatusCode = 403
      $ctx.Response.Close()
      continue
    }

    # адрес папки (/app/) открывает её index.html
    if (Test-Path $full -PathType Container) { $full = Join-Path $full 'index.html' }

    if (Test-Path $full -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $type = $mime[$ext]
      if (-not $type) { $type = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ctx.Response.ContentType = $type
      # без кеша: иначе браузер держит старые модули проекта после правок
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
      # по дате правки кнопка «обновить» (js/update.js) понимает, что файл поменялся
      $ctx.Response.Headers.Add('Last-Modified', [System.IO.File]::GetLastWriteTimeUtc($full).ToString('R'))
      $ctx.Response.ContentLength64 = $bytes.Length
      # на HEAD тело не пишем: HttpListener бросает исключение, и соединение повисало незакрытым
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes('404')
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $ctx.Response.OutputStream.Write($msg, 0, $msg.Length) }
    }
    $ctx.Response.Close()
  } catch {
    # одиночный сбойный запрос не должен ронять сервер
  }
}
