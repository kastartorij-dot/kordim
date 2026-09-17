// Проверяет данные вики (wiki/app/data) на битые перекрёстные ссылки: событие ссылается
// на несуществующего человека, фракция — на несуществующее место, и так далее. Не проверяет
// смысл (совпадение с каноном) — только что все id, на которые ссылаются, реально существуют.
// Ничего не чинит, только печатает отчёт.
//
// node канон/_build/check-data.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = path.join(ROOT, 'wiki', 'app', 'data');
const load = rel => import(pathToFileURL(path.join(DATA, rel)).href);

const { PEOPLE } = await load('people.js');
const { PLACES } = await load('places.js');
const { FACTIONS, RELATIONS } = await load('factions.js');
const { EVENTS, LINES } = await load('events.js');
const { ROUTES } = await load('routes.js');
const { CHARGED } = await load('questions.js');

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
// slug нужен каждому событию: по нему к событию привязывается сцена из проза/*.md
const slugSeen = new Map();
EVENTS.forEach((e, i) => {
  if (!e.slug) { console.log(`⚠ events.js: EVENTS[${i}] (${e.h}): нет slug — сцену к событию не привязать`); problems++; return; }
  if (slugSeen.has(e.slug)) { console.log(`⚠ events.js: slug «${e.slug}» повторяется (${slugSeen.get(e.slug)} и ${e.h})`); problems++; }
  slugSeen.set(e.slug, e.h);
});

ROUTES.forEach(r => {
  if (!placeIds.has(r.from)) bad(`routes.js: ${r.id}`, 'место (from)', r.from);
  if (!placeIds.has(r.to)) bad(`routes.js: ${r.id}`, 'место (to)', r.to);
});

CHARGED.forEach(([title, , ppl], i) => {
  (ppl || []).forEach(id => { if (!peopleIds.has(id)) bad(`questions.js: CHARGED «${title}»`, 'человек', id); });
});

// «Заряжено» на сайте переписано руками с приложения канона и уже однажды отстало (11 из 16).
// Смысл не сверяем — только число пунктов, чтобы новый пункт в каноне не потерялся по дороге.
const chargedMd = fs.readFileSync(path.join(ROOT, 'канон', 'приложения', 'что-заряжено.md'), 'utf8');
const chargedCanon = (chargedMd.match(/^\d+\.\s/gm) || []).length;
if (chargedCanon !== CHARGED.length) {
  console.log(`⚠ questions.js: «Заряжено» ${CHARGED.length} пунктов, в канон/приложения/что-заряжено.md — ${chargedCanon}`);
  problems++;
}

console.log(problems ? `\nНайдено ${problems} проблем.` : '\nOK: все перекрёстные ссылки в данных вики целы.');
process.exit(problems ? 1 : 0);
