/* «План» — единый план развития мира и справочника. Данные собираются из Канон/ПЛАН_развития.md
   скриптом Канон/_Сборка/export-plan.mjs; проценты считаются здесь: [x] = 1, [~] = ½, [3/13] = 3/13. */
import { $, $$, esc } from '../ui.js';
import { PLAN } from '../../Данные/plan.js';

const COLORS = ['#d9a441', '#d46a4a', '#8ea7d6', '#9bb383', '#c58fb0', '#7fb0c2', '#d08a5a', '#cfc6b4'];
const EFFORT = ['', 'час', 'полсессии', 'сессия и больше'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const YEAR = 2026;

const avg = items => items.length ? items.reduce((s, x) => s + x.p, 0) / items.length : 0;
const pct = v => Math.round(v * 100);
const areasOf = g => g.areas;
const allAreas = () => [...PLAN.now, ...PLAN.groups.flatMap(areasOf)];
const allItems = () => allAreas().flatMap(a => a.items);

/* общая сводка — её же показывает плитка на главной */
export function progress(){
  const items = allItems();
  return {
    total: pct(avg(items)),
    groups: PLAN.groups.map(g => ({ title: g.title, p: pct(avg(g.areas.flatMap(a => a.items))) })),
    decisions: pct(avg(PLAN.decisions)),
    open: items.filter(x => x.st !== 'done').length,
  };
}

/* строка плана — мини-markdown: `код`, **жирный**, [текст](ссылка) → текст */
const md = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
const plural = (n, f) => f[(n % 10 === 1 && n % 100 !== 11) ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 1 : 2];
const dots = e => e ? '<span class="pl-eff" title="' + EFFORT[e] + '">' + '●'.repeat(e) + '<i>' + '●'.repeat(3 - e) + '</i></span>' : '';
const dateLabel = d => { const [dd, mm] = d.split('.').map(Number); return dd + ' ' + MONTHS[mm - 1]; };

function itemHTML(x){
  const icon = x.st === 'done' ? '<span class="pl-ic s-done" aria-label="сделано">✓</span>'
    : x.st === 'part' ? '<span class="pl-ic s-part" aria-label="частично" style="--p:' + pct(x.p) + '%"></span>'
    : '<span class="pl-ic s-open" aria-label="не сделано"></span>';
  const frac = x.frac ? '<span class="pl-frac"><span class="pl-frac-bar"><i style="width:' + pct(x.p) + '%"></i></span>' + x.frac[0] + ' из ' + x.frac[1] + '</span>' : '';
  return '<li class="pl-it s-' + x.st + '" data-st="' + x.st + '" data-a="' + (x.author ? 1 : 0) + '">' + icon +
    '<div class="pl-tx"><span>' + md(x.text) + '</span>' + frac +
    '<div class="pl-meta">' + (x.author ? '<span class="pl-a" title="Нужен ответ автора">автор</span>' : '') + dots(x.effort) +
    (x.date ? '<span class="pl-date">' + esc(dateLabel(x.date)) + '</span>' : '') +
    (x.refs ? '<span class="pl-ref">' + md(x.refs) + '</span>' : '') + '</div></div></li>';
}

function meter(items){
  const n = items.length || 1, done = items.filter(x => x.st === 'done').length, part = items.reduce((s, x) => s + (x.st === 'part' ? x.p : 0), 0);
  return '<div class="pl-meter" role="img" aria-label="готово ' + pct(avg(items)) + '%"><i class="d" data-w="' + (done / n * 100) + '"></i><i class="h" data-w="' + (part / n * 100) + '"></i></div>';
}

function areaCard(a, color){
  const p = pct(avg(a.items)), open = a.items.filter(x => x.st !== 'done'), done = a.items.filter(x => x.st === 'done');
  const author = open.filter(x => x.author).length;
  return '<article class="pl-area card" style="--c:' + color + '">' +
    '<header><div><h3>' + esc(a.title) + '</h3><p>' + done.length + ' из ' + a.items.length + ' сделано' +
    (author ? ' · <span class="pl-a-txt">' + author + ' ждёт автора</span>' : '') + '</p></div>' +
    '<b class="pl-big" data-n="' + p + '">0<small>%</small></b></header>' + meter(a.items) +
    (open.length ? '<ul class="pl-list">' + open.map(itemHTML).join('') + '</ul>' : '<p class="pl-clear">Всё сделано</p>') +
    (done.length ? '<details class="pl-done"><summary>сделано · ' + done.length + '</summary><ul class="pl-list">' + done.map(itemHTML).join('') + '</ul></details>' : '') +
    '</article>';
}

/* кольца: общее снаружи, группы внутри */
function rings(stats){
  const R = [96, 74, 52], W = 15;
  const arcs = [[stats.total, 'url(#plg0)', 'Всё'], ...stats.groups.map((g, i) => [g.p, 'url(#plg' + (i + 1) + ')', g.title])];
  return '<svg class="pl-rings" viewBox="0 0 220 220" role="img" aria-label="Готовность плана ' + stats.total + '%"><defs>' +
    '<linearGradient id="plg0" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0c165"/><stop offset="1" stop-color="#d46a4a"/></linearGradient>' +
    '<linearGradient id="plg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c6dcae"/><stop offset="1" stop-color="#7f9b68"/></linearGradient>' +
    '<linearGradient id="plg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9cdf0"/><stop offset="1" stop-color="#6c86b8"/></linearGradient></defs>' +
    arcs.map(([p, stroke], i) => { const r = R[i], c = 2 * Math.PI * r;
      return '<circle cx="110" cy="110" r="' + r + '" class="pl-track" stroke-width="' + W + '"/>' +
        '<circle cx="110" cy="110" r="' + r + '" class="pl-arc" stroke="' + stroke + '" stroke-width="' + W + '" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" data-off="' + (c * (1 - p / 100)) + '" transform="rotate(-90 110 110)"/>'; }).join('') +
    '</svg>';
}

function nowHTML(a){
  const firstOpen = a.items.findIndex(x => x.st !== 'done');
  return '<section class="pl-now card"><div class="pl-now-h"><div><div class="eyebrow">сейчас в работе</div><h2>' + esc(a.title) + '</h2></div>' +
    '<b class="pl-big" data-n="' + pct(avg(a.items)) + '">0<small>%</small></b></div>' +
    '<ol class="pl-steps">' + a.items.map((x, i) => '<li class="s-' + x.st + (i === firstOpen ? ' s-cur' : '') + '"><span class="pl-dot">' + (x.st === 'done' ? '✓' : i + 1) + '</span>' +
      '<b>' + md(x.text) + '</b>' + (x.date ? '<small>' + esc(dateLabel(x.date)) + '</small>' : x.author ? '<small class="pl-a-txt">ждёт автора</small>' : x.effort ? '<small>' + EFFORT[x.effort] + '</small>' : '') + '</li>').join('') + '</ol></section>';
}

function decisionsHTML(){
  const D = PLAN.decisions, open = D.filter(x => x.st !== 'done'), done = D.filter(x => x.st === 'done');
  return '<section class="pl-dec card"><h3>ЖДЁТ РЕШЕНИЯ АВТОРА <small>решено ' + done.length + ' из ' + D.length + '</small></h3>' +
    '<div class="pl-dec-top"><b class="pl-big" data-n="' + pct(avg(D)) + '">0<small>%</small></b>' + meter(D) + '</div>' +
    '<ol class="pl-qs">' + open.map(x => '<li><span>' + md(x.text) + '</span>' + (x.refs ? '<span class="pl-ref">' + md(x.refs) + '</span>' : '') + '</li>').join('') + '</ol>' +
    '<details class="pl-done"><summary>уже решено · ' + done.length + '</summary><ul class="pl-list">' + done.map(itemHTML).join('') + '</ul></details></section>';
}

function orderHTML(){
  return '<section class="pl-order"><div class="eyebrow">порядок</div><h2 class="pl-h2">Что дальше</h2><ol class="pl-road">' +
    PLAN.order.map(o => '<li><span class="pl-num">' + o.n + '</span><div><b>' + md(o.title) + ' ' + dots(o.effort) + '</b><p>' + md(o.text) + '</p></div></li>').join('') + '</ol></section>';
}

/* лента сделанного: квадратики по дням с 1 сентября + список по датам */
function historyHTML(){
  const all = [...allAreas().flatMap(a => a.items.map(x => [x, a.title])), ...PLAN.decisions.map(x => [x, 'Решение автора'])].filter(([x]) => x.st === 'done' && x.date);
  const byDate = new Map();
  all.forEach(([x, from]) => { const k = x.date; if (!byDate.has(k)) byDate.set(k, []); byDate.get(k).push([x, from]); });
  const key = d => { const [dd, mm] = d.split('.').map(Number); return new Date(YEAR, mm - 1, dd); };
  const dates = [...byDate.keys()].sort((a, b) => key(b) - key(a));
  const start = new Date(YEAR, 8, 1), last = new Date(Math.max(Date.now(), ...dates.map(d => +key(d))));
  const max = Math.max(...[...byDate.values()].map(v => v.length));
  let cells = '', month = -1;
  for (let d = new Date(start); d <= last; d.setDate(d.getDate() + 1)){
    const k = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0'), n = (byDate.get(k) || []).length;
    if (d.getMonth() !== month){ month = d.getMonth(); cells += '<span class="pl-mon">' + MONTHS[month].slice(0, 3) + '</span>'; }
    cells += '<span class="pl-day' + (n ? ' on' : '') + '" style="--k:' + (n ? n / max : 0) + '" title="' + d.getDate() + ' ' + MONTHS[d.getMonth()] + (n ? ': ' + n + ' ' + plural(n, ['пункт', 'пункта', 'пунктов']) : '') + '"></span>';
  }
  return '<section class="pl-hist"><div class="eyebrow">история</div><h2 class="pl-h2">Сделано по датам <small>' + all.length + '</small></h2>' +
    '<div class="pl-heat">' + cells + '</div><div class="pl-days">' + dates.map(k => '<div class="pl-dayrow"><div class="pl-dayk"><b>' + esc(dateLabel(k)) + '</b><small>' + byDate.get(k).length + '</small></div><ul>' +
      byDate.get(k).map(([x, from]) => '<li><span>' + md(x.text) + '</span><small>' + esc(from) + '</small></li>').join('') + '</ul></div>').join('') + '</div></section>';
}

const FILTERS = [['all', 'Всё'], ['open', 'Открыто'], ['free', 'Без автора'], ['author', 'Ждёт автора'], ['done', 'Сделано']];
const match = (li, f) => f === 'all' || (f === 'done' ? li.dataset.st === 'done' : li.dataset.st !== 'done' && (f === 'open' || (f === 'author') === (li.dataset.a === '1')));

export function render(root){
  const S = progress(), items = allItems();
  const cnt = st => items.filter(x => x.st === st).length;
  let color = 0;
  root.innerHTML = `<div class="page plan" data-title="План">
    <div class="pl-hero">
      <div>
        <div class="eyebrow">работа над миром · без игр</div>
        <h1 class="h1">План</h1>
        <p class="lead">Что уже сделано в мире и справочнике, что открыто и в каком порядке идти. Собрано из <code>Канон/ПЛАН_развития.md</code>; процент — средняя готовность пунктов, частично сделанное идёт за половину.</p>
        <div class="pl-stats">
          <span><b data-n="${cnt('done')}">0</b>сделано</span><span><b data-n="${cnt('part')}">0</b>частично</span>
          <span><b data-n="${cnt('open')}">0</b>не начато</span><span class="pl-a-txt"><b data-n="${PLAN.decisions.filter(x => x.st !== 'done').length}">0</b>вопросов автору</span>
        </div>
      </div>
      <div class="pl-ringwrap">${rings(S)}
        <div class="pl-ringc"><b data-n="${S.total}">0</b><small>% готово</small></div>
        <ul class="pl-legend"><li style="--c:#e8a95a">Всё <b>${S.total}%</b></li>${S.groups.map((g, i) => '<li style="--c:' + ['#9bb383', '#8ea7d6'][i] + '">' + esc(g.title) + ' <b>' + g.p + '%</b></li>').join('')}</ul>
      </div>
    </div>
    ${PLAN.now.map(nowHTML).join('')}
    <div class="pl-bar"><div class="seg" role="group" aria-label="Показать пункты">${FILTERS.map(([k, l]) => '<button data-f="' + k + '" aria-pressed="false">' + l + '</button>').join('')}</div></div>
    ${PLAN.groups.map(g => { const p = pct(avg(g.areas.flatMap(a => a.items)));
      return '<section class="pl-group"><div class="pl-gh"><h2 class="pl-h2">' + esc(g.title) + '</h2><b class="pl-gp" data-n="' + p + '">0<small>%</small></b></div>' +
        meter(g.areas.flatMap(a => a.items)) + '<div class="pl-grid">' + g.areas.map(a => areaCard(a, COLORS[color++ % COLORS.length])).join('') + '</div></section>'; }).join('')}
    <div class="pl-two">${decisionsHTML()}${orderHTML()}</div>
    ${historyHTML()}
    <details class="pl-drop card"><summary>Снято · ${PLAN.dropped.length} <small>и почему</small></summary><ul>${PLAN.dropped.map(x => '<li>' + md(x.text) + (x.refs ? ' <span class="pl-ref">' + md(x.refs) + '</span>' : '') + '</li>').join('')}</ul></details>
    <p class="pl-foot">Закрыл пункт — <code>[x]</code> и <code>✓ ДД.ММ</code> в <code>Канон/ПЛАН_развития.md</code>, затем <code>node Канон/_Сборка/export-plan.mjs</code>. Коды источников (О §, Л, ПИ, ИФ, РП, КТ) расшифрованы в начале файла.</p>
  </div>`;

  /* фильтр пунктов — помним выбор на этом устройстве */
  let f = 'all';
  try { f = localStorage.getItem('kordim-plan-f') || 'all'; } catch (e) {}
  function apply(){
    $$('[data-f]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.f === f));
    $$('.pl-area', root).forEach(card => {
      let shown = 0;
      $$('.pl-it', card).forEach(li => { const ok = match(li, f); li.hidden = !ok; shown += ok; });
      const det = $('.pl-done', card); if (det) det.open = f === 'done';
      card.classList.toggle('pl-dim', !shown);
    });
  }
  $$('[data-f]', root).forEach(b => b.onclick = () => { f = b.dataset.f; try { localStorage.setItem('kordim-plan-f', f); } catch (e) {} apply(); });
  apply();

  /* въезд: кольца, полосы и числа набегают от нуля */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  const t0 = performance.now(), nums = $$('[data-n]', root);
  requestAnimationFrame(() => {
    $$('.pl-arc', root).forEach(c => c.style.strokeDashoffset = c.dataset.off);
    $$('.pl-meter i', root).forEach(i => i.style.width = i.dataset.w + '%');
  });
  const tick = now => {
    const k = reduce ? 1 : Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - k, 3);
    nums.forEach(el => { const n = +el.dataset.n, v = Math.round(n * e); el.firstChild.nodeValue = v; });
    if (k < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
