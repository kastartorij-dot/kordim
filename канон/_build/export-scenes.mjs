// Собирает проза/*.md в wiki/app/data/scenes.js для раздела «Арки».
// Шапка сцены — title/event/status, plus необязательный arc. Люди, место и сюжетная линия
// (line) НЕ дублируются — берутся из связанного события в events.js по полю event (slug).
// arc — ключ плитки-группировки на странице «Арки»: своя история, не сюжетная линия.
// По умолчанию arc = slug события (одна история — одна плитка); если несколько файлов
// сцен относятся к одной истории (главы одной арки), проставь им одинаковый `arc:` в
// шапке — они соберутся в одну плитку и один непрерывный текст.
// Порядок сцен внутри арки при сборке «читать всей аркой» — по s связанного события,
// а не по ручной нумерации: вставил сцену на более раннее время — она сама встанет на место.
//
// node канон/_build/export-scenes.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROZA = path.join(ROOT, 'проза');
const OUT = path.join(ROOT, 'wiki', 'app', 'data', 'scenes.js');

const { EVENTS } = await import(pathToFileURL(path.join(ROOT, 'wiki', 'app', 'data', 'events.js')).href);
const eventBySlug = slug => EVENTS.find(e => e.slug === slug);

function readScene(file) {
  const text = fs.readFileSync(path.join(PROZA, file), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  if (lines[0] !== '---') throw new Error(`${file}: нет YAML-шапки (title/event/status)`);
  let close = -1;
  for (let i = 1; i < lines.length; i++) if (lines[i] === '---') { close = i; break; }
  if (close < 0) throw new Error(`${file}: не нашёл закрывающую черту шапки`);
  const front = {};
  for (let i = 1; i < close; i++) {
    const m = lines[i].match(/^([a-zа-я]+):\s*(.*)$/i);
    if (m) front[m[1]] = m[2].trim();
  }
  const body = lines.slice(close + 1).join('\n').trim();
  if (!front.title) throw new Error(`${file}: нет title в шапке`);
  if (!front.event) throw new Error(`${file}: нет event в шапке — на какое событие хроники ссылается сцена?`);
  const ev = eventBySlug(front.event);
  if (!ev) throw new Error(`${file}: event «${front.event}» не найден в events.js (нет такого slug)`);

  const words = body.split(/\s+/).filter(Boolean).length;
  return {
    id: file.replace(/\.md$/, ''),
    title: front.title,
    status: front.status || 'готово',
    event: front.event,
    arc: front.arc || ev.slug,
    line: (ev.lines && ev.lines[0]) || null,
    s: ev.s,
    people: ev.people || [],
    place: ev.place || null,
    words,
    text: body,
  };
}

const files = fs.readdirSync(PROZA).filter(f => f.endsWith('.md'));
const scenes = files.map(readScene).sort((a, b) => a.s - b.s);

const out = `// СГЕНЕРИРОВАНО из проза/*.md скриптом канон/_build/export-scenes.mjs — руками не редактировать.
// Текст сцены редактируется в проза/<файл>.md, здесь только пересобирается.
export const SCENES = ${JSON.stringify(scenes, null, 2)};
export const sceneById = id => SCENES.find(s => s.id === id);
export const scenesOf = arc => SCENES.filter(s => s.arc === arc).sort((a, b) => a.s - b.s);
`;
fs.writeFileSync(OUT, out);
console.log(`OK: ${scenes.length} сцен(ы) → wiki/app/data/scenes.js`);
for (const s of scenes) console.log(`  ${s.id} · арка «${s.arc}» · ${s.words} слов · ${s.status}`);
