/* Карта: дорога от А до Б и торговля. Адрес #/map/откуда/куда — путь можно открыть ссылкой.
   Сроки и тракты — routes.js (запись 15), цены — goods.js (запись 16), торговля — trade.js (запись 25).
   Расчёт пути — Скрипты/road.js. */
import { $, $$, esc, mapHTML, drawRoutes, drawPins, canonSources } from '../ui.js';
import { ROUTES } from '../../Данные/routes.js';
import { plan, MODE_LABEL, MODE_TOKEN, fmtDays, dayWord, placeName, moneyRound, money, ROAD_PLACES, closed } from '../road.js';
import * as trade from './trade-layer.js';

const NS = 'http://www.w3.org/2000/svg';

export function render(root, [from0, to0]){
  const ok = id => ROAD_PLACES.includes(id);
  const S = {season:'autumn', mode:'horse', night:false, people:2, word:true, layer:'road',
    from: ok(from0) ? from0 : 'capital', to: ok(to0) ? to0 : (ok(from0) && from0 !== 'shadowport' ? 'shadowport' : from0 === 'shadowport' ? 'capital' : 'shadowport')};
  if (S.from === S.to) S.to = S.from === 'capital' ? 'shadowport' : 'capital';
  document.body.dataset.season = S.season; document.body.dataset.night = '0';
  const opts = ROAD_PLACES.map(id => [id, placeName(id)]).sort((a, b) => a[1].localeCompare(b[1], 'ru'));
  const sel = id => opts.map(([k, n]) => '<option value="' + k + '">' + esc(n) + '</option>').join('');

  root.innerHTML = `<div class="atlas" id="atlas" data-title="Карта">
    <div class="world" id="world"><div class="map" id="map">${mapHTML('<div class="weather snow"></div><div class="weather rain"></div><div class="token" id="token" hidden></div>')}</div></div>
    <div class="float atlas-bar">
      <div class="seg" role="group" aria-label="Слой"><button data-l="road" aria-pressed="true">Дорога</button><button data-l="trade" aria-pressed="false">Торговля</button></div>
      <div class="seg" role="group" aria-label="Время года"><button data-s="summer" aria-pressed="false">☀ Лето</button><button data-s="autumn" aria-pressed="true">🍂 Осень</button><button data-s="winter" aria-pressed="false">❄ Зима</button></div>
      <div class="seg road-only" role="group" aria-label="Способ">${Object.entries(MODE_LABEL).map(([k, l]) => '<button data-m="' + k + '" aria-pressed="' + (k === 'horse') + '">' + l[0].toUpperCase() + l.slice(1) + '</button>').join('')}</div>
      <div class="seg"><button id="night" aria-pressed="false" aria-label="Ночь">☾</button></div>
    </div>
    <section class="float atlas-card" id="card">
      <button class="sheet-h" id="sheet" aria-expanded="true"><span id="sum"></span><i aria-hidden="true">▾</i></button>
      <div class="sheet-b" id="road">
        <div class="plan-ends">
          <label><small>откуда</small><select id="from" aria-label="Откуда">${sel()}</select></label>
          <button id="swap" class="iconbtn" aria-label="Поменять местами">⇄</button>
          <label><small>куда</small><select id="to" aria-label="Куда">${sel()}</select></label>
        </div>
        <div class="plan-opts">
          <span class="stepper" role="group" aria-label="Сколько человек"><button id="pm" aria-label="Меньше">−</button><b id="pn"></b><button id="pp" aria-label="Больше">+</button></span>
          <label class="tog"><input type="checkbox" id="word" checked> под словом Сайдена</label>
        </div>
        <div id="res"></div>
      </div>
      <div class="sheet-b" id="tradebox" hidden></div>
    </section>
    <div class="float atlas-zoom" role="group" aria-label="Масштаб"><button id="zin" aria-label="Приблизить">+</button><button id="zout" aria-label="Отдалить">−</button></div>
    <div class="float atlas-hint">тяни карту · щипок — масштаб · город — «куда», тракт — весь тракт</div>
  </div>`;

  const atlas = $('#atlas', root), world = $('#world', root), map = $('#map', root), svg = $('svg', map), card = $('#card', root);
  drawRoutes(svg, i => { if (S.layer !== 'road') return trade.pickRoute(i); S.from = ROUTES[i].from; S.to = ROUTES[i].to; paint(); });
  drawPins(map, id => {
    if (S.layer !== 'road') return trade.pickPlace(id);
    if (!ok(id)) { location.hash = '#/place/' + id; return; }
    if (id === S.from) [S.from, S.to] = [S.to, S.from]; else S.to = id;
    paint();
  });
  const planLine = document.createElementNS(NS, 'polyline'); planLine.setAttribute('class', 'plan-line'); svg.appendChild(planLine);
  const altLine = document.createElementNS(NS, 'polyline'); altLine.setAttribute('class', 'plan-line alt'); svg.insertBefore(altLine, planLine);

  /* панорама и масштаб: один палец тянет, два — щипок */
  let z = 1, tx = 0, ty = 0, drag = null;
  const apply = () => world.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')';
  function fit(){ const w = world.offsetWidth, h = world.offsetHeight; z = Math.max(atlas.clientWidth / w, atlas.clientHeight / h) * 1.02; tx = (atlas.clientWidth - w * z) / 2; ty = (atlas.clientHeight - h * z) / 2; apply(); }
  fit();
  const onResize = () => fit(); addEventListener('resize', onResize);
  /* кадрировать точки карты (в процентах) в ту часть экрана, которую не закрывают панели */
  function frame(points){
    if (!points.length) return;
    const A = atlas.getBoundingClientRect(), C = card.getBoundingClientRect(), B = $('.atlas-bar', root).getBoundingClientRect();
    const wide = C.left - A.left > A.width * .45;   // карточка справа (компьютер) или снизу (телефон)
    const box = wide ? {l:20, t:B.bottom - A.top + 12, r:C.left - A.left - 24, b:A.height - 44}
                     : {l:16, t:B.bottom - A.top + 12, r:A.width - 16, b:(card.classList.contains('collapsed') ? A.height - 16 : C.top - A.top) - 12};
    const W = world.offsetWidth, H = world.offsetHeight;
    const xs = points.map(p => p[0] / 100 * W), ys = points.map(p => p[1] / 100 * H);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const bw = Math.max(1, box.r - box.l), bh = Math.max(1, box.b - box.t);
    const zMin = Math.min(.35, A.width / W);   // длинный путь на телефоне должен влезть целиком
    z = Math.min(2.2, Math.max(zMin, Math.min(bw / (x1 - x0 + 120), bh / (y1 - y0 + 90))));
    tx = box.l + bw / 2 - (x0 + x1) / 2 * z; ty = box.t + bh / 2 - (y0 + y1) / 2 * z;
    /* не уводить край карты внутрь видимой части, если карта её шире или выше */
    if (W * z >= bw) tx = Math.min(box.l, Math.max(box.r - W * z, tx));
    if (H * z >= bh) ty = Math.min(box.t, Math.max(box.b - H * z, ty));
    world.classList.add('glide'); apply(); setTimeout(() => world.classList.remove('glide'), 450);
  }
  function zoomAt(mx, my, nz){ nz = Math.min(3, Math.max(.35, nz)); tx = mx - (mx - tx) * nz / z; ty = my - (my - ty) * nz / z; z = nz; apply(); }
  const ptrs = new Map(); let pinch = null;
  const local = e => { const r = atlas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function pinchState(){ const [a, b] = [...ptrs.values()]; return {d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]}; }
  atlas.onpointerdown = e => { if (e.target.closest('.float,.route,.pin,.res-mark')) return;
    ptrs.set(e.pointerId, local(e)); try { atlas.setPointerCapture(e.pointerId); } catch {}
    if (ptrs.size === 2){ drag = null; pinch = {...pinchState(), z}; }
    else if (ptrs.size === 1){ drag = [e.clientX - tx, e.clientY - ty]; atlas.classList.add('drag'); } };
  atlas.onpointermove = e => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, local(e));
    if (pinch && ptrs.size >= 2){ const s = pinchState(); tx += s.m[0] - pinch.m[0]; ty += s.m[1] - pinch.m[1]; pinch.m = s.m; zoomAt(s.m[0], s.m[1], pinch.z * s.d / pinch.d); return; }
    if (drag){ tx = e.clientX - drag[0]; ty = e.clientY - drag[1]; apply(); } };
  atlas.onpointerup = atlas.onpointercancel = e => { ptrs.delete(e.pointerId); pinch = null;
    const rest = [...ptrs.entries()][0];
    if (rest){ const r = atlas.getBoundingClientRect(); drag = [rest[1][0] + r.left - tx, rest[1][1] + r.top - ty]; }
    else { drag = null; atlas.classList.remove('drag'); } };
  atlas.onwheel = e => { if (e.target.closest('.float')) return; e.preventDefault(); const [mx, my] = local(e); zoomAt(mx, my, z * (e.deltaY < 0 ? 1.12 : .89)); };
  $('#zin', root).onclick = () => zoomAt(atlas.clientWidth / 2, atlas.clientHeight / 2, z * 1.3);
  $('#zout', root).onclick = () => zoomAt(atlas.clientWidth / 2, atlas.clientHeight / 2, z / 1.3);

  const press = (attr, v) => $$('[data-' + attr + ']', root).forEach(x => x.setAttribute('aria-pressed', x.dataset[attr] === v));
  $$('[data-s]', root).forEach(b => b.onclick = () => { S.season = b.dataset.s; document.body.dataset.season = S.season; press('s', S.season); paint(); });
  $$('[data-m]', root).forEach(b => b.onclick = () => { S.mode = b.dataset.m; press('m', S.mode); paint(); });
  $$('[data-l]', root).forEach(b => b.onclick = () => { S.layer = b.dataset.l; press('l', S.layer); paint(); });
  $('#night', root).onclick = e => { S.night = !S.night; document.body.dataset.night = S.night ? 1 : 0; e.currentTarget.setAttribute('aria-pressed', S.night); };
  $('#from', root).onchange = e => { S.from = e.target.value; if (S.from === S.to) S.to = opts.find(([k]) => k !== S.from)[0]; paint(); };
  $('#to', root).onchange = e => { S.to = e.target.value; if (S.from === S.to) S.from = opts.find(([k]) => k !== S.to)[0]; paint(); };
  $('#swap', root).onclick = () => { [S.from, S.to] = [S.to, S.from]; paint(); };
  $('#pm', root).onclick = () => { S.people = Math.max(1, S.people - 1); paint(); };
  $('#pp', root).onclick = () => { S.people = Math.min(20, S.people + 1); paint(); };
  $('#word', root).onchange = e => { S.word = e.target.checked; paint(); };
  $('#sheet', root).onclick = () => { const open = card.classList.toggle('collapsed'); $('#sheet', root).setAttribute('aria-expanded', !open); };

  let stop = null, P = null, framed = '';
  const lines = svg.querySelectorAll('.route'), flows = svg.querySelectorAll('.flow');
  const pts = arr => arr.map(q => q.join(',')).join(' ');

  function paintRoad(){
    $('#from', root).value = S.from; $('#to', root).value = S.to; $('#pn', root).textContent = S.people + ' ' + (S.people === 1 ? 'чел.' : 'чел.');
    history.replaceState(null, '', '#/map/' + S.from + '/' + S.to);
    P = plan(S);
    const used = new Set(P ? P.legs.map(l => l.route) : []);
    ROUTES.forEach((r, k) => { lines[k].classList.toggle('sel', used.has(r)); lines[k].classList.toggle('closed', closed(r, S.season, S.mode)); flows[k].classList.remove('sel'); });
    planLine.setAttribute('points', P ? pts(P.legs.flatMap(l => l.p)) : '');
    const key = S.from + '>' + S.to;
    if (P && key !== framed) { framed = key; requestAnimationFrame(() => frame([...P.legs.flatMap(l => l.p), ...(P.alt ? P.alt.legs.flatMap(l => l.p) : [])])); }
    altLine.setAttribute('points', P && P.alt ? pts(P.alt.legs.flatMap(l => l.p)) : '');
    $$('.pin', map).forEach(p => { p.classList.toggle('here', p.dataset.id === S.to); p.classList.toggle('start', p.dataset.id === S.from); });
    if (!P){
      $('#sum', root).innerHTML = esc(placeName(S.from)) + ' → ' + esc(placeName(S.to)) + ' <b>нет пути</b>';
      $('#res', root).innerHTML = '<p class="evline bad">' + (S.season === 'winter' ? 'Зимой ' + MODE_LABEL[S.mode] + ' сюда не пройти: тракт закрыт.' : 'Трактом туда не дойти.') + '</p>';
      return;
    }
    const d = fmtDays(P.days), dw = dayWord(P.days);
    $('#sum', root).innerHTML = esc(placeName(S.from)) + ' → ' + esc(placeName(S.to)) + ' <b>≈ ' + d + ' ' + dw + '</b>';
    const leg = l => '<li><div class="leg-h"><b>' + esc(l.route.n) + '</b><span>' + fmtDays(l.days) + ' ' + dayWord(l.days) + (l.known ? '' : ' <em title="Срока в каноне нет — оценён по длине тракта">оценка</em>') + '</span></div>' +
      '<div class="leg-e"><a href="#/place/' + l.from + '">' + esc(placeName(l.from)) + '</a>' + l.via.map(v => ' → <a href="#/place/' + v + '">' + esc(placeName(v)) + '</a>').join('') + ' → <a href="#/place/' + l.to + '">' + esc(placeName(l.to)) + '</a></div>' +
      l.warns.map(w => '<div class="evline bad">' + esc(w) + '</div>').join('') +
      '<div class="evline">Держит: ' + esc(l.route.holder) + '</div>' +
      (l.route.note && !l.warns.includes(l.route.note) ? '<div class="evline">' + esc(l.route.note) + '</div>' : '') +
      '<details class="leg-ev"><summary>что бывает в пути</summary>' + l.route.ev.map(e => '<div' + (e.startsWith('!') ? ' class="bad"' : '') + '>' + esc(e.replace(/^!/, '')) + '</div>').join('') + '</details></li>';
    const altTxt = P.alt ? '<div class="alt-row"><span class="alt-key"></span><div>Другой путь: ' + P.alt.legs.map(l => esc(l.route.n) + (l.via.length ? ' через ' + l.via.map(placeName).join(', ') : '')).join(' → ') +
      ' · ≈ ' + fmtDays(P.alt.days) + ' ' + dayWord(P.alt.days) + (P.alt.mid < P.mid + .01 ? '' : ', на ' + fmtDays([P.alt.mid - P.mid, P.alt.mid - P.mid]) + ' ' + dayWord([0, P.alt.mid - P.mid]) + ' дольше') +
      (P.alt.warns.length ? '' : ', без оговорок') + '</div></div>' : '';
    $('#res', root).innerHTML =
      '<div class="bignums"><div>≈ ' + d + '<small>' + dw + (P.estimated ? ', с оценкой' : '') + '</small></div><div>' + P.miles + '<small>миль</small></div><div>' + moneyRound(P.cost.lo, P.cost.hi) + '<small>в дороге на ' + S.people + '</small></div></div>' +
      '<ol class="legs">' + P.legs.map(leg).join('') + '</ol>' + altTxt +
      '<div class="go-row"><button class="go" id="go">▶ Проехать</button><span id="dn"></span></div>' +
      '<details class="costs"><summary>Расходы в дороге · ' + moneyRound(P.cost.lo, P.cost.hi) + '</summary>' +
        P.cost.lines.map(l => '<div><span>' + esc(l.label) + '</span><b>' + money(l.lo, l.hi) + '</b></div>').join('') +
        '<p>Прикидка по ценам записи 16: ночь под крышей, где она есть, еда дважды в день. Пошлины в каноне без сумм, поэтому их нет в счёте — смотрите, кто держит этапы.' + (S.season === 'summer' ? '' : ' Срок — с осенне-зимней поправкой: грунт вдвое медленнее.') + '</p></details>' +
      canonSources('articles', 'roads');
    $('#go', root).onclick = go;
  }

  function go(){
    stop && stop();
    const tok = $('#token', root), path = P.legs.flatMap(l => l.p);
    const seg = [];   // точки через равный шаг, чтобы конь шёл ровно
    for (let i = 0; i < path.length - 1; i++){ const a = path[i], b = path[i + 1], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / .6));
      for (let t = 0; t < n; t++) seg.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); }
    seg.push(path[path.length - 1]);
    const total = Math.max(1, Math.ceil(P.days[1])), dn = $('#dn', root);
    tok.textContent = MODE_TOKEN[S.mode]; tok.hidden = false;
    let k = 0;
    const id = setInterval(() => {
      const [x, y] = seg[k]; tok.style.left = x + '%'; tok.style.top = y + '%';
      if (dn) dn.textContent = 'день ' + Math.min(total, Math.floor(k / seg.length * total) + 1) + ' из ' + total;
      if (++k >= seg.length){ clearInterval(id); if (dn) dn.textContent = 'на месте · ' + esc(placeName(S.to)); }
    }, Math.max(16, Math.min(60, 4200 / seg.length)));
    stop = () => { clearInterval(id); tok.hidden = true; if (dn) dn.textContent = ''; };
  }

  function paint(){
    stop && stop(); stop = null;
    atlas.dataset.layer = S.layer;
    $('#road', root).hidden = S.layer !== 'road'; $('#tradebox', root).hidden = S.layer !== 'trade';
    if (S.layer === 'road'){ trade.unmount(map, svg); paintRoad(); }
    else { framed = ''; requestAnimationFrame(fit); planLine.setAttribute('points', ''); altLine.setAttribute('points', ''); $$('.pin', map).forEach(p => p.classList.remove('here', 'start'));
      trade.mount({ map, svg, box: $('#tradebox', root), sum: $('#sum', root), season: S.season }); }
  }
  /* на телефоне шторка сначала свёрнута до строки итога, если экран низкий */
  if (innerHeight < 700 && innerWidth < 700) { card.classList.add('collapsed'); $('#sheet', root).setAttribute('aria-expanded', 'false'); }
  paint();
  return () => { stop && stop(); trade.unmount(map, svg); removeEventListener('resize', onResize); };
}
