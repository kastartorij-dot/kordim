/* Роутер, навигация и поиск. Каждый раздел — модуль в views/ с функцией render(root, params). */
import { $, $$, esc } from './ui.js';
import { PEOPLE } from '../data/people.js';
import { PLACES } from '../data/places.js';
import { FACTIONS } from '../data/factions.js';
import { ARTICLES } from '../data/articles.js';
import { EVENTS } from '../data/events.js';

import * as home from './views/home.js';
import * as people from './views/people.js';
import * as person from './views/person.js';
import * as places from './views/places.js';
import * as place from './views/place.js';
import * as factions from './views/factions.js';
import * as faction from './views/faction.js';
import * as atlas from './views/atlas.js';
import * as chronicle from './views/chronicle.js';
import * as world from './views/world.js';
import * as questions from './views/questions.js';
import * as canon from './views/canon.js';
import * as game from './views/game.js';
import { CANON } from '../data/canon.js';

/* нет файла портрета — вместо картинки буква имени */
window.kordimNoImg = img => { const s = document.createElement('span'); s.className = img.className; s.textContent = img.dataset.initial || ''; img.replaceWith(s); };

const NAV = [
  ['', 'Главная', home],
  ['people', 'Люди', people],
  ['places', 'Места', places],
  ['factions', 'Фракции', factions],
  ['map', 'Карта', atlas],
  ['chronicle', 'Хроника', chronicle],
  ['world', 'Мир', world],
  ['canon', 'Канон', canon],
  ['questions', 'Вопросы', questions],
  ['game', 'Игра', game]
];
const DETAIL = { person:[person, 'people'], place:[place, 'places'], faction:[faction, 'factions'] };

$('#nav').innerHTML = NAV.map(([k, label]) => '<a href="#/' + k + '" data-k="' + k + '">' + label + '</a>').join('');

const view = $('#view');
let cleanup = null;
function route(){
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
  const [head = '', ...rest] = parts;
  let mod, navKey;
  if (DETAIL[head]){ [mod, navKey] = DETAIL[head]; }
  else { const n = NAV.find(x => x[0] === head) || NAV[0]; mod = n[2]; navKey = n[0]; }
  $$('#nav a').forEach(a => a.setAttribute('aria-current', a.dataset.k === navKey ? 'page' : 'false'));
  /* на телефоне разделы лежат прокручиваемой полосой — подводим текущий в поле зрения */
  const cur = $('#nav a[aria-current="page"]'), nav = $('#nav');
  if (cur && nav.scrollWidth > nav.clientWidth + 4) cur.scrollIntoView({inline:'center', block:'nearest'});
  if (cleanup){ try { cleanup(); } catch (e) {} cleanup = null; }
  document.body.removeAttribute('data-season'); document.body.removeAttribute('data-night');
  view.innerHTML = '';
  view.className = 'enter'; void view.offsetWidth;
  cleanup = mod.render(view, rest) || null;
  if (!rest.length || head !== 'world') scrollTo(0, 0);
  const title = view.querySelector('[data-title]');
  document.title = (title ? title.dataset.title + ' · ' : '') + 'Кордим';
}
addEventListener('hashchange', route);
route();

/* ─── поиск Ctrl+K ─── */
const INDEX = [
  ...PEOPLE.map(p => ({t:p.name + (p.alias ? ' ' + p.alias : ''), k:'человек', h:'#/person/' + p.id})),
  ...PLACES.map(p => ({t:p.name, k:'место', h:'#/place/' + p.id})),
  ...FACTIONS.map(f => ({t:f.name, k:'фракция', h:'#/faction/' + f.id})),
  ...ARTICLES.map(a => ({t:a.title, k:'мир', h:'#/world/' + a.id})),
  ...EVENTS.map((e, i) => ({t:e.y + ' — ' + e.h, s:e.y + ' ' + e.h + ' ' + e.t, k:'хроника', h:'#/chronicle/' + i})),
  /* весь канон, не только лорбук: герои, правила ведения и приложения искались мимо */
  ...['герои', 'правила', 'записи', 'приложения'].flatMap(g => CANON[g].map(r =>
    ({t:r.title, s:r.title + ' ' + (r.ключи || []).join(' '), k:'канон', h:'#/canon/' + encodeURIComponent(canon.canonKey(g, r))})))
];
const pal = $('#pal'), inp = $('#palIn'), res = $('#palRes');
let hits = [], at = 0;
function paint(){
  const q = inp.value.trim().toLowerCase();
  hits = (q ? INDEX.filter(x => (x.s || x.t).toLowerCase().includes(q)) : INDEX.slice(0, 12)).slice(0, 30);
  at = Math.min(at, Math.max(0, hits.length - 1));
  res.innerHTML = hits.length ? hits.map((x, i) => '<a href="' + x.h + '" class="' + (i === at ? 'on' : '') + '">' + esc(x.t) + '<small>' + x.k + '</small></a>').join('') : '<div class="empty" style="padding:14px 18px">Ничего не нашлось.</div>';
}
function open(){ pal.hidden = false; inp.value = ''; at = 0; paint(); inp.focus(); }
function close(){ pal.hidden = true; }
$('#findbtn').onclick = open;
inp.oninput = () => { at = 0; paint(); };
res.onclick = close;
pal.onclick = e => { if (e.target === pal) close(); };
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); pal.hidden ? open() : close(); }
  if (pal.hidden) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowDown'){ e.preventDefault(); at = Math.min(hits.length - 1, at + 1); paint(); }
  if (e.key === 'ArrowUp'){ e.preventDefault(); at = Math.max(0, at - 1); paint(); }
  if (e.key === 'Enter' && hits[at]){ location.hash = hits[at].h; close(); }
});
