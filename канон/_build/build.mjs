// Собирает канон/00_КАНОН_Мастер_Кордим.md обратно из блоков по манифест.json.
// --check сверяет результат с текущим мастером байт-в-байт и ничего не пишет.
// Без флага — перезаписывает мастер собранной версией (запускать после правки блоков).
//
// node канон/_build/build.mjs           — пересобрать мастер
// node канон/_build/build.mjs --check   — только проверить, что сборка не разошлась

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KANON = path.join(ROOT, 'канон');
const MASTER = path.join(KANON, '00_КАНОН_Мастер_Кордим.md');
const CHECK = process.argv.includes('--check');

function readBody(relPath) {
  // Снимаем все \r: почти все блоки пересохранены редактором в CRLF, а мастер живёт в LF,
  // где-то попадается и одиночный \r в конце файла. Без этого --check всегда показывал
  // расхождение на первой же строке, а пересборка переписывала переносами весь мастер.
  const text = fs.readFileSync(path.join(KANON, relPath), 'utf8').replace(/\r/g, '');
  const lines = text.split('\n');
  if (lines[0] !== '---') throw new Error(`${relPath}: нет YAML-шапки`);
  let close = -1;
  for (let i = 1; i < lines.length; i++) if (lines[i] === '---') { close = i; break; }
  if (close < 0) throw new Error(`${relPath}: не нашёл закрывающую черту шапки`);
  return lines.slice(close + 1).join('\n');
}

const manifest = JSON.parse(fs.readFileSync(path.join(KANON, 'манифест.json'), 'utf8'));

const parts = [readBody(manifest.шапка)];
for (const part of manifest.части) {
  for (const block of part.блоки) parts.push(readBody(block));
}
for (const app of manifest.приложения) parts.push(readBody(app));

const assembled = parts.join('\n');

if (CHECK) {
  // На Windows git (core.autocrlf=true) выкладывает мастер в CRLF, хотя в репозитории он LF,
  // поэтому сравниваем без \r — иначе --check ложно падает на первой строке.
  const original = fs.readFileSync(MASTER, 'utf8').replace(/\r/g, '');
  if (assembled === original) {
    console.log('OK: сборка из блоков совпадает с мастером байт-в-байт.');
    process.exit(0);
  } else {
    console.error('РАСХОЖДЕНИЕ: сборка не совпадает с мастером.');
    const a = original.split('\n'), b = assembled.split('\n');
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (a[i] !== b[i]) {
        console.error(`Первая разница на строке ${i + 1}:`);
        console.error(`  мастер : ${JSON.stringify(a[i])}`);
        console.error(`  сборка : ${JSON.stringify(b[i])}`);
        break;
      }
    }
    process.exit(1);
  }
} else {
  fs.writeFileSync(MASTER, assembled, 'utf8');
  console.log('Мастер пересобран из блоков: ' + MASTER);
}
