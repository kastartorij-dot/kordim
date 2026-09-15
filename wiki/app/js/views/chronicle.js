/* Хроника в двух видах.
   «Главное» — одна полоса с ключевыми событиями, при наведении всплывает карточка с картинкой.
   «Полная лента» — горизонтальная лента с дорожками по линиям сюжета: тянется, листается, проигрывается. */
import { $, $$, esc, IMG, personChip, placeChip } from '../ui.js';
import { EVENTS, LINES, LINE_COLOR, ERAS } from '../../data/events.js';

const names = {...LINES, world:'Мир'};
const color = l => LINE_COLOR[l] || LINE_COLOR.world;
const linesOf = e => e.lines.length ? e.lines : ['world'];

export function render(root, [param]){
  let mode = null;
  try { mode = localStorage.getItem('kordim-chron'); } catch (e) {}
  if (param != null) mode = 'full';
  mode = mode === 'full' ? 'full' : 'key';

  root.innerHTML = `<div class="hc" data-title="Хроника">
    <div class="hc-head">
      <div><div class="eyebrow">время</div><h1 class="h1">Хроника</h1></div>
      <div class="seg" role="group" aria-label="Вид хроники"><button data-mode="key">Главное</button><button data-mode="full">Полная лента</button></div>
      <div class="hc-ctrl" id="ctrl"></div>
    </div>
    <div id="body"></div>
  </div>`;

  let stop = null;
  function set(m, at){
    stop && stop(); stop = null; mode = m;
    try { localStorage.setItem('kordim-chron', m); } catch (e) {}
    $$('[data-mode]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
    const body = $('#body', root), ctrl = $('#ctrl', root);
    body.innerHTML = ''; ctrl.innerHTML = '';
    const wrap = document.createElement('div'); body.appendChild(wrap);
    stop = m === 'full' ? full(wrap, ctrl, at) : keyView(wrap, i => set('full', i));
  }
  $$('[data-mode]', root).forEach(b => b.onclick = () => { if (b.dataset.mode !== mode) set(b.dataset.mode); });
  set(mode, param);
  return () => { stop && stop(); };
}

/* ─── «Главное» ─── */
function keyView(wrap, openFull){
  const KEY = EVENTS.map((e, i) => [e, i]).filter(([e]) => e.key);
  const n = KEY.length;
  const pos = k => 4 + k * (92 / (n - 1));
  wrap.innerHTML = `<div class="ks-wrap"><div class="ks" id="ks">
      <div class="ks-line"></div>
      ${KEY.map(([e], k) => '<button class="ks-ev ' + (k % 2 ? 'down' : 'up') + (e.now ? ' now' : '') + (e.hot ? ' hot' : '') + '" data-k="' + k + '" style="left:' + pos(k) + '%;--c:' + color(linesOf(e)[0]) + '">' +
        '<span class="ks-dot"></span><span class="ks-yr">' + esc(e.y) + '</span><span class="ks-h">' + esc(e.h) + '</span></button>').join('')}
      <div class="ks-card" id="card" hidden></div>
    </div></div>
    <p class="hc-hint">наведи на событие — всплывёт карточка · нажми — закрепить · ← → листать · в «Полной ленте» все ${EVENTS.length} событий по линиям</p>`;
  history.replaceState(null, '', '#/chronicle');

  const card = $('#card', wrap);
  let pinned = null, shown = null;
  function show(k){
    shown = k; const [e, i] = KEY[k];
    const bg = "background-image:url('" + IMG + 'events/' + e.slug + ".jpg')" + (e.pic ? ",url('" + IMG + e.pic + "')" : '') + ",radial-gradient(circle at 70% 30%," + color(linesOf(e)[0]) + "55,transparent 60%)";
    const tx = k < 2 ? '-12%' : k > n - 3 ? '-88%' : '-50%';
    card.style.left = pos(k) + '%'; card.style.setProperty('--tx', 'translateX(' + tx + ')');
    card.innerHTML = '<div class="im" style="' + bg + '"></div><div class="tx"><div class="yr">' + esc(e.y) + '</div><h3>' + esc(e.h) + '</h3><p>' + esc(e.t) + '</p>' +
      '<div>' + linesOf(e).map(l => '<span class="ltag" style="--c:' + color(l) + '">' + esc(names[l]) + '</span>').join('') + '</div>' +
      '<div style="margin-top:4px">' + (e.people || []).slice(0, 4).map(personChip).join('') + '</div>' +
      '<button class="btn more" data-full="' + i + '">В полной ленте →</button></div>';
    card.hidden = false; card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    $$('.ks-ev', wrap).forEach(b => b.classList.toggle('on', +b.dataset.k === k));
  }
  function hide(){ if (pinned != null) return show(pinned); card.hidden = true; shown = null; $$('.ks-ev', wrap).forEach(b => b.classList.remove('on')); }
  $$('.ks-ev', wrap).forEach(b => {
    const k = +b.dataset.k;
    b.addEventListener('mouseenter', () => show(k));
    b.addEventListener('focus', () => show(k));
    b.addEventListener('mouseleave', () => { if (!card.matches(':hover')) hide(); });
    b.addEventListener('click', () => { pinned = pinned === k ? null : k; show(k); });
  });
  card.addEventListener('mouseleave', () => hide());
  card.addEventListener('click', e => { const f = e.target.closest('[data-full]'); if (f) openFull(+f.dataset.full); });
  const keys = e => {
    if (e.target.closest('input,select,textarea')) return;
    const cur = pinned ?? shown ?? -1;
    if (e.key === 'ArrowRight'){ pinned = Math.min(n - 1, cur + 1); show(pinned); }
    if (e.key === 'ArrowLeft'){ pinned = Math.max(0, cur < 0 ? 0 : cur - 1); show(pinned); }
    if (e.key === 'Escape'){ pinned = null; hide(); }
  };
  addEventListener('keydown', keys);
  /* клик мимо событий снимает закрепление */
  $('#ks', wrap).addEventListener('click', e => { if (!e.target.closest('.ks-ev,.ks-card')){ pinned = null; hide(); } });
  return () => removeEventListener('keydown', keys);
}

/* ─── «Полная лента» ─── */
const LANE_H = 46, TOP = 66, PAD_L = 200;

function full(wrap, ctrl, param){
  const lanes = [...Object.keys(LINES), 'world'];
  const xs = []; let x = PAD_L;
  EVENTS.forEach((e, i) => { if (i) x += 165 + Math.min(240, (e.s - EVENTS[i - 1].s) * 14); xs.push(x); });
  const W = x + 460, H = TOP + lanes.length * LANE_H + 14;
  const laneY = l => TOP + lanes.indexOf(l) * LANE_H + LANE_H / 2;
  const xOf = y => {
    if (y <= EVENTS[0].s) return xs[0];
    for (let i = 1; i < EVENTS.length; i++) if (y <= EVENTS[i].s){ const a = EVENTS[i - 1].s, b = EVENTS[i].s; return xs[i - 1] + (xs[i] - xs[i - 1]) * (y - a) / (b - a || 1); }
    return xs[xs.length - 1];
  };
  const nowIdx = Math.max(0, EVENTS.findIndex(e => e.now));

  ctrl.innerHTML = '<button class="btn" id="all" aria-pressed="true">Все линии</button><button class="btn" id="play" aria-pressed="false">▶ Проиграть</button><button class="btn" id="now">Сейчас</button>';
  wrap.innerHTML = `
    <div class="hc-mini" id="mini" title="Прыгнуть к месту">${EVENTS.map((e, i) => '<i style="left:' + (xs[i] / W * 100) + '%;--c:' + color(linesOf(e)[0]) + '"></i>').join('')}<div class="win" id="win"></div></div>
    <div class="hc-wrap">
      <div class="hc-lanes" style="height:${H}px">${lanes.map(l => '<button data-line="' + l + '" style="top:' + laneY(l) + 'px;--c:' + color(l) + '">' + esc(names[l]) + '</button>').join('')}</div>
      <div class="hc-scroll" id="sc"><div class="hc-track" style="width:${W}px;height:${H}px">
        ${lanes.map(l => '<div class="hc-laneline" style="top:' + laneY(l) + 'px"></div>').join('')}
        ${ERAS.map(([a, b, l]) => '<div class="hc-era" style="left:' + xOf(a) + 'px;width:' + Math.max(40, xOf(b) - xOf(a)) + 'px"><span>' + esc(l) + '</span></div>').join('')}
        ${EVENTS.map((e, i) => '<span class="hc-yr" data-yi="' + i + '" style="left:' + xs[i] + 'px">' + esc(e.y) + '</span>').join('')}
        <div class="hc-now" style="left:${xs[nowIdx]}px"></div>
        ${EVENTS.map((e, i) => {
          const ls = linesOf(e), ys = ls.map(laneY), top = Math.min(...ys), bot = Math.max(...ys);
          return '<div class="hc-ev' + (e.hot ? ' hot' : '') + '" data-ev="' + i + '" style="left:' + xs[i] + 'px">' +
            (ls.length > 1 ? '<span class="hc-conn" style="top:' + top + 'px;height:' + (bot - top) + 'px"></span>' : '') +
            ls.map(l => '<button class="hc-dot" data-i="' + i + '" style="top:' + laneY(l) + 'px;--c:' + color(l) + '" aria-label="' + esc(e.y + ': ' + e.h) + '"></button>').join('') +
            '<button class="hc-lab" data-i="' + i + '" tabindex="-1" style="top:' + laneY(ls[0]) + 'px">' + esc(e.h) + '</button></div>';
        }).join('')}
      </div></div>
    </div>
    <div class="card hc-det" id="det"></div>
    <p class="hc-hint">тяни ленту мышью · колесо листает · ← → по событиям · нажми линию слева, чтобы оставить только её</p>`;

  const sc = $('#sc', wrap), det = $('#det', wrap), mini = $('#mini', wrap), win = $('#win', wrap), playBtn = $('#play', ctrl);
  let cur = nowIdx, line = null, play = null;

  function setLine(l){
    line = l === line ? null : l;
    $$('.hc-lanes button', wrap).forEach(b => b.classList.toggle('on', b.dataset.line === line));
    $('#all', ctrl).setAttribute('aria-pressed', !line);
    $$('.hc-ev', wrap).forEach(v => v.classList.toggle('dim', !!line && !linesOf(EVENTS[+v.dataset.ev]).includes(line)));
    $$('.hc-mini i', wrap).forEach((t, i) => t.style.opacity = !line || linesOf(EVENTS[i]).includes(line) ? '' : .15);
  }
  function select(i, smooth = true){
    cur = i; const e = EVENTS[i];
    $$('.hc-ev', wrap).forEach(v => v.classList.toggle('sel', +v.dataset.ev === i));
    $$('.hc-yr', wrap).forEach(v => v.classList.toggle('on', +v.dataset.yi === i));
    det.innerHTML = '<div class="y">' + esc(e.y) + '</div><div><h2>' + esc(e.h) + '</h2><p>' + esc(e.t) + '</p>' +
      '<div>' + linesOf(e).map(l => '<button class="ltag" data-line="' + l + '" style="--c:' + color(l) + '">' + esc(names[l]) + '</button>').join('') + '</div>' +
      '<div style="margin-top:4px">' + (e.people || []).map(personChip).join('') + (e.place ? placeChip(e.place) : '') + '</div></div>' +
      '<div class="hc-nav"><button class="btn" data-go="-1"' + (i ? '' : ' disabled') + '>←</button><span>' + (i + 1) + ' / ' + EVENTS.length + '</span><button class="btn" data-go="1"' + (i < EVENTS.length - 1 ? '' : ' disabled') + '>→</button></div>';
    det.classList.remove('swap'); void det.offsetWidth; det.classList.add('swap');
    sc.scrollTo({left:xs[i] - sc.clientWidth / 2 + 80, behavior:smooth ? 'smooth' : 'auto'});
    history.replaceState(null, '', '#/chronicle/' + i);
  }
  const step = d => { let k = cur + d; while (k >= 0 && k < EVENTS.length && line && !linesOf(EVENTS[k]).includes(line)) k += d; if (k >= 0 && k < EVENTS.length){ select(k); return true; } return false; };

  function stopPlay(){ if (!play) return; clearInterval(play); play = null; playBtn.setAttribute('aria-pressed', 'false'); playBtn.textContent = '▶ Проиграть'; }
  playBtn.onclick = () => {
    if (play) return stopPlay();
    if (cur >= EVENTS.length - 1) select(0);
    play = setInterval(() => { if (!step(1)) stopPlay(); }, 2400);
    playBtn.setAttribute('aria-pressed', 'true'); playBtn.textContent = '❚❚ Пауза';
  };
  $('#now', ctrl).onclick = () => { stopPlay(); select(nowIdx); };
  $('#all', ctrl).onclick = () => { if (line) setLine(line); };
  wrap.addEventListener('click', e => {
    const lb = e.target.closest('[data-line]'); if (lb){ setLine(lb.dataset.line); return; }
    const g = e.target.closest('[data-go]'); if (g){ stopPlay(); step(+g.dataset.go); }
  });

  let down = null, moved = false;
  sc.addEventListener('pointerdown', e => { if (e.button !== 0) return; down = {x:e.clientX, l:sc.scrollLeft, id:e.pointerId}; moved = false; });
  sc.addEventListener('pointermove', e => {
    if (!down) return; const dx = e.clientX - down.x;
    if (!moved && Math.abs(dx) > 5){ moved = true; sc.setPointerCapture(down.id); sc.classList.add('drag'); stopPlay(); }
    if (moved) sc.scrollLeft = down.l - dx;
  });
  const up = () => { down = null; sc.classList.remove('drag'); setTimeout(() => { moved = false; }, 0); };
  sc.addEventListener('pointerup', up); sc.addEventListener('pointercancel', up);
  sc.addEventListener('click', e => { if (moved) return; const b = e.target.closest('button[data-i]'); if (b){ stopPlay(); select(+b.dataset.i); } });
  sc.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)){ sc.scrollLeft += e.deltaY; e.preventDefault(); } }, {passive:false});

  const paintWin = () => { win.style.left = sc.scrollLeft / W * 100 + '%'; win.style.width = sc.clientWidth / W * 100 + '%'; };
  sc.addEventListener('scroll', paintWin);
  let miniDrag = false;
  const jump = e => { const r = mini.getBoundingClientRect(); sc.scrollLeft = (e.clientX - r.left) / r.width * W - sc.clientWidth / 2; };
  mini.addEventListener('pointerdown', e => { miniDrag = true; mini.setPointerCapture(e.pointerId); stopPlay(); jump(e); });
  mini.addEventListener('pointermove', e => { if (miniDrag) jump(e); });
  mini.addEventListener('pointerup', () => { miniDrag = false; });

  const keys = e => { if (e.target.closest('input,select,textarea')) return;
    if (e.key === 'ArrowRight'){ stopPlay(); step(1); } if (e.key === 'ArrowLeft'){ stopPlay(); step(-1); } };
  addEventListener('keydown', keys);
  addEventListener('resize', paintWin);

  const start = param != null && EVENTS[+param] ? +param : nowIdx;
  requestAnimationFrame(() => { select(start, false); paintWin(); });
  return () => { stopPlay(); removeEventListener('keydown', keys); removeEventListener('resize', paintWin); };
}
