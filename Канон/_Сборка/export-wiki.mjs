// Экспортирует блоки канона в Игры/Сайт/Приложение/Данные/canon.json — для вкладки «Канон» в вики.
// Читает манифест.json, снимает с тела служебные заголовки (они уже есть в шапке
// блока как title/id) и строку `Ключи: ...` (она уже есть как ключи[]).
//
// node Канон/_Сборка/export-wiki.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KANON = path.join(ROOT, 'Канон');
const OUT = path.join(ROOT, 'Игры', 'Сайт', 'Приложение', 'Данные', 'canon.js');
// Лента правок для главной: датированные записи журнала из 00_шапка.md, новые сверху.
const OUT_JOURNAL = path.join(ROOT, 'Игры', 'Сайт', 'Приложение', 'Данные', 'journal.js');

function readBlock(rel) {
  // \r\n -> \n сразу: файл мог быть пересохранён редактором целиком в CRLF (в т.ч. автором
  // вручную), а для экспорта в вики точное воспроизведение переносов строк не нужно.
  const text = fs.readFileSync(path.join(KANON, rel), 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  if (lines[0] !== '---') throw new Error(`${rel}: нет YAML-шапки`);
  let close = -1;
  for (let i = 1; i < lines.length; i++) if (lines[i] === '---') { close = i; break; }
  const front = {};
  for (let i = 1; i < close; i++) {
    const l = lines[i];
    const m = l.match(/^([\p{L}_]+):\s*(.*)$/u);
    if (m) front[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  // ключи — блок списком "  - имя"
  const keys = [];
  const ki = lines.findIndex((l, i) => i < close && /^ключи:\s*$/.test(l));
  if (ki >= 0) {
    for (let i = ki + 1; i < close; i++) {
      const m = lines[i].match(/^\s*-\s*(.+)$/);
      if (m) keys.push(m[1]); else break;
    }
  }
  let body = lines.slice(close + 1).join('\n');
  // снимаем ведущие заголовки (# ЧАСТЬ ..., ## N. Title) и вступление раздела —
  // они дублируют title/раздел из шапки и не нужны в теле карточки.
  body = body.replace(/^﻿?/, '');
  const bodyLines = body.split('\n');
  let i = 0;
  while (i < bodyLines.length) {
    const l = bodyLines[i].trim();
    if (l === '') { i++; continue; }
    if (/^#{1,2}\s/.test(l)) { i++; continue; }
    if (/^Пятьдесят три Записи/.test(l)) { i++; continue; }
    break;
  }
  body = bodyLines.slice(i).join('\n');
  // снимаем строку ключей внутри тела (осталась от лорбука SillyTavern)
  body = body.replace(/^`Ключи:[^\n]*`\n?/m, '');
  // снимаем висящий разделитель --- в конце
  body = body.replace(/\n-{3,}\s*$/, '');
  return { front, keys, body: body.trim() };
}

const manifest = JSON.parse(fs.readFileSync(path.join(KANON, 'манифест.json'), 'utf8'));

function toItem(rel) {
  const { front, keys, body } = readBlock(rel);
  return {
    id: front.id,
    title: front.title,
    часть: front.часть || null,
    раздел: front.раздел || null,
    статус: front.статус || 'канон',
    ключи: keys,
    текст: body,
  };
}

const out = {
  собрано: new Date().toISOString().slice(0, 10),
  герои: [],
  правила: [],
  записи: [],
  приложения: manifest.приложения.map(toItem),
};

for (const part of manifest.части) {
  const target = part.заголовок.includes('ГЕРОИ') ? out.герои
    : part.заголовок.includes('ПРАВИЛА') ? out.правила
    : out.записи;
  for (const rel of part.блоки) target.push(toItem(rel));
}

/* журнал: абзацы вида «**Заголовок, ДД.ММ.ГГГГ** текст» в разделе «Что изменено против исходника» */
function readJournal() {
  const src = fs.readFileSync(path.join(KANON, manifest.шапка), 'utf8').replace(/\r\n/g, '\n');
  const at = src.indexOf('## Что изменено против исходника');
  if (at < 0) return [];
  const entries = [];
  src.slice(at).split(/\n\s*\n/).forEach((p, order) => {
    const m = p.trim().match(/^\*\*(.+?)\*\*:?\s*([\s\S]*)$/);
    if (!m) return;
    const d = m[1].match(/(\d{1,2})\.(\d{2})\.(\d{4})/);
    if (!d) return;
    const title = m[1].replace(/,?\s*\d{1,2}\.\d{2}\.\d{4}\s*:?$/, '').replace(/:$/, '').trim();
    entries.push({ date: `${d[3]}-${d[2]}-${d[1].padStart(2, '0')}`, title, text: m[2].replace(/\s+/g, ' ').trim(), order });
  });
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order).map(({ order, ...e }) => e);
}
const journal = readJournal();
const generatedJournal = '// Автосборка из журнала правок Канон/00_шапка.md (export-wiki.mjs). Не редактировать руками.\n'
  + `export const JOURNAL = ${JSON.stringify(journal, null, 1)};\n`;

const header = '// Автосборка из Канон/Герои, Канон/Правила, Канон/Записи, Канон/Приложения.\n'
  + '// Не редактировать руками — правьте блоки и запускайте node Канон/_Сборка/export-wiki.mjs.\n';
const generated = header + `export const CANON = ${JSON.stringify(out, null, 2)};\n`;
if (process.argv.includes('--check')) {
  // Дата сборки не меняет фактов; переносы Windows и Linux могут различаться.
  const normalize = s => s.replace(/\r\n/g, '\n').replace(/("собрано": ")[^"]+(")/, '$1DATE$2');
  const stale = (file, text) => !fs.existsSync(file) || normalize(fs.readFileSync(file, 'utf8')) !== normalize(text);
  if (stale(OUT, generated) || stale(OUT_JOURNAL, generatedJournal)) {
    console.error('Канон справочника устарел. Запустите node Канон/_Сборка/export-wiki.mjs');
    process.exit(1);
  }
  console.log('OK: канон справочника совпадает с блоками.');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, generated, 'utf8');
  fs.writeFileSync(OUT_JOURNAL, generatedJournal, 'utf8');
  console.log(`Записано: ${OUT}`);
}
console.log(`Герои ${out.герои.length}, правила ${out.правила.length}, записи ${out.записи.length}, приложения ${out.приложения.length}, журнал ${journal.length}`);
