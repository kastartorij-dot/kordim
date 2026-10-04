// Проверяет блоки канона на снятые вещи (Гильдия, гримдарк и т.п. из Канон/запреты.txt)
// и на пустые ключи у записей ЧАСТИ III. Тем же списком проверяет и Проза/*.md — грубые
// прямые нарушения канона в тексте сцен (это не полная сверка, только явные формулировки
// из чёрного списка; тонкие противоречия — отдельно, глазами). Не трогает файлы, только
// печатает отчёт.
//
// node Канон/_Сборка/validate.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KANON = path.join(ROOT, 'Канон');
const manifest = JSON.parse(fs.readFileSync(path.join(KANON, 'манифест.json'), 'utf8'));
const banFile = path.join(KANON, 'запреты.txt');
const bans = fs.existsSync(banFile)
  ? fs.readFileSync(banFile, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'))
  : [];

// Шапка (журнал правок) намеренно исключена: там описывается сама отмена
// («Гильдия наёмников упразднена», «ярлык гримдарк снят») — это не нарушение,
// а история решения.
const allFiles = [...manifest.части.flatMap(p => p.блоки), ...manifest.приложения];

let problems = 0;
for (const rel of allFiles) {
  const text = fs.readFileSync(path.join(KANON, rel), 'utf8').replace(/\r\n/g, '\n');
  const bodyStart = text.indexOf('\n---\n', 4) + 5;
  const front = text.slice(0, bodyStart);
  const body = text.slice(bodyStart);

  for (const term of bans) {
    if (body.includes(term)) {
      console.log(`⚠ ${rel}: снятая формулировка «${term}»`);
      problems++;
    }
  }
  if (/^id: \d+/m.test(front) && /ключи:\s*\[\]/.test(front)) {
    console.log(`⚠ ${rel}: пустые ключи`);
    problems++;
  }
}

// Проза/*.md — та же проверка на запреты, без ключей (это не канон, ключи не нужны)
const PROZA = path.join(ROOT, 'Проза');
if (fs.existsSync(PROZA)) {
  for (const file of fs.readdirSync(PROZA).filter(f => f.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(PROZA, file), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
    // если есть шапка (---...---), проверяем только тело — шапка сама по себе не текст сцены
    const hasFront = text.startsWith('---\n');
    const body = hasFront ? text.slice(text.indexOf('\n---\n', 4) + 5) : text;
    for (const term of bans) {
      if (body.includes(term)) {
        console.log(`⚠ Проза/${file}: снятая формулировка «${term}»`);
        problems++;
      }
    }
  }
}

// Игры/Сайт/Приложение/Данные — данные сайта пишутся руками, мимо канона, и снятые формулировки туда
// просачиваются так же легко. canon.js и scenes.js не смотрим: они собираются из уже
// проверенных выше блоков и прозы (в canon.js к тому же лежит журнал правок с историей отмен).
// Мини-игру не проверяем намеренно — у неё свой лорбук и своя сессия.
const DATA = path.join(ROOT, 'Игры', 'Сайт', 'Приложение', 'Данные');
const GENERATED = new Set(['canon.js', 'scenes.js']);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith('.js') ? [path.join(dir, d.name)] : []);
}
if (fs.existsSync(DATA)) {
  for (const file of walk(DATA)) {
    if (GENERATED.has(path.basename(file))) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const term of bans) {
      if (text.includes(term)) {
        console.log(`⚠ ${path.relative(ROOT, file).replace(/\\/g, '/')}: снятая формулировка «${term}»`);
        problems++;
      }
    }
  }
}

console.log(problems ? `\nНайдено ${problems} проблем.` : '\nOK: запретов не найдено, ключи на месте.');
process.exit(problems ? 1 : 0);
