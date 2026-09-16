/* Страница фракции: баннер в цвете фракции, герб, крючки, люди, связи, карта, события.
   Базовый костяк один на все фракции, но каждая несёт archetype — official/crime/wild —
   и получает лёгкий грим по CSS (см. app.css, .arche-*). Одна фракция может нести
   special:'herb' — тогда рисуется отдельная штучная страница (сейчас Свинцовые клинки). */
import { $, $$, esc, IMG, mapHTML, drawRoutes, drawPins, markPlace, placeChip, plural } from '../ui.js';
import { factionById, relationsOf, REL_LABEL } from '../../data/factions.js';
import { personById } from '../../data/people.js';
import { placeById } from '../../data/places.js';
import { ROUTES } from '../../data/routes.js';
import { EVENTS } from '../../data/events.js';
import { icon } from '../icons.js';

const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };

function mountMap(root, f, seat){
  const map = $('#map', root); if (!map) return;
  const svg = $('svg', map);
  drawRoutes(svg); map.classList.add('quiet'); drawPins(map);
  if (seat) markPlace(map, seat.id);
  const lines = svg.querySelectorAll('.route'), flows = svg.querySelectorAll('.flow');
  (f.routes || []).forEach(rid => { const i = ROUTES.findIndex(r => r.id === rid); if (i >= 0){ lines[i].classList.add('sel'); flows[i].classList.add('sel'); } });
}

export function render(root, [id]){
  const f = factionById(id);
  if (!f){ root.innerHTML = '<div class="page"><h1 class="h1">Нет такой фракции</h1><p><a href="#/factions">К фракциям</a></p></div>'; return; }
  const people = f.head.map(personById).filter(Boolean);
  const rels = relationsOf(id);
  const evs = EVENTS.map((e, i) => [e, i]).filter(([e]) => (e.people || []).some(p => f.head.includes(p)) || (f.line && e.lines.includes(f.line)));
  const seat = f.seat ? placeById(f.seat) : null;

  if (f.special === 'herb') return renderHerb(root, f, { people, rels, evs, seat });
  return renderDoc(root, f, { people, rels, evs, seat });
}

/* ─── базовый шаблон, костяк с 14.09 ─── */
function renderDoc(root, f, { people, rels, evs, seat }){
  const bg = "background-image:url('" + IMG + 'factions/' + f.id + ".jpg'),radial-gradient(circle at 82% 45%," + rgba(f.color, .32) + ",transparent 55%),repeating-linear-gradient(135deg,rgba(255,255,255,.03) 0 2px,transparent 2px 16px)";

  root.innerHTML = `<div class="fpage arche-${f.archetype || 'official'}" style="--fc:${f.color}" data-title="${esc(f.name)}">
    <header class="fhero" style="${bg}">
      <div class="fem">${icon(f.icon, 150)}</div>
      <div class="fcap">
        <div class="eyebrow"><a href="#/factions">фракции</a> · ${esc(f.kind)}</div>
        <h1 class="h1">${esc(f.name)}</h1>
        <div class="fmeta">${f.guarantee ? '<span class="fguar">ручается ' + esc(f.guarantee) + '</span>' : ''}${f.size ? '<span>' + esc(f.size) + '</span>' : ''}${seat ? placeChip(seat.id) : ''}</div>
      </div>
    </header>
    <div class="fgrid">
      <div>
        <div class="prose">${f.text.map(t => '<p>' + esc(t) + '</p>').join('')}</div>
        ${f.hooks && f.hooks.length ? '<section class="card fhooks"><h3>КРЮЧКИ</h3><ul>' + f.hooks.map(h => '<li>' + esc(h) + '</li>').join('') + '</ul></section>' : ''}
        <section class="card fevs"><h3>В ХРОНИКЕ <small>${evs.length}</small></h3>
          ${evs.length ? evs.map(([e, i]) => '<a class="fev" href="#/chronicle/' + i + '"><span>' + esc(e.y) + '</span><div><b>' + esc(e.h) + '.</b> ' + esc(e.t) + '</div></a>').join('') : '<p class="locked" style="padding:0 16px 14px">Событий с людьми этой фракции пока нет.</p>'}
        </section>
      </div>
      <aside class="fside">
        <section class="card"><h3>ЛЮДИ <small>${people.length}</small></h3><div class="fpeople">
          ${people.length ? people.map(p => '<a class="pcard" href="#/person/' + p.id + '">' + '<img class="av" src="' + IMG + (p.img || 'faces/' + p.id + '.jpg') + '" alt="" data-initial="' + esc(p.name[0]) + '" onerror="kordimNoImg(this)">' + '<div><b>' + esc(p.name) + '</b><small>' + esc(p.role) + '</small></div></a>').join('') : '<p class="locked">Люди этой фракции ещё не заведены.</p>'}
        </div></section>
        <section class="card"><h3>СВЯЗИ <small>${rels.length}</small></h3>
          ${rels.length ? rels.map(r => { const o = factionById(r.other); return '<a class="rel" href="#/faction/' + o.id + '" style="--oc:' + o.color + '"><span class="t ' + r.type + '">' + REL_LABEL[r.type] + '</span><div><b>' + icon(o.icon, 15) + ' ' + esc(o.name) + '</b><small>' + esc(r.text) + '</small></div></a>'; }).join('') : '<p class="locked" style="padding:0 16px 14px">Связей пока не записано.</p>'}
        </section>
        <section class="card c-map"><div class="mhead"><b style="font-weight:500">${seat ? 'Где сидят' : 'Без одного места'}</b><a href="#/map">общая карта</a></div>
          <div class="map" id="map" style="margin:0 12px 12px;border-radius:12px;flex:none">${mapHTML()}</div></section>
      </aside>
    </div>
  </div>`;

  mountMap(root, f, seat);
}

