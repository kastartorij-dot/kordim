// Проверяет данные вики (Игры/Сайт/Приложение/Данные) на битые перекрёстные ссылки: событие ссылается
// на несуществующего человека, фракция — на несуществующее место, и так далее. Не проверяет
// смысл (совпадение с каноном) — только что все id, на которые ссылаются, реально существуют.
// Ничего не чинит, только печатает отчёт.
//
// node Канон/_Сборка/check-data.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = path.join(ROOT, 'Игры', 'Сайт', 'Приложение', 'Данные');
const load = rel => import(pathToFileURL(path.join(DATA, rel)).href);

const { PEOPLE } = await load('people.js');
const { PLACES } = await load('places.js');
const { FACTIONS, RELATIONS } = await load('factions.js');
const { EVENTS, LINES } = await load('events.js');
const { ROUTES } = await load('routes.js');
const { CHARGED } = await load('questions.js');
const { ARTICLES } = await load('articles.js');
const { CANON } = await load('canon.js');
const { SOURCES } = await load('sources.js');

const peopleIds = new Set(PEOPLE.map(p => p.id));
const placeIds = new Set(PLACES.map(p => p.id));
const factionIds = new Set(FACTIONS.map(f => f.id));
const routeIds = new Set(ROUTES.map(r => r.id));

let problems = 0;
const bad = (where, kind, id) => { console.log(`⚠ ${where}: ${kind} «${id}» не найден`); problems++; };

PEOPLE.forEach(p => { if (p.place && !placeIds.has(p.place)) bad(`people.js: ${p.id}`, 'место', p.place); });

PLACES.forEach(pl => {}); // мест друг на друга не ссылаются

FACTIONS.forEach(f => {
  if (f.seat && !placeIds.has(f.seat)) bad(`factions.js: ${f.id}`, 'место (seat)', f.seat);
  (f.head || []).forEach(id => { if (!peopleIds.has(id)) bad(`factions.js: ${f.id}`, 'человек (head)', id); });
  (f.routes || []).forEach(id => { if (!routeIds.has(id)) bad(`factions.js: ${f.id}`, 'тракт (routes)', id); });
});
RELATIONS.forEach(([a, b], i) => {
  if (!factionIds.has(a)) bad(`factions.js: RELATIONS[${i}]`, 'фракция', a);
  if (!factionIds.has(b)) bad(`factions.js: RELATIONS[${i}]`, 'фракция', b);
});

EVENTS.forEach((e, i) => {
  if (e.place && !placeIds.has(e.place)) bad(`events.js: EVENTS[${i}] (${e.h})`, 'место', e.place);
  (e.people || []).forEach(id => { if (!peopleIds.has(id)) bad(`events.js: EVENTS[${i}] (${e.h})`, 'человек', id); });
  (e.lines || []).forEach(id => { if (!(id in LINES)) bad(`events.js: EVENTS[${i}] (${e.h})`, 'сюжетная линия', id); });
});
// slug нужен каждому событию: по нему к событию привязывается сцена из Проза/*.md
const slugSeen = new Map();
EVENTS.forEach((e, i) => {
  if (!e.slug) { console.log(`⚠ events.js: EVENTS[${i}] (${e.h}): нет slug — сцену к событию не привязать`); problems++; return; }
  if (slugSeen.has(e.slug)) { console.log(`⚠ events.js: slug «${e.slug}» повторяется (${slugSeen.get(e.slug)} и ${e.h})`); problems++; }
  slugSeen.set(e.slug, e.h);
});

ROUTES.forEach(r => {
  if (!placeIds.has(r.from)) bad(`routes.js: ${r.id}`, 'место (from)', r.from);
  if (!placeIds.has(r.to)) bad(`routes.js: ${r.id}`, 'место (to)', r.to);
  for (const st of r.stops || []) {
    if (!placeIds.has(st.place)) bad(`routes.js: ${r.id}`, 'место (stops)', st.place);
    if (!(st.i > 0 && st.i < r.p.length - 1)) { console.log(`⚠ routes.js: ${r.id}: остановка ${st.place} не посреди линии p`); problems++; }
  }
  const modes = ['horse', 'foot', 'cart'];
  for (const mode of r.winterClosed || []) {
    if (!modes.includes(mode)) { console.log(`⚠ routes.js: ${r.id}: неизвестный способ в winterClosed: ${mode}`); problems++; }
  }
  for (const [mode, range] of Object.entries(r.days || {})) {
    if (!modes.includes(mode) || !Array.isArray(range) || range.length !== 2 || !range.every(d => Number.isFinite(d) && d > 0) || range[0] > range[1]) {
      console.log(`⚠ routes.js: ${r.id}: неверный диапазон дней для ${mode}`); problems++;
    }
  }
});

CHARGED.forEach(([title, , ppl], i) => {
  (ppl || []).forEach(id => { if (!peopleIds.has(id)) bad(`questions.js: CHARGED «${title}»`, 'человек', id); });
});

