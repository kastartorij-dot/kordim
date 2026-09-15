/* Общая карта: сезоны, ночь, способ пути, «в путь», панорама и масштаб. */
import { $, $$, esc, mapHTML, drawRoutes, drawPins, markRoute, daysFor, closedFor, travel, fmt, MODE_LABEL } from '../ui.js';
import { ROUTES } from '../../data/routes.js';
import { placeById } from '../../data/places.js';

export function render(root){
  const S = {season:'autumn', mode:'horse', route:1, night:false};
  document.body.dataset.season = S.season; document.body.dataset.night = '0';
  root.innerHTML = `<div class="atlas" id="atlas" data-title="Карта">
    <div class="world" id="world"><div class="map" id="map">${mapHTML('<div class="weather snow"></div><div class="weather rain"></div><div class="token" id="token" hidden>🐴</div>')}</div></div>
    <div class="float atlas-bar">
      <div class="seg" role="group" aria-label="Время года"><button data-s="summer" aria-pressed="false">☀ Лето</button><button data-s="autumn" aria-pressed="true">🍂 Осень</button><button data-s="winter" aria-pressed="false">❄ Зима</button></div>
      <div class="seg"><button id="night" aria-pressed="false">☾ Ночь</button></div>
      <div class="seg" role="group" aria-label="Способ">${Object.entries(MODE_LABEL).map(([k, l]) => '<button data-m="' + k + '" aria-pressed="' + (k === 'horse') + '">' + l[0].toUpperCase() + l.slice(1) + '</button>').join('')}</div>
    </div>
    <section class="float atlas-card" id="card"></section>
    <div class="float atlas-hint">тяни мышью · колесо — масштаб · нажми тракт или город</div>
  </div>`;

  const atlas = $('#atlas', root), world = $('#world', root), map = $('#map', root), svg = $('svg', map);
  drawRoutes(svg, i => { S.route = i; paint(); });
  drawPins(map, id => { location.hash = '#/place/' + id; });

  /* панорама */
  let z = 1, tx = 0, ty = 0, drag = null;
  const apply = () => world.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')';
  function fit(){ const w = world.offsetWidth, h = world.offsetHeight; z = Math.max(atlas.clientWidth / w, atlas.clientHeight / h) * 1.02; tx = (atlas.clientWidth - w * z) / 2; ty = (atlas.clientHeight - h * z) / 2; apply(); }
  fit();
  const onResize = () => fit(); addEventListener('resize', onResize);
  atlas.onpointerdown = e => { if (e.target.closest('.float,.route,.pin')) return; drag = [e.clientX - tx, e.clientY - ty]; atlas.classList.add('drag'); atlas.setPointerCapture(e.pointerId); };
  atlas.onpointermove = e => { if (!drag) return; tx = e.clientX - drag[0]; ty = e.clientY - drag[1]; apply(); };
  atlas.onpointerup = () => { drag = null; atlas.classList.remove('drag'); };
  atlas.onwheel = e => { if (e.target.closest('.float')) return; e.preventDefault(); const r = atlas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const nz = Math.min(3, Math.max(.35, z * (e.deltaY < 0 ? 1.12 : .89))); tx = mx - (mx - tx) * nz / z; ty = my - (my - ty) * nz / z; z = nz; apply(); };

  $$('[data-s]', root).forEach(b => b.onclick = () => { S.season = b.dataset.s; document.body.dataset.season = S.season; $$('[data-s]', root).forEach(x => x.setAttribute('aria-pressed', x === b)); paint(); });
  $$('[data-m]', root).forEach(b => b.onclick = () => { S.mode = b.dataset.m; $$('[data-m]', root).forEach(x => x.setAttribute('aria-pressed', x === b)); paint(); });
  $('#night', root).onclick = e => { S.night = !S.night; document.body.dataset.night = S.night ? 1 : 0; e.currentTarget.setAttribute('aria-pressed', S.night); };

  let stop = null;
  function paint(){
    stop && stop(); stop = null;
    markRoute(svg, S.route, S.season, S.mode);
    const r = ROUTES[S.route], c = closedFor(r, S.season, S.mode), d = daysFor(r, S.season, S.mode);
    const a = placeById(r.from), b = placeById(r.to);
    $('#card', root).innerHTML = '<h2>' + esc(r.n) + '</h2><div class="ends"><a href="#/place/' + a.id + '">' + esc(a.name) + '</a> — <a href="#/place/' + b.id + '">' + esc(b.name) + '</a> · ~' + r.miles + ' миль · ' + MODE_LABEL[S.mode] + '</div>' +
      '<div class="bignums"><div>' + (c ? '—' : fmt(d)) + '<small>' + (c ? 'закрыто' : 'дней') + '</small></div><div>' + (c ? '—' : Math.round(d) * 5) + '<small>грошей в пути</small></div><div id="dn">0<small>день</small></div></div>' +
      '<button class="go" id="go"' + (c ? ' disabled' : '') + '>▶ В путь</button>' +
      '<div class="evline' + (c ? ' bad' : '') + '" style="margin-top:10px">' + esc(c ? r.winter : r.note) + '</div>' +
      '<div class="evline" style="margin-top:6px">Держит: ' + esc(r.holder) + '</div><div class="feed" id="feed"></div>';
    $('#go', root).onclick = () => { const feed = $('#feed', root); feed.innerHTML = '';
      stop = travel(r, {token:$('#token', root), days:d, speed:S.mode === 'cart' ? 120 : 80,
        onDay:k => { const n = $('#dn', root); if (n) n.firstChild.textContent = k; },
        onEvent:(t, k, bad) => { const x = document.createElement('div'); x.className = bad ? 'bad' : ''; x.textContent = 'День ' + k + ' · ' + t; feed.appendChild(x); feed.scrollTop = 1e9; },
        onDone:() => { const x = document.createElement('div'); x.textContent = 'Прибыли.'; feed.appendChild(x); }}); };
  }
  paint();
  return () => { stop && stop(); removeEventListener('resize', onResize); };
}
