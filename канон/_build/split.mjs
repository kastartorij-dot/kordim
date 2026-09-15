// Режет канон/00_КАНОН_Мастер_Кордим.md на блоки: канон/герои, канон/правила,
// канон/записи, канон/приложения. Каждый блок — файл с YAML-шапкой (id, title,
// часть, статус, ключи) и телом — точной цитатой исходного текста, без изменений.
//
// Запуск: node канон/_build/split.mjs
// После запуска обязательно: node канон/_build/build.mjs --check
// (собирает мастер обратно из блоков и сверяет байт-в-байт с оригиналом).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'канон', '00_КАНОН_Мастер_Кордим.md');
const OUT = path.join(ROOT, 'канон');

const raw = fs.readFileSync(SRC, 'utf8');
const lines = raw.split('\n');

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[«»"'`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function yaml(obj) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      if (v.length === 0) { lines.push(`${k}: []`); continue; }
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${yamlScalar(item)}`);
    } else {
      lines.push(`${k}: ${yamlScalar(v)}`);
    }
  }
  return lines.join('\n');
}
function yamlScalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (/^[\w\p{L}][\w\p{L}\s.,()«»/-]*$/u.test(s) && !s.includes(': ') && !s.startsWith('- ')) return s;
  return JSON.stringify(s);
}

function writeBlock(relPath, front, bodyLines) {
  const abs = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const body = bodyLines.join('\n');
  const content = `---\n${yaml(front)}\n---\n${body}`;
  fs.writeFileSync(abs, content, 'utf8');
  return relPath.replace(/\\/g, '/');
}

// --- находим главные вехи ---
const idx = (pred) => lines.findIndex(pred);
const partI = idx(l => l.trim() === '# ЧАСТЬ I. ГЕРОИ');
const partII = idx(l => l.trim() === '# ЧАСТЬ II. ПРАВИЛА ВЕДЕНИЯ');
const partIII = idx(l => l.trim() === '# ЧАСТЬ III. ЛОРБУК');
const firstAppendix = idx(l => /^# ПРИЛОЖЕНИЕ\./.test(l));
if ([partI, partII, partIII, firstAppendix].some(i => i < 0)) {
  throw new Error('Не нашёл одну из главных вех (ЧАСТЬ I/II/III или первое ПРИЛОЖЕНИЕ) — структура мастера изменилась, скрипт надо поправить.');
}

const manifest = { шапка: null, части: [], приложения: [] };

// --- шапка (всё до ЧАСТЬ I) ---
manifest.шапка = writeBlock('00_шапка.md', { type: 'шапка', title: 'Обложка и журнал правок' }, lines.slice(0, partI));

// --- ЧАСТЬ I. ГЕРОИ ---
{
  const heads = [];
  for (let i = partI; i < partII; i++) if (/^## /.test(lines[i])) heads.push(i);
  const bounds = [partI, ...heads.slice(1), partII];
  const files = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    const start = bounds[k], end = bounds[k + 1];
    const headLineIdx = heads[k];
    const title = lines[headLineIdx].replace(/^##\s*/, '').trim();
    const s = slug(title);
    const front = { id: s, title, часть: 'ЧАСТЬ I. ГЕРОИ', раздел: 'Герои', статус: 'канон' };
    files.push(writeBlock(path.join('герои', `${s}.md`), front, lines.slice(start, end)));
  }
  manifest.части.push({ заголовок: 'ЧАСТЬ I. ГЕРОИ', блоки: files });
}

// --- ЧАСТЬ II. ПРАВИЛА ВЕДЕНИЯ ---
{
  const heads = [];
  for (let i = partII; i < partIII; i++) if (/^## /.test(lines[i])) heads.push(i);
  const bounds = [partII, ...heads.slice(1), partIII];
  const files = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    const start = bounds[k], end = bounds[k + 1];
    const headLineIdx = heads[k];
    const title = lines[headLineIdx].replace(/^##\s*/, '').trim();
    const s = slug(title);
    const front = { id: s, title, часть: 'ЧАСТЬ II. ПРАВИЛА ВЕДЕНИЯ', раздел: 'Правила ведения', статус: 'канон' };
    files.push(writeBlock(path.join('правила', `${s}.md`), front, lines.slice(start, end)));
  }
  manifest.части.push({ заголовок: 'ЧАСТЬ II. ПРАВИЛА ВЕДЕНИЯ', блоки: files });
}

// --- ЧАСТЬ III. ЛОРБУК: 53 записи 0-52 ---
{
  const heads = [];
  for (let i = partIII; i < firstAppendix; i++) {
    const m = lines[i].replace(/\r$/, '').match(/^## (\d+)\.\s+(.+)$/);
    if (m) heads.push({ idx: i, id: +m[1], title: m[2].trim() });
  }
  const bounds = [partIII, ...heads.slice(1).map(h => h.idx), firstAppendix];
  const files = [];
  const openStatus = new Set([52]); // «Отряд Лихо» несёт открытые вопросы по сюжету
  for (let k = 0; k < bounds.length - 1; k++) {
    const start = bounds[k], end = bounds[k + 1];
    const { id, title } = heads[k];
    const body = lines.slice(start, end);
    const keysLine = body.find(l => /^`Ключи:/.test(l.trim()));
    const keys = keysLine
      ? keysLine.replace(/\r$/, '').replace(/^`Ключи:\s*/, '').replace(/`\s*$/, '').split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const s = slug(title);
    const front = {
      id, title,
      часть: 'ЧАСТЬ III. ЛОРБУК', раздел: 'Лорбук',
      статус: openStatus.has(id) ? 'открытый вопрос' : 'канон',
      ключи: keys,
    };
    files.push(writeBlock(path.join('записи', `${String(id).padStart(2, '0')}-${s}.md`), front, body));
  }
  manifest.части.push({ заголовок: 'ЧАСТЬ III. ЛОРБУК', блоки: files });
}

// --- Приложения ---
{
  const heads = [];
  for (let i = firstAppendix; i < lines.length; i++) {
    const m = lines[i].replace(/\r$/, '').match(/^# ПРИЛОЖЕНИЕ\.\s+(.+)$/);
    if (m) heads.push({ idx: i, title: m[1].trim() });
  }
  const bounds = [...heads.map(h => h.idx), lines.length];
  for (let k = 0; k < bounds.length - 1; k++) {
    const start = bounds[k], end = bounds[k + 1];
    const { title } = heads[k];
    const s = slug(title);
    const front = { title, часть: 'ПРИЛОЖЕНИЯ', раздел: 'Приложения', статус: 'канон' };
    manifest.приложения.push(writeBlock(path.join('приложения', `${s}.md`), front, lines.slice(start, end)));
  }
}

fs.writeFileSync(path.join(OUT, 'манифест.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

const total = manifest.части.reduce((n, p) => n + p.блоки.length, 0) + manifest.приложения.length + 1;
console.log(`Нарезано блоков: ${total}`);
console.log('манифест.json записан.');
