// Собирает из Проза/*.md читалку для вычитки: красивый текст, пометки
// «не нравится / вопрос / заметка» на выделенных словах, выгрузка пометок для чата.
// Пометки живут в браузере (localStorage) и переживают пересборку: место ищется по цитате.
// Результат — Проза/Читалка/<файл>.html (для ПК, в гит не идёт, см. .gitignore) и та же
// читалка на сайте: Игры/Сайт/Читалка/ (в гите, уезжает на сайт с push; с телефона —
// kordim.kastartorij.workers.dev/read). Проза на сайте и так есть в «Сценах», нового наружу не уходит.
//
// node Канон/_Сборка/reader.mjs                      — вся проза
// node Канон/_Сборка/reader.mjs Ошерская_история.md  — один файл

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PROZA = path.join(ROOT, 'Проза');
const OUT = path.join(PROZA, 'Читалка');
const SITE = path.join(ROOT, 'Игры', 'Сайт', 'Читалка');
const TEMPLATE = fs.readFileSync(path.join(HERE, 'reader-template.html'), 'utf8');

function readProse(file) {
  const lines = fs.readFileSync(path.join(PROZA, file), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  const front = {};
  let i = 0;
  if (lines[0] === '---') {
    for (i = 1; i < lines.length && lines[i] !== '---'; i++) {
      const m = lines[i].match(/^([a-zа-я]+):\s*(.*)$/i);
      if (m) front[m[1]] = m[2].trim();
    }
    i++;
  }
  // номер строки абзаца — как в файле, чтобы пометки из читалки совпадали с правкой
  const blocks = [];
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (/^-{3,}$|^\*{3,}$/.test(t)) { blocks.push({ kind: 'break' }); continue; }
    const h = t.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      if (h[1] === front.title && !blocks.length) continue;
      blocks.push({ kind: 'h', text: h[1] });
      continue;
    }
    blocks.push({ kind: 'p', line: i + 1, text: t });
  }
  return { front, blocks };
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2).map(f => path.basename(f))
  : fs.readdirSync(PROZA).filter(f => f.endsWith('.md'));

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SITE, { recursive: true });
for (const file of files) {
  const { front, blocks } = readProse(file);
  const title = front.title || file.replace(/\.md$/, '');
  const data = { id: file.replace(/\.md$/, ''), file: `Проза/${file}`, title, status: front.status || '', blocks };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = TEMPLATE
    .replace('__TITLE__', esc(title))
    .replace('__DATA__', () => json);
  const name = file.replace(/\.md$/, '.html');
  fs.writeFileSync(path.join(OUT, name), html);
  fs.writeFileSync(path.join(SITE, name), html);
  console.log(`✓ ${name} — ${blocks.filter(b => b.kind === 'p').length} абзацев`);
}

// оглавление для телефона — по всей прозе, не только по пересобранной
const list = fs.readdirSync(PROZA).filter(f => f.endsWith('.md')).map(f => {
  const { front, blocks } = readProse(f);
  const words = blocks.filter(b => b.kind === 'p').map(b => b.text).join(' ').split(/\s+/).filter(Boolean).length;
  return { href: encodeURI(f.replace(/\.md$/, '.html')), title: front.title || f.replace(/\.md$/, ''), status: front.status || '', words };
}).sort((a, b) => a.title.localeCompare(b.title, 'ru'));
const rows = list.map(x => `  <a href="${x.href}"><b>${esc(x.title)}</b><span>${x.status ? esc(x.status) + ' · ' : ''}${x.words.toLocaleString('ru-RU')} слов · ~${Math.round(x.words / 180)} мин</span></a>`).join('\n');
fs.writeFileSync(path.join(SITE, 'index.html'), `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Читалка</title>
<link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,600&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet">
<style>
:root { --bg: #f5efe3; --paper: #fbf7ef; --ink: #2a241d; --muted: #8a7f70; --rule: #e4dac8; --accent: #8c3b2a; }
@media (prefers-color-scheme: dark) { :root { --bg: #161411; --paper: #1d1a16; --ink: #ddd4c6; --muted: #8f8577; --rule: #2f2a24; --accent: #d98b6c; } }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 "PT Sans", Arial, sans-serif; }
main { max-width: 36em; margin: 0 auto; padding: calc(40px + env(safe-area-inset-top)) 16px 48px; }
.kicker { font-size: 13px; letter-spacing: .22em; text-transform: uppercase; color: var(--muted); }
h1 { font: 600 2em/1.15 "Literata", Georgia, serif; margin: .3em 0 .8em; }
a { display: block; background: var(--paper); border: 1px solid var(--rule); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; color: inherit; text-decoration: none; }
a b { display: block; font: 600 19px/1.3 "Literata", Georgia, serif; margin-bottom: 3px; }
a span { color: var(--muted); font-size: 14px; }
p { color: var(--muted); font-size: 14px; margin-top: 24px; }
</style>
</head>
<body>
<main>
  <div class="kicker">Кордим · проза</div>
  <h1>Читалка</h1>
${rows}
  <p>Пометки хранятся в этом браузере. Когда закончишь — «Заметки» → «Скопировать для Claude» и вставь в чат.</p>
</main>
</body>
</html>
`);
console.log(`✓ оглавление: ${path.relative(ROOT, path.join(SITE, 'index.html'))}`);
