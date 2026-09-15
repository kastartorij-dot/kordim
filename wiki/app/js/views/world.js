/* Мир: статьи с шапкой, крупными цифрами, карточками разделов и интерактивными вставками. */
import { $, $$, esc, IMG, SPEED, MODE_LABEL } from '../ui.js';
import { ARTICLES } from '../../data/articles.js';
import { GOODS } from '../../data/goods.js';
import { icon } from '../icons.js';

const heroBg = id => "background-image:url('" + IMG + 'world/' + id + ".jpg'),radial-gradient(circle at 85% 30%,rgba(217,164,65,.22),transparent 55%),repeating-linear-gradient(135deg,rgba(255,255,255,.025) 0 2px,transparent 2px 14px)";
const WIDGETS = { shop, coins, travel:travelCalc };

export function render(root, [id]){
  const a = ARTICLES.find(x => x.id === id) || ARTICLES[0];
  root.innerHTML = `<div class="page" data-title="${esc(a.title)}">
    <div class="eyebrow">как устроен мир</div><h1 class="h1">Мир</h1>
    <div class="world-grid">
      <nav class="toc" aria-label="Статьи">${ARTICLES.map(x => '<a href="#/world/' + x.id + '" aria-current="' + (x === a) + '">' + icon(x.icon, 18) + esc(x.title) + '</a>').join('')}</nav>
      <article class="warticle">
        <header class="whero" style="${heroBg(a.id)}"><span class="big">${icon(a.icon, 84)}</span><h2>${esc(a.title)}</h2></header>
        <p class="wlead">${esc(a.lead)}</p>
        ${a.facts ? '<div class="facts">' + a.facts.map(([v, l], i) => '<div class="fact" style="animation-delay:' + i * 80 + 'ms"><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>').join('') + '</div>' : ''}
        <div id="widgets"></div>
        <div class="wsecs">${a.sections.map(([h, ps], i) => '<section class="card wsec"><h3><i>' + String(i + 1).padStart(2, '0') + '</i>' + esc(h) + '</h3>' + ps.map(p => '<p>' + esc(p) + '</p>').join('') + '</section>').join('')}</div>
      </article>
    </div>
  </div>`;
  const box = $('#widgets', root);
  [].concat(a.widget || []).forEach(w => { if (!WIDGETS[w]) return; const d = document.createElement('section'); box.appendChild(d); WIDGETS[w](d); });
}

const n1 = v => v.toLocaleString('ru-RU', {maximumFractionDigits:1});
const plural = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2]; };
const seg = (name, pairs, on) => '<div class="seg" role="group">' + pairs.map(([k, l]) => '<button data-' + name + '="' + k + '" aria-pressed="' + (k === on) + '">' + l + '</button>').join('') + '</div>';
function bindSeg(box, name, cb){
  $$('[data-' + name + ']', box).forEach(b => b.onclick = () => { $$('[data-' + name + ']', box).forEach(x => x.setAttribute('aria-pressed', x === b)); cb(b.dataset[name]); });
}

/* цена в грошах → «15–20 кордов», «3–5 марок», «2 гроша» */
function money(lo, hi){
  const unit = hi >= 200 ? [200, ['корд', 'корда', 'кордов']] : hi >= 10 ? [10, ['марка', 'марки', 'марок']] : [1, ['грош', 'гроша', 'грошей']];
  const a = lo / unit[0], b = hi / unit[0], f = v => n1(v);
  return (a === b ? f(a) : f(a) + '–' + f(b)) + ' ' + plural(Math.round(b), unit[1]);
}
/* сколько это в работе подёнщика: 9 грошей в день, 25 рабочих дней в месяц */
function inLife(g){
  const d = g / 9;
  if (d < 1) return 'меньше дня работы подёнщика';
  if (d < 60) return '≈ ' + n1(d) + ' ' + plural(Math.round(d), ['день', 'дня', 'дней']) + ' работы подёнщика';
  const m = d / 25;
  /* дробное число в русском берёт форму «года», «месяца», «дня» */
  const form = (v, f) => Number.isInteger(+n1(v).replace(',', '.')) ? plural(Math.round(v), f) : f[1];
  if (m < 24) return '≈ ' + n1(m) + ' ' + form(m, ['месяц', 'месяца', 'месяцев']) + ' работы подёнщика без пропусков';
  return '≈ ' + n1(m / 12) + ' ' + form(m / 12, ['год', 'года', 'лет']) + ' работы подёнщика';
}