/* ─── штучное оформление: «Герб» ─── */
function renderHerb(root, f, { people, rels, evs, seat }){
  const R = 190, cx = 230, cy = 230;
  const orbit = rels.map((r, i) => {
    const o = factionById(r.other);
    const ang = (i / (rels.length || 1)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R;
    return `<a href="#/faction/${o.id}" style="left:${x}px;top:${y}px;--oc:${o.color}"><span class="dot">${icon(o.icon, 18)}</span><b>${esc(o.name)}</b></a>`;
  }).join('');

  root.innerHTML = `<div class="fherb" style="--fc:${f.color}" data-title="${esc(f.name)}">
    <div class="fherb-em">${icon(f.icon, 88)}</div>
    <div class="eyebrow"><a href="#/factions">← фракции</a> · ${esc(f.kind)}</div>
    <h1 class="h1">${esc(f.name)}</h1>
    ${f.quote ? '<div class="fherb-quote">' + esc(f.quote) + '</div>' : ''}
    <div class="fherb-stats">${f.guarantee ? '<div><b>' + esc(f.guarantee) + '</b>ручается</div>' : ''}${f.size ? '<div><b>' + esc(f.size.split(',')[0]) + '</b>сила</div>' : ''}<div><b>${rels.length}</b>${plural(rels.length, ['связь', 'связи', 'связей'])}</div></div>
    ${rels.length ? `<div class="fherb-orbit"><div class="core">${esc(f.name)}</div>${orbit}</div>` : ''}
    <div class="fherb-prose">${f.text.map(t => '<p>' + esc(t) + '</p>').join('')}</div>
    ${f.hooks && f.hooks.length ? '<div class="fherb-hooks">' + f.hooks.map(h => '<div>' + esc(h) + '</div>').join('') + '</div>' : ''}
    ${people.length ? '<div class="fherb-folk">' + people.map(p => '<a href="#/person/' + p.id + '"><img class="av" src="' + IMG + (p.img || 'faces/' + p.id + '.jpg') + '" alt="" data-initial="' + esc(p.name[0]) + '" onerror="kordimNoImg(this)">' + esc(p.name) + '</a>').join('') + '</div>' : ''}
    <section class="card c-map"><div class="mhead"><b style="font-weight:500">${seat ? 'Где сидят' : 'Без одного места'}</b><a href="#/map">общая карта</a></div>
      <div class="map" id="map" style="margin:0 12px 12px;border-radius:12px;flex:none">${mapHTML()}</div></section>
    ${evs.length ? '<div class="fherb-evs">' + evs.map(([e, i]) => '<a class="fev" href="#/chronicle/' + i + '"><span>' + esc(e.y) + '</span><div><b>' + esc(e.h) + '.</b> ' + esc(e.t) + '</div></a>').join('') + '</div>' : ''}
  </div>`;

  mountMap(root, f, seat);
}
