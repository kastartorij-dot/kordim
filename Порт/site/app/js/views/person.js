/* Страница персонажа. Полный профиль — раскладка «Панели», иначе короткая карточка. */
import { $, $$, esc, IMG, mapHTML, drawRoutes, drawPins, markPlace, markRoute, daysFor, closedFor, travel, pixelate, mountChat, countUp, personChip, placeChip, MODE_LABEL } from '../ui.js';
import { personById } from '../../data/people.js';
import { placeById } from '../../data/places.js';
import { ROUTES, routeById } from '../../data/routes.js';

export function render(root, [id]){
  const p = personById(id);
  if (!p){ root.innerHTML = '<div class="page"><h1 class="h1">Нет такого человека</h1><p><a href="#/people">К списку людей</a></p></div>'; return; }
  return p.profile ? full(root, p) : short(root, p);
}

function short(root, p){
  const pl = p.place ? placeById(p.place) : null;
  root.innerHTML = `<div class="short" data-title="${esc(p.name)}">
    <section class="card c-photo"><img src="${IMG + (p.img || 'faces/' + p.id + '.jpg')}" alt="${esc(p.name)}" onerror="this.remove()"><span class="stamp">${esc(p.role.toUpperCase())}</span></section>
    <section class="body">
      <div class="eyebrow"><a href="#/people">люди</a></div>
      <h1 class="bigname">${esc(p.name)}<span>${esc((p.alias || p.role).toUpperCase())}</span></h1>
      <p style="margin-top:22px">${esc(p.lead)}</p>
      ${(p.bio || []).map(t => '<p>' + esc(t) + '</p>').join('')}
      ${p.facts.length ? '<div>' + p.facts.map(f => '<span class="chip">' + esc(f) + '</span>').join('') + '</div>' : ''}
      ${pl ? '<div style="margin-top:10px">' + placeChip(pl.id) + '</div>' : ''}
      <div class="pending">Хронология, вещи и разговоры для этого персонажа ещё не собраны.</div>
    </section>
    <section class="card c-map"><div class="mhead"><b style="font-weight:500">Где искать</b><a href="#/map">на общую карту</a></div>
      <div class="map" id="map">${mapHTML()}</div><div class="mfoot">${pl ? esc(pl.lead) : 'Место не закреплено.'}</div></section>
  </div>`;
  const map = $('#map', root);
  drawRoutes($('svg', map)); map.classList.add('quiet'); drawPins(map);
  if (pl) markPlace(map, pl.id);
}

