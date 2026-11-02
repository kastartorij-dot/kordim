// Собирает из Проза/*.md читалку для вычитки: красивый текст, пометки
// «не нравится / вопрос / заметка» на выделенных словах, выгрузка пометок для чата.
// Пометки живут в браузере (localStorage) и переживают пересборку: место ищется по цитате.
// Результат — Проза/Читалка/<файл>.html, в гит не идёт (производное, см. .gitignore).
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

fs.mkdirSync(OUT, { recursive: true });
for (const file of files) {
  const { front, blocks } = readProse(file);
  const title = front.title || file.replace(/\.md$/, '');
  const data = { id: file.replace(/\.md$/, ''), file: `Проза/${file}`, title, status: front.status || '', blocks };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = TEMPLATE
    .replace('__TITLE__', title.replace(/&/g, '&amp;').replace(/</g, '&lt;'))
    .replace('__DATA__', () => json);
  const out = path.join(OUT, file.replace(/\.md$/, '.html'));
  fs.writeFileSync(out, html);
  console.log(`✓ ${path.relative(ROOT, out)} — ${blocks.filter(b => b.kind === 'p').length} абзацев`);
}
