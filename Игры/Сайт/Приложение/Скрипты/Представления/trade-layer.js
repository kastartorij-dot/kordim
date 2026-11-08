/* Слой «Торговля» на общей карте: что где берут, что по какому тракту идёт, где горло.
   Данные — Данные/trade.js (запись 25). Нажми значок — что это и кто держит; нажми тракт — что по нему везут;
   «перекрыть» — что встаёт, по «Рычагам» записи 25. */
import { $, $$, esc } from '../ui.js';
import { ROUTES } from '../../Данные/routes.js';
import { placeById } from '../../Данные/places.js';
import { RESOURCES, LEVERS } from '../../Данные/trade.js';

let ctx = null, cur = null;   // cur: {kind:'res'|'lever'|'route', id}

export function mount(c){
  ctx = c;
  if (!$('.res-mark', ctx.map)) {
    const at = {};   // несколько значков у одного места — в ряд
    RESOURCES.forEach(r => r.places.forEach(pid => {
      const p = placeById(pid); if (!p || p.x == null) return;
      const k = at[pid] = (at[pid] || 0) + 1;
      const b = document.createElement('button');
      b.className = 'res-mark'; b.dataset.res = r.id; b.title = r.n; b.setAttribute('aria-label', r.n);
      b.style.left = 'calc(' + p.x + '% + ' + (k * 22 - 4) + 'px)'; b.style.top = 'calc(' + p.y + '% + 14px)';
      b.textContent = r.mark;
      b.addEventListener('click', e => { e.stopPropagation(); cur = {kind:'res', id:r.id}; paint(); });
      ctx.map.appendChild(b);
    }));
  }
  ctx.map.classList.add('trade');
  paint();
}
export function unmount(map){
  map.classList.remove('trade');
  $$('.res-mark', map).forEach(b => b.remove());
  $$('.route', map).forEach(l => l.classList.remove('cut', 'hit'));
  ctx = null;
}
export function pickRoute(i){ cur = {kind:'route', id:ROUTES[i].id}; paint(); }
export function pickPlace(id){
  const lever = LEVERS.find(l => l.place === id);
  const res = RESOURCES.find(r => r.places.includes(id));
  cur = lever ? {kind:'lever', id:lever.id} : res ? {kind:'res', id:res.id} : null;
  if (!cur) { location.hash = '#/place/' + id; return; }
  paint();
}

function paint(){
  if (!ctx) return;
  const lines = ctx.svg.querySelectorAll('.route');
  const lever = cur?.kind === 'lever' ? LEVERS.find(l => l.id === cur.id) : null;
  const res = cur?.kind === 'res' ? RESOURCES.find(r => r.id === cur.id) : null;
  const route = cur?.kind === 'route' ? ROUTES.find(r => r.id === cur.id) : null;
  const hitRes = new Set(lever ? lever.hits : []);
  /* что видно на тракте: перерезан рычагом, везёт выбранное, просто выбран */
  ROUTES.forEach((r, k) => {
    lines[k].classList.toggle('cut', !!lever && lever.routes.includes(r.id));
    lines[k].classList.toggle('hit', !!res && res.routes.includes(r.id) || !!lever && RESOURCES.some(x => hitRes.has(x.id) && x.routes.includes(r.id)) && !lever.routes.includes(r.id));
    lines[k].classList.toggle('sel', route === r);
    lines[k].classList.remove('closed');
  });
  $$('.res-mark', ctx.map).forEach(b => {
    b.classList.toggle('on', !!res && b.dataset.res === res.id);
    b.classList.toggle('hit', hitRes.has(b.dataset.res));
  });
  $$('.pin', ctx.map).forEach(p => p.classList.toggle('here', !!lever && p.dataset.id === lever.place));

  const name = id => placeById(id)?.name || id;
  let detail = '';
  if (res) detail = '<div class="tr-detail"><h3>' + res.mark + ' ' + esc(res.n) + '</h3><p>' + esc(res.t) + '</p><p class="evline">Держит: ' + esc(res.who) + '</p>' +
    (res.places.length ? '<p class="evline">Где: ' + res.places.map(id => '<a href="#/place/' + id + '">' + esc(name(id)) + '</a>').join(', ') + '</p>' : '') + '</div>';
  if (lever) detail = '<div class="tr-detail lever"><h3>' + esc(lever.n) + '</h3><p>' + esc(lever.t) + '</p>' +
    (lever.hits.length ? '<p class="evline bad">Встаёт: ' + lever.hits.map(id => { const r = RESOURCES.find(x => x.id === id); return r.mark + ' ' + esc(r.n); }).join(', ') + '</p>' : '') + '</div>';
  if (route) detail = '<div class="tr-detail"><h3>' + esc(route.n) + '</h3><p>' + esc(route.goods) + '</p><p class="evline">Держит: ' + esc(route.holder) + '</p>' +
    (ctx.season === 'winter' && route.winter ? '<p class="evline bad">Зимой: ' + esc(route.winter) + '</p>' : '') + '</div>';
  if (!detail) detail = '<p class="tr-hint">Нажми значок — что там берут и кто держит. Нажми тракт — что по нему везут. Или перекрой горло и посмотри, что встанет.</p>';

  ctx.sum.innerHTML = 'Торговля' + (lever ? ' <b>' + esc(lever.n.toLowerCase()) + '</b>' : res ? ' <b>' + esc(res.n.toLowerCase()) + '</b>' : '');
  ctx.box.innerHTML = detail +
    '<div class="tr-group"><small>что где берут</small><div class="tr-chips">' + RESOURCES.map(r => '<button data-res="' + r.id + '" aria-pressed="' + (res === r) + '" class="' + (hitRes.has(r.id) ? 'hit' : '') + '">' + r.mark + ' ' + esc(r.n) + '</button>').join('') + '</div></div>' +
    '<div class="tr-group"><small>рычаги — что если перекрыть</small><div class="tr-chips">' + LEVERS.map(l => '<button data-lever="' + l.id + '" aria-pressed="' + (lever === l) + '" class="lever">' + esc(l.n) + '</button>').join('') + '</div></div>' +
    (ctx.season === 'winter' ? '<p class="evline">Зимой баржи стоят около двух месяцев, лесной тракт для обозов закрыт, Монтин — тоже: часть рычагов дёргает сама погода.</p>' : '') +
    '<a class="canon-src" href="#/canon/' + encodeURIComponent('записи-25') + '">Запись 25 «Ресурсы и торговля» →</a>';
  $$('[data-res]', ctx.box).forEach(b => b.onclick = () => { cur = cur?.kind === 'res' && cur.id === b.dataset.res ? null : {kind:'res', id:b.dataset.res}; paint(); });
  $$('[data-lever]', ctx.box).forEach(b => b.onclick = () => { cur = cur?.kind === 'lever' && cur.id === b.dataset.lever ? null : {kind:'lever', id:b.dataset.lever}; paint(); });
}
