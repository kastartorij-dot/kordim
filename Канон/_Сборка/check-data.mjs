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

console.log(problems ? `\nНайдено ${problems} проблем.` : '\nOK: все перекрёстные ссылки в данных вики целы.');
process.exit(problems ? 1 : 0);
