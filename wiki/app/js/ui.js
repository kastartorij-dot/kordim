/* Общие утилиты: DOM, ссылки, карта, путешествие, пикселизация, разговор. */
import { PLACES, placeById } from '../data/places.js';
import { ROUTES } from '../data/routes.js';
import { personById } from '../data/people.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const IMG = '../img/';
export const MAP_IMG = IMG + 'maps/kordim.jpg';

export function personChip(id){
  const p = personById(id); if (!p) return '';
  /* портрет ищется и по имени файла faces/<id>.jpg: положил файл — он появился */
  const av = '<img src="' + IMG + (p.img || 'faces/' + p.id + '.jpg') + '" alt="" onerror="this.remove()">';
  return '<a class="chip" href="#/person/' + id + '">' + av + esc(p.name) + '</a>';
}
export function placeChip(id){
  const p = placeById(id); if (!p) return '';
  return '<a class="chip" href="#/place/' + id + '">◆ ' + esc(p.name) + '</a>';
}

/* ─── карта ─── */
const NS = 'http://www.w3.org/2000/svg';
export function mapHTML(extra = ''){
  return '<img src="' + MAP_IMG + '" alt="Карта Кордима" draggable="false"><svg viewBox="0 0 100 100" preserveAspectRatio="none"></svg>' + extra;
}
export function drawRoutes(svg, onPick){
  ROUTES.forEach((r, i) => {
    const pts = r.p.map(q => q.join(',')).join(' ');
    const a = document.createElementNS(NS, 'polyline');
    a.setAttribute('points', pts); a.setAttribute('class', 'route ' + r.k); a.dataset.i = i;
    if (onPick) a.addEventListener('click', e => { e.stopPropagation(); onPick(i); });
    const f = document.createElementNS(NS, 'polyline');
    f.setAttribute('points', pts); f.setAttribute('class', 'flow');
    svg.append(a, f);
  });
}
export function markRoute(svg, i, season = 'summer', mode = 'horse'){
  const lines = svg.querySelectorAll('.route'), flows = svg.querySelectorAll('.flow');
  ROUTES.forEach((r, k) => {
    const c = closedFor(r, season, mode);
    lines[k].classList.toggle('sel', k === i);
    lines[k].classList.toggle('closed', c);
    flows[k].classList.toggle('sel', k === i && !c);
  });
}
export function drawPins(map, onPick){
  PLACES.filter(p => p.x != null).forEach(p => {
    const b = document.createElement('button');
    b.className = 'pin'; b.style.left = p.x + '%'; b.style.top = p.y + '%'; b.dataset.id = p.id;
    b.innerHTML = '<i></i><span>' + esc(p.name) + '</span>';
    b.addEventListener('click', e => { e.stopPropagation(); onPick ? onPick(p.id) : (location.hash = '#/place/' + p.id); });
    map.appendChild(b);
  });
}
export function markPlace(map, id){
  $$('.pin', map).forEach(p => p.classList.toggle('here', p.dataset.id === id));
}

export const SPEED = {horse:37, foot:22, cart:15};
export const MODE_LABEL = {horse:'верхом', foot:'пешком', cart:'обозом'};
export function daysFor(r, season, mode){
  let d = r.miles / SPEED[mode];
  if (r.ground && season !== 'summer') d *= season === 'winter' ? 2.2 : 1.6;
  return d;
}
export function closedFor(r, season, mode){
  return season === 'winter' && (r.k === 'water' || (r.k === 'rough' && mode === 'cart'));
}
export const fmt = d => d.toFixed(1).replace('.0', '').replace('.', ',');

