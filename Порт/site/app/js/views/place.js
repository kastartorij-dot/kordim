import { $, esc, IMG, mapHTML, drawRoutes, drawPins, markPlace, markRoute, personChip } from '../ui.js';
import { placeById } from '../../data/places.js';
import { ROUTES } from '../../data/routes.js';
import { PEOPLE } from '../../data/people.js';
import { FACTIONS } from '../../data/factions.js';

export function render(root, [id]){
  const p = placeById(id);
  if (!p){ root.innerHTML = '<div class="page"><h1 class="h1">Нет такого места</h1><p><a href="#/places">К списку мест</a></p></div>'; return; }
  const routes = ROUTES.filter(r => r.from === id || r.to === id);
  const here = PEOPLE.filter(x => x.place === id);
  const facs = FACTIONS.filter(f => f.seat === id);
  root.innerHTML = `<div class="place" data-title="${esc(p.name)}">
    <div>
      <div class="hero" style="${p.img ? "background-image:url('" + IMG + p.img + "')" : ''}">
        <div class="cap"><div class="eyebrow"><a href="#/places">места</a> · ${esc(p.kind)} · ${esc(p.pop)}</div><h1 class="h1" style="margin:6px 0 0">${esc(p.name)}</h1></div>
      </div>
      <div class="prose" style="margin-top:22px">
        <p style="font-size:20px">${esc(p.lead)}</p>
        ${p.senses ? '<p class="plsense">' + esc(p.senses) + '</p>' : ''}
        ${p.text.map(t => '<p>' + esc(t) + '</p>').join('')}
        ${p.danger ? '<p><span class="badge">опасность</span> ' + esc(p.danger) + '</p>' : ''}
        ${p.parts && p.parts.length ? '<h2>Что там есть</h2><div class="parts">' + p.parts.map(([h, t]) => '<div class="card part"><b>' + esc(h) + '</b><p>' + esc(t) + '</p></div>').join('') + '</div>' : ''}
        ${here.length ? '<h2>Кто здесь</h2><div>' + here.map(x => personChip(x.id)).join('') + '</div>' : ''}
        ${facs.length ? '<h2>Кто держит</h2><div>' + facs.map(f => '<a class="chip" href="#/faction/' + f.id + '">' + esc(f.name) + '</a>').join('') + '</div>' : ''}
        <div class="pending">Подробная карта места ещё не нарисована.</div>
      </div>
    </div>
    <div style="display:grid;gap:18px;align-content:start">
      <section class="card c-map"><div class="mhead"><b style="font-weight:500">На карте</b><a href="#/map">общая карта</a></div>
        <div class="map" id="map" style="margin:0 12px 12px;border-radius:12px">${mapHTML()}</div></section>
      <section class="card"><h3>ТРАКТЫ ОТСЮДА</h3><ul class="list">${routes.length ? routes.map(r => '<li><b>' + esc(r.n) + '</b> · ' + esc(r.e) + '<div style="color:var(--mute);font-size:13px">' + esc(r.holder) + '</div></li>').join('') : '<li class="empty">Трактов нет или они не описаны.</li>'}</ul></section>
    </div>
  </div>`;
  const map = $('#map', root);
  drawRoutes($('svg', map)); drawPins(map); markPlace(map, id);
  routes.forEach(r => $('svg', map).querySelectorAll('.route')[ROUTES.indexOf(r)].classList.add('sel'));
  if (p.x == null) $('.mhead b', root).textContent = 'Точного места на карте нет';
}
