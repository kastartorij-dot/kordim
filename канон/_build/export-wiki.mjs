// Экспортирует блоки канона в Порт/site/app/data/canon.json — для вкладки «Канон» в вики.
// Читает манифест.json, снимает с тела служебные заголовки (они уже есть в шапке
// блока как title/id) и строку `Ключи: ...` (она уже есть как ключи[]).
//
// node канон/_build/export-wiki.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KANON = path.join(ROOT, 'канон');
const OUT = path.join(ROOT, 'Порт', 'site', 'app', 'data', 'canon.js');

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
    if (/^Пятьдесят три записи/.test(l)) { i++; continue; }
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

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const header = '// Автосборка из канон/герои, канон/правила, канон/записи, канон/приложения.\n'
  + '// Не редактировать руками — правьте блоки и запускайте node канон/_build/export-wiki.mjs.\n';
fs.writeFileSync(OUT, header + `export const CANON = ${JSON.stringify(out, null, 2)};\n`, 'utf8');
console.log(`Записано: ${OUT}`);
console.log(`Герои ${out.герои.length}, правила ${out.правила.length}, записи ${out.записи.length}, приложения ${out.приложения.length}`);