/* путешествие: токен идёт по линии, дни и события — в колбэки */
export function travel(r, {token, days, onDay, onEvent, onDone, speed = 90}){
  const pts = [];
  for (let s = 0; s < r.p.length - 1; s++)
    for (let t = 0; t < 12; t++){
      const a = r.p[s], b = r.p[s + 1];
      pts.push([a[0] + (b[0] - a[0]) * t / 12, a[1] + (b[1] - a[1]) * t / 12]);
    }
  pts.push(r.p[r.p.length - 1]);
  const total = Math.max(1, Math.round(days)), every = Math.max(1, Math.floor(pts.length / r.ev.length));
  let k = 0, last = 0;
  token.hidden = false;
  const id = setInterval(() => {
    const [x, y] = pts[k];
    token.style.left = x + '%'; token.style.top = y + '%';
    const day = Math.min(total, Math.floor(k / pts.length * total) + 1);
    if (day !== last){ last = day; onDay && onDay(day, total); }
    if (k % every === 0){ const e = r.ev[k / every]; if (e) onEvent && onEvent(e.replace(/^!/, ''), day, e.startsWith('!')); }
    if (++k >= pts.length){ clearInterval(id); onDone && onDone(total); }
  }, speed);
  return () => { clearInterval(id); token.hidden = true; };
}

/* ─── пикселизация (средний пиксель: size 140, levels 8) ─── */
const cache = {};
export function pixelate(src, canvas, {size = 140, levels = 8, focusY = .22} = {}){
  const draw = img => {
    const box = canvas.getBoundingClientRect();
    const ratio = box.width ? box.height / box.width : 1.3;
    canvas.width = size; canvas.height = Math.round(size * ratio);
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = true;
    const cw = canvas.width, ch = canvas.height, ir = img.width / img.height, cr = cw / ch;
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    if (ir > cr){ sw = img.height * cr; sx = (img.width - sw) / 2; } else { sh = img.width / cr; sy = (img.height - sh) * focusY; }
    c.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    if (levels){
      const step = 255 / (levels - 1), d = c.getImageData(0, 0, cw, ch), a = d.data;
      for (let i = 0; i < a.length; i += 4) for (let q = 0; q < 3; q++) a[i + q] = Math.round(a[i + q] / step) * step;
      c.putImageData(d, 0, 0);
    }
  };
  if (cache[src] && cache[src].complete) return draw(cache[src]);
  const img = cache[src] = new Image(); img.onload = () => draw(img); img.src = src;
}

/* ─── разговор с выборами ─── */
export function mountChat(box, tree, {onGain, gains = {}, typing = 24} = {}){
  box.innerHTML = '';
  const log = document.createElement('div'); log.className = 'chat-log';
  const opts = document.createElement('div'); opts.className = 'chat-opts';
  box.append(log, opts);
  let timer = null;
  const add = (cls, html) => { const d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = html; log.appendChild(d); log.scrollTop = 1e9; return d; };
  function step(key){
    const n = tree[key]; opts.innerHTML = '';
    if (n.note) add('sys', esc(n.note));
    const m = add(n.who ? 'them' : 'sys', n.who ? '<b>' + esc(n.who) + '</b><span></span>' : '<span></span>');
    const span = m.querySelector('span'); let k = 0;
    clearInterval(timer);
    timer = setInterval(() => {
      span.textContent = n.say.slice(0, ++k); log.scrollTop = 1e9;
      if (k < n.say.length) return;
      clearInterval(timer);
      if (n.gain && onGain && gains[n.gain]) onGain(gains[n.gain]);
      if (n.next) return setTimeout(() => step(n.next), 700);
      if (n.final){
        const b = document.createElement('button'); b.textContent = '↺ Сначала';
        b.onclick = () => mountChat(box, tree, {onGain, gains, typing}); opts.appendChild(b); return;
      }
      (n.opts || []).forEach(([label, to]) => {
        const b = document.createElement('button'); b.textContent = label;
        b.onclick = () => { add('me', esc(label)); step(to); };
        opts.appendChild(b);
      });
    }, typing);
  }
  step('start');
  return () => clearInterval(timer);
}

export function countUp(nodes, from, to, ms = 500){
  const t0 = performance.now();
  (function f(t){
    const k = Math.min(1, (t - t0) / ms), v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    nodes.forEach(n => n.textContent = v);
    if (k < 1) requestAnimationFrame(f);
  })(t0);
}