/* что почём: выпадающий список товаров и цена рядом */
function shop(box){
  box.className = 'card widget';
  box.innerHTML = '<h3>ЧТО ПОЧЁМ В КОРДИМЕ</h3><div class="shop"><div class="shop-pic" id="spic"></div><div>' +
    '<select id="ssel" aria-label="Товар или услуга">' + GOODS.map(([g, items]) => '<optgroup label="' + esc(g) + '">' + items.map(it => '<option value="' + it[0] + '">' + esc(it[1]) + '</option>').join('') + '</optgroup>').join('') + '</select>' +
    '<div class="shop-price" id="sprice"></div><div class="shop-life" id="slife"></div><div class="shop-note" id="snote"></div></div></div>';
  const all = GOODS.flatMap(([, items]) => items), sel = $('#ssel', box);
  sel.value = 'crossbow-grace';
  const paint = () => {
    const [id, , lo, hi, emo, note] = all.find(x => x[0] === sel.value);
    const pic = $('#spic', box);
    pic.innerHTML = '<span>' + emo + '</span>';
    const im = new Image(); im.alt = ''; im.onload = () => { pic.innerHTML = ''; pic.appendChild(im); }; im.src = IMG + 'goods/' + id + '.png';
    const pr = $('#sprice', box); pr.textContent = money(lo, hi); pr.classList.remove('swap'); void pr.offsetWidth; pr.classList.add('swap');
    $('#slife', box).textContent = inLife((lo + hi) / 2);
    $('#snote', box).textContent = note;
  };
  sel.onchange = paint; paint();
}

/* пересчёт суммы в жизнь */
function coins(box){
  box.className = 'card widget';
  box.innerHTML = '<h3>ПЕРЕСЧЁТ В ЖИЗНЬ</h3><div class="row"><input type="number" id="amt" value="70" min="0" aria-label="Сумма">' +
    seg('u', [['200', 'кордов'], ['10', 'марок'], ['1', 'грошей']], '200') + '</div><div class="wout" id="out"></div>';
  let u = 200; const amt = $('#amt', box), out = $('#out', box);
  const paint = () => {
    const g = Math.max(0, +amt.value || 0) * u;
    const k = Math.floor(g / 200), m = Math.floor(g % 200 / 10), gr = Math.round(g % 10);
    out.innerHTML = [[k + ' · ' + m + ' · ' + gr, 'кордов · марок · грошей'], [n1(g / 9), 'дней работы подёнщика'], [n1(g / 10), 'ночей в отдельной комнате'],
      [n1(g), 'мисок похлёбки с хлебом'], [n1(g / 2200), 'верховых лошадей']].map(([b, s]) => '<div><b>' + b + '</b><small>' + s + '</small></div>').join('');
  };
  amt.oninput = paint; bindSeg(box, 'u', v => { u = +v; paint(); }); paint();
}

/* сколько идти */
function travelCalc(box){
  box.className = 'card widget';
  box.innerHTML = '<h3>СКОЛЬКО ИДТИ</h3><div class="row"><input type="range" id="mi" min="10" max="300" value="111" aria-label="Мили"><b id="mil"></b></div>' +
    '<div class="row" style="margin-top:10px">' + seg('m', Object.entries(MODE_LABEL), 'horse') + seg('s', [['summer', 'лето'], ['autumn', 'осень'], ['winter', 'зима']], 'autumn') + '</div><div class="wout" id="out"></div>';
  let mode = 'horse', season = 'autumn'; const mi = $('#mi', box), out = $('#out', box);
  const paint = () => {
    const miles = +mi.value, f = season === 'summer' ? 1 : season === 'winter' ? 2.2 : 1.6;
    const road = miles / SPEED[mode], ground = road * f;
    $('#mil', box).textContent = miles + ' миль' + (miles === 111 ? ' — Столица → Врата' : miles === 148 ? ' — лесной тракт' : '');
    out.innerHTML = [[n1(road), 'дней по мощёной дороге'], [n1(ground), 'дней по грунту в этот сезон'], [Math.ceil(ground) * 5 + ' гр.', 'ночлег и корм, если в общей комнате']]
      .map(([b, s]) => '<div><b>' + b + '</b><small>' + s + '</small></div>').join('');
  };
  mi.oninput = paint; bindSeg(box, 'm', v => { mode = v; paint(); }); bindSeg(box, 's', v => { season = v; paint(); }); paint();
}
