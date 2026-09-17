// «Карта тишины»: где мир пока молчит — люди вне хроники, места без жителей и событий,
// нет портрета, вида места, иллюстрации события, обложки статьи, полного профиля.
// Это не проверка и ничего не роняет: просто список, куда расти. Ничего не пишет.
//
// node канон/_build/silence.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = path.join(ROOT, 'wiki', 'app', 'data');
const IMG = path.join(ROOT, 'wiki', 'img');
const load = rel => import(pathToFileURL(path.join(DATA, rel)).href);
const img = rel => rel && fs.existsSync(path.join(IMG, rel));

const { PEOPLE } = await load('people.js');
const { PLACES } = await load('places.js');
const { FACTIONS } = await load('factions.js');
const { EVENTS } = await load('events.js');
const { ARTICLES } = await load('articles.js');
const { SCENES } = await load('scenes.js');

const inEvents = new Set(EVENTS.flatMap(e => e.people || []));

function section(title, items, total) {
  console.log(`\n${title} — ${items.length}${total != null ? ' из ' + total : ''}`);
  if (items.length) console.log('  ' + items.join(', '));
}

section('Люди, которых нет ни в одном событии хроники',
  PEOPLE.filter(p => !inEvents.has(p.id)).map(p => p.name), PEOPLE.length);
section('Люди без портрета (файла нет)',
  PEOPLE.filter(p => !img(p.img)).map(p => p.name), PEOPLE.length);
section('Люди без полного профиля (шкала лет, вещи, разговор)',
  PEOPLE.filter(p => !p.profile).map(p => p.name), PEOPLE.length);

section('Места без жителей в реестре людей',
  PLACES.filter(pl => !PEOPLE.some(p => p.place === pl.id)).map(pl => pl.name), PLACES.length);
section('Места без событий в хронике',
  PLACES.filter(pl => !EVENTS.some(e => e.place === pl.id)).map(pl => pl.name), PLACES.length);
section('Места, где не сидит ни одна фракция',
  PLACES.filter(pl => !FACTIONS.some(f => f.seat === pl.id)).map(pl => pl.name), PLACES.length);
section('Места без вида (картинки)',
  PLACES.filter(pl => !img(pl.img)).map(pl => pl.name), PLACES.length);
section('Места без пина на карте',
  PLACES.filter(pl => pl.x == null || pl.y == null).map(pl => pl.name), PLACES.length);

const key = EVENTS.filter(e => e.key);
section('Ключевые события без своей иллюстрации (img/events/<slug>.jpg)',
  key.filter(e => !img('events/' + e.slug + '.jpg')).map(e => e.h), key.length);
const scened = new Set(SCENES.map(s => s.event));
section('Ключевые события без написанной сцены',
  key.filter(e => !scened.has(e.slug)).map(e => e.h), key.length);

section('Статьи «Мир» без обложки (img/world/<id>.jpg)',
  ARTICLES.filter(a => !img('world/' + a.id + '.jpg')).map(a => a.title), ARTICLES.length);

section('Фракции без главы в реестре людей',
  FACTIONS.filter(f => !(f.head || []).length).map(f => f.name), FACTIONS.length);

console.log('\n(Хада заморожен 15.09 — его пропуски ожидаемы.)');