function full(root, p){
  const P = p.profile, YEARS = Object.keys(P.years).map(Number).sort((a, b) => a - b);
  const MIN = YEARS[0] - 2, MAX = Math.max(1027, YEARS[YEARS.length - 1] + 1);
  /* отметки идут через равный шаг: близкие даты (весна и осень одного года) не слипаются */
  const MARKS = [...YEARS, ...(P.eras || []).filter(([y]) => y > MIN && y < MAX).map(e => e[0])].sort((a, b) => a - b);
  const pct = y => 5 + MARKS.indexOf(y) / Math.max(1, MARKS.length - 1) * 90;
  const stops = [];

  root.innerHTML = `<div class="frame" data-title="${esc(p.name)}">
    <section class="c-name">
      <div class="eyebrow"><a href="#/people">люди</a></div>
      <h1 class="bigname">${esc(p.name)}${P.born ? '<b class="age" id="age"></b>' : ''}<span>${esc(P.subtitle)}</span></h1>
      <div class="now"><div class="yearbig yearN"></div><div class="where"><small>ГДЕ</small><span id="where"></span></div></div>
      <div style="margin-top:12px">${(P.links || []).map(personChip).join('')}</div>
      ${P.secret ? '<details class="secret"><summary>только для автора</summary><div class="secret-pop">' + esc(P.secret) + '</div></details>' : ''}
    </section>
    <section class="card c-photo">
      <img src="${IMG + p.img}" alt="${esc(p.name)}" id="pImg"><canvas id="pCv" hidden></canvas>
      ${(P.gallery || []).length > 1 ? '<div class="gal-wrap"><button class="gal-arrow" data-gstep="-1" aria-label="Предыдущий портрет">‹</button><div class="gal">' + P.gallery.map((g, i) => '<button data-g="' + g + '" class="' + (i ? '' : 'on') + '" aria-label="Портрет ' + (i + 1) + '"><img src="' + IMG + g + '" alt="" loading="lazy"></button>').join('') + '</div><button class="gal-arrow" data-gstep="1" aria-label="Следующий портрет">›</button></div>' : ''}
      <button class="pxbtn" id="px" aria-pressed="false">пиксель</button>
      <span class="stamp" id="stamp"></span>
    </section>
    <section class="card c-story"><h3>ЧТО ПРОИСХОДИТ</h3><div class="in"><p class="story" id="story"></p></div></section>
    ${P.desc && P.desc.length ? `<section class="card c-desc" id="cdesc"><h3>ОПИСАНИЕ</h3><div class="in">${P.desc.map(s => '<h4>' + esc(s.h) + '</h4>' + s.p.map(t => '<p>' + esc(t) + '</p>').join('')).join('')}</div></section>` : ''}
    <section class="card c-time"><h3>ГОД</h3><div class="tl" id="tl"><div class="ax"></div><div class="fill" id="fill"></div></div></section>
    <section class="card c-stats"><h3>СОСТОЯНИЕ <small>к этому году</small></h3><div class="in" id="stats"></div></section>
    <section class="card c-map" id="cmap">
      <div class="mhead">
        <div class="seg" role="group" aria-label="Режим карты"><button data-mm="path" aria-pressed="true">Путь героя</button><button data-mm="trip" aria-pressed="false">Как добраться</button></div>
        <a href="#/map">на общую карту</a>
      </div>
      <div class="map" id="map">${mapHTML('<div class="token" id="token" hidden>🐴</div>')}</div>
      <div class="mfoot" id="mfoot"></div>
    </section>
    <section class="card c-talk"><h3>РАЗГОВОР <small id="talkWhere"></small></h3><div class="in" id="talk"></div></section>
    <section class="card c-items"><h3>ВЕЩИ И ДОЛГИ <small>к этому году</small></h3><div class="in">
      <div class="sub">При себе</div><div class="slots" id="items"></div>
      <div class="sub">Долги и обещания</div><div class="slots" id="debts"></div>
      <div class="tip" id="tip">Наведи на ячейку.</div>
    </div></section>
  </div>`;

  /* шкала лет */
  const tl = $('#tl', root);
  YEARS.forEach(y => { const b = document.createElement('button'); b.className = 'tick'; b.dataset.y = y; b.style.left = pct(y) + '%';
    b.innerHTML = '<span class="yr">' + esc(P.years[y].label || y) + '</span><span class="dot"></span><span class="lab">' + esc(P.years[y].mark) + '</span>'; b.onclick = () => show(y); tl.appendChild(b); });
  (P.eras || []).filter(([y]) => y > MIN && y < MAX).forEach(([y, l]) => { const d = document.createElement('div'); d.className = 'tick era'; d.style.left = pct(y) + '%';
    d.innerHTML = '<span class="yr">' + y + '</span><span class="dot"></span><span class="lab">' + esc(l) + '</span>'; tl.appendChild(d); });

  $('#stats', root).innerHTML = P.statNames.map((k, i) => '<div class="st ' + (P.statTones[i] || '') + '"><div class="tr"><div class="v"></div><b>0</b><span class="d"></span></div>' + esc(k) + '</div>').join('');

  /* карта */
  const map = $('#map', root), svg = $('svg', map);
  let mapMode = 'path', year = YEARS[YEARS.length - 1], prev = null, stopTrip = null;
  const trip = {route:0, mode:'horse'};
  drawRoutes(svg, i => { if (mapMode === 'trip'){ trip.route = i; paintMap(); } });
  drawPins(map);
  $$('[data-mm]', root).forEach(b => b.onclick = () => { mapMode = b.dataset.mm; $$('[data-mm]', root).forEach(x => x.setAttribute('aria-pressed', x === b)); paintMap(); });

  function paintMap(){
    stopTrip && stopTrip(); stopTrip = null;
    const s = P.years[year], foot = $('#mfoot', root);
    markPlace(map, s.place);
    if (mapMode === 'path'){
      map.classList.add('quiet');
      const ri = s.route ? ROUTES.indexOf(routeById(s.route)) : -1;
      markRoute(svg, ri);
      const pl = placeById(s.place);
      foot.innerHTML = '<b>' + esc(s.where) + '</b>' + (ri >= 0 ? '<div class="evline">Путь года: ' + esc(ROUTES[ri].n) + ', ' + esc(ROUTES[ri].e) + '.</div>' : '<div class="evline">' + (pl ? placeChip(pl.id) : '') + '</div>');
    } else {
      map.classList.remove('quiet');
      markRoute(svg, trip.route, 'autumn', trip.mode);
      const r = ROUTES[trip.route], d = daysFor(r, 'autumn', trip.mode), c = closedFor(r, 'autumn', trip.mode);
      foot.innerHTML = '<div class="row"><select id="rsel" aria-label="Тракт">' + ROUTES.map((x, i) => '<option value="' + i + '"' + (i === trip.route ? ' selected' : '') + '>' + esc(x.n + ' · ' + x.e) + '</option>').join('') + '</select>' +
        '<select id="msel" aria-label="Как">' + Object.entries(MODE_LABEL).map(([k, l]) => '<option value="' + k + '"' + (k === trip.mode ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
        '<button class="go" id="go"' + (c ? ' disabled' : '') + '>В путь</button></div>' +
        '<div class="nums"><span id="dn">0</span> / ' + Math.round(d) + '<small>дней осенью</small></div><div class="evline" id="ev">' + esc(r.note) + '</div>';
      $('#rsel', root).onchange = e => { trip.route = +e.target.value; paintMap(); };
      $('#msel', root).onchange = e => { trip.mode = e.target.value; paintMap(); };
      $('#go', root).onclick = () => { stopTrip && stopTrip(); stopTrip = travel(r, {token:$('#token', root), days:d,
        onDay:k => { const n = $('#dn', root); if (n) n.textContent = k; },
        onEvent:(t, k, bad) => { const ev = $('#ev', root); if (ev){ ev.className = 'evline' + (bad ? ' bad' : ''); ev.textContent = 'День ' + k + '. ' + t; } },
        onDone:() => { const ev = $('#ev', root); if (ev) ev.textContent += ' Прибыли.'; }}); };
    }
  }

  /* вещи */
  const tip = $('#tip', root);
  function slot(it, box, cls = ''){
    const b = document.createElement('button'); b.className = 'slot ' + cls + (it.debt ? ' debt' : ''); b.textContent = it.i; b.setAttribute('aria-label', it.n);
    if (it.pic){ const im = new Image(); im.alt = ''; im.onload = () => { b.classList.add('hasimg'); b.appendChild(im); }; im.src = IMG + 'items/' + it.pic + '.png'; }
    const sh = () => { $$('.slot', root).forEach(s => s.classList.remove('on')); b.classList.add('on'); tip.innerHTML = '<b>' + esc(it.n) + '.</b> ' + esc(it.t); };
    b.onmouseenter = sh; b.onfocus = sh; b.onclick = sh; box.appendChild(b); return b;
  }
  function paintItems(){
    const it = $('#items', root), db = $('#debts', root); it.innerHTML = ''; db.innerHTML = ''; tip.textContent = 'Наведи на ячейку.';
    (P.things || []).filter(x => x.from <= year && (x.to == null || x.to >= year)).forEach(x => slot(x, it));
    (P.promises || []).filter(x => x.from <= year && (x.to == null || x.to >= year)).forEach(x => slot(x, db));
    for (let k = it.children.length; k < 6; k++){ const g = document.createElement('div'); g.className = 'slot ghost'; it.appendChild(g); }
  }

  /* разговор */
  let stopChat = null;
  function paintTalk(){
    stopChat && stopChat(); stopChat = null;
    const t = (P.talks || {})[year], box = $('#talk', root);
    $('#talkWhere', root).innerHTML = t ? (t.draft ? '<span class="badge draft">набросок</span> ' : '') + esc(t.where) : '';
    if (!t){ box.innerHTML = '<p class="locked">В этом году разговора нет. Годы с разговором: ' + Object.keys(P.talks || {}).join(', ') + '.</p>'; return; }
    box.innerHTML = '<div id="chat"></div>';
    stopChat = mountChat($('#chat', root), t.tree, {gains:P.gains || {}, onGain:g => { const box = $('#debts', root); if (box) slot(g, box, 'new').focus({preventScroll:true}); }});
  }
  stops.push(() => { stopTrip && stopTrip(); stopChat && stopChat(); });

  function show(y){
    year = y; const s = P.years[y];
    $$('.tick[data-y]', root).forEach(t => t.setAttribute('aria-current', +t.dataset.y === y));
    $('#fill', root).style.width = pct(y) + '%';
    countUp($$('.yearN', root), Math.floor(prev || y), Math.floor(y));
    $('#where', root).textContent = s.where;
    const st = $('#story', root); st.classList.remove('swap'); void st.offsetWidth; st.classList.add('swap'); st.textContent = s.text;
    $$('.st', root).forEach((b, i) => { const v = s.stats[i], o = prev ? P.years[prev].stats[i] : v, d = v - o;
      b.querySelector('.v').style.height = v * 10 + '%'; b.querySelector('b').textContent = v;
      const el = b.querySelector('.d'); el.textContent = d ? (d > 0 ? '+' + d : d) : ''; el.className = 'd ' + (d > 0 ? 'up' : 'down'); });
    const age = (y - YEARS[0]) / Math.max(1, YEARS[YEARS.length - 1] - YEARS[0]);
    $('#pImg', root).style.filter = 'saturate(' + (1.1 - age * .45) + ') brightness(' + (1.05 - age * .18) + ')';
    $('#stamp', root).textContent = (P.born ? Math.floor(y - P.born) + ' ЛЕТ · ' : '') + (s.label || y).toString().toUpperCase();
    const ageEl = $('#age', root); if (ageEl) ageEl.textContent = Math.floor(y - P.born) + ' лет';
    paintMap(); paintItems(); paintTalk();
    prev = y;
  }

  $('#px', root).onclick = e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on);
    $('#pImg', root).hidden = on; $('#pCv', root).hidden = !on; if (on) pixelate($('#pImg', root).getAttribute('src'), $('#pCv', root)); };
  /* лента портретов: клик по превью, стрелки по краям, колесо листает вбок */
  const gal = $('.gal', root), thumbs = $$('.gal button', root);
  let gi = 0;
  function pickPortrait(k){
    gi = (k + thumbs.length) % thumbs.length; const b = thumbs[gi];
    thumbs.forEach(x => x.classList.toggle('on', x === b));
    $('#pImg', root).setAttribute('src', IMG + b.dataset.g);
    if ($('#px', root).getAttribute('aria-pressed') === 'true') pixelate(IMG + b.dataset.g, $('#pCv', root));
    gal.scrollLeft = b.offsetLeft - (gal.clientWidth - b.offsetWidth) / 2;
  }
  thumbs.forEach((b, k) => b.onclick = () => pickPortrait(k));
  $$('[data-gstep]', root).forEach(b => b.onclick = () => pickPortrait(gi + +b.dataset.gstep));
  if (gal) gal.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)){ gal.scrollLeft += e.deltaY; e.preventDefault(); } }, {passive:false});

  /* описание сворачивается, если не помещается в разумную высоту */
  const desc = $('#cdesc', root);
  if (desc){
    const in_ = $('.in', desc);
    if (in_.scrollHeight > 360){
      desc.classList.add('clamp');
      const more = document.createElement('button'); more.className = 'desc-more'; more.textContent = 'Показать полностью';
      more.onclick = () => { const open = desc.classList.toggle('clamp') === false; more.textContent = open ? 'Свернуть' : 'Показать полностью'; };
      desc.appendChild(more);
    }
  }

  const keys = e => { if (e.target.closest('.chat-opts,select,input')) return; const i = YEARS.indexOf(year);
    if (e.key === 'ArrowRight' && i < YEARS.length - 1) show(YEARS[i + 1]); if (e.key === 'ArrowLeft' && i > 0) show(YEARS[i - 1]); };
  addEventListener('keydown', keys); stops.push(() => removeEventListener('keydown', keys));

  show(year);
  return () => stops.forEach(f => f());
}