// «Заряжено» на сайте переписано руками с приложения канона и уже однажды отстало (11 из 16).
// Смысл не сверяем — только число пунктов, чтобы новый пункт в каноне не потерялся по дороге.
const chargedMd = fs.readFileSync(path.join(ROOT, 'Канон', 'Приложения', 'что-заряжено.md'), 'utf8');
const chargedCanon = (chargedMd.match(/^\d+\.\s/gm) || []).length;
if (chargedCanon !== CHARGED.length) {
  console.log(`⚠ questions.js: «Заряжено» ${CHARGED.length} пунктов, в Канон/Приложения/что-заряжено.md — ${chargedCanon}`);
  problems++;
}

// Торговля на карте (trade.js): места, тракты и ресурсы рычагов существуют.
const { RESOURCES, LEVERS } = await load('trade.js');
const resIds = new Set(RESOURCES.map(r => r.id));
RESOURCES.forEach(r => { r.places.forEach(id => { if (!placeIds.has(id)) bad('trade.js: ' + r.id, 'место', id); });
  r.routes.forEach(id => { if (!routeIds.has(id)) bad('trade.js: ' + r.id, 'тракт', id); }); });
LEVERS.forEach(l => { if (l.place && !placeIds.has(l.place)) bad('trade.js: ' + l.id, 'место', l.place);
  l.routes.forEach(id => { if (!routeIds.has(id)) bad('trade.js: ' + l.id, 'тракт', id); });
  l.hits.forEach(id => { if (!resIds.has(id)) bad('trade.js: ' + l.id, 'ресурс', id); }); });

// Любая карточка ведёт к существующим блокам; опечатка в привязке не скрывается в интерфейсе.
const sourceTargets = {people:PEOPLE, places:PLACES, factions:FACTIONS, articles:ARTICLES, events:EVENTS};
const sourceId = (kind, item) => kind === 'events' ? item.slug : item.id;
for (const [kind, entries] of Object.entries(SOURCES)) {
  if (!sourceTargets[kind]) { bad('sources.js', 'раздел справочника', kind); continue; }
  const ids = new Set(sourceTargets[kind].map(x => sourceId(kind, x)));
  for (const [id, refs] of Object.entries(entries)) {
    if (!ids.has(id)) bad('sources.js: ' + kind, 'карточка', id);
    const seen = new Set();
    for (const [group, key] of refs) {
      if (!(CANON[group] || []).some(x => String(x.id ?? x.title) === String(key))) bad('sources.js: ' + kind + '/' + id, 'блок канона', group + '/' + key);
      const ref = group + '/' + key;
      if (seen.has(ref)) { console.log('⚠ sources.js: повтор источника ' + kind + '/' + id + ': ' + ref); problems++; }
      seen.add(ref);
    }
  }
}
for (const [kind, entries] of Object.entries(sourceTargets)) {
  for (const item of entries) {
    if (!SOURCES[kind]?.[sourceId(kind, item)]?.length) { console.log('⚠ sources.js: нет источников для ' + kind + '/' + sourceId(kind, item)); problems++; }
  }
}

// У каждой картинки, на которую ссылаются данные, есть файл в Игры/Сайт/Изображения (пути вида «Лица/x.jpg»).
// Портрет без поля img ищется как Лица/<id>.jpg и молча пропадает — это не ошибка, а пустое место.
const IMAGES = path.join(ROOT, 'Игры', 'Сайт', 'Изображения');
const IMG_RE = /^[^\s/][^\s]*\.(jpe?g|png|webp|gif|svg)$/i;
const SKIP = new Set(['canon.js', 'scenes.js', 'plan.js', 'journal.js']);
const dataFiles = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(d =>
  d.isDirectory() ? dataFiles(path.join(dir, d.name)) : d.name.endsWith('.js') && !SKIP.has(d.name) ? [path.join(dir, d.name)] : []);
const walkImages = (value, seen, out) => {
  if (typeof value === 'string') { if (IMG_RE.test(value)) out.add(value); return; }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  Object.values(value).forEach(v => walkImages(v, seen, out));
};
const imageUse = new Map(); // путь картинки → файлы данных, где она встречается
for (const file of dataFiles(DATA)) {
  const found = new Set();
  walkImages(await import(pathToFileURL(file).href), new Set(), found);
  for (const rel of found) imageUse.set(rel, [...(imageUse.get(rel) || []), path.relative(DATA, file)]);
}
for (const [rel, files] of imageUse) if (!fs.existsSync(path.join(IMAGES, rel))) bad(files.join(', '), 'файл картинки', rel);
console.log(`Картинок в данных: ${imageUse.size}.`);

console.log(problems ? `\nНайдено ${problems} проблем.` : '\nOK: все перекрёстные ссылки в данных вики целы.');
process.exit(problems ? 1 : 0);
