/* Страница фракции: баннер в цвете фракции, герб, крючки, люди, связи, карта, события. */
import { $, $$, esc, IMG, mapHTML, drawRoutes, drawPins, markPlace, placeChip } from '../ui.js';
import { factionById, relationsOf, REL_LABEL } from '../../data/factions.js';
import { personById } from '../../data/people.js';
import { placeById } from '../../data/places.js';
import { ROUTES } from '../../data/routes.js';
import { EVENTS } from '../../data/events.js';
import { icon } from '../icons.js';

const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };

export function render(root, [id]){
  const f = factionById(id);
  if (!f){ root.innerHTML = '<div class="page"><h1 class="h1">Нет такой фракции</h1><p><a href="#/factions">К фракциям</a></p></div>'; return; }
  const people = f.head.map(personById).filter(Boolean);
  const rels = relationsOf(id);
  const evs = EVENTS.map((e, i) => [e, i]).filter(([e]) => (e.people || []).some(p => f.head.includes(p)) || (f.line && e.lines.includes(f.line)));
  const seat = f.seat ? placeById(f.seat) : null;
  const bg = "background-image:url('" + IMG + 'factions/' + f.id + ".jpg'),radial-gradient(circle at 82% 45%," + rgba(f.color, .32) + ",transparent 55%),repeating-linear-gradient(135deg,rgba(255,255,255,.03) 0 2px,transparent 2px 16px)";

  root.innerHTML = `<div class="fpage" style="--fc:${f.color}" data-title="${esc(f.name)}">
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

  const map = $('#map', root), svg = $('svg', map);
  drawRoutes(svg); map.classList.add('quiet'); drawPins(map);
  if (seat) markPlace(map, seat.id);
  const lines = svg.querySelectorAll('.route'), flows = svg.querySelectorAll('.flow');
  (f.routes || []).forEach(rid => { const i = ROUTES.findIndex(r => r.id === rid); if (i >= 0){ lines[i].classList.add('sel'); flows[i].classList.add('sel'); } });
}
