/* Мир: статьи с шапкой, крупными цифрами, карточками разделов и интерактивными вставками. */
import { $, $$, esc, IMG, plural, canonSources } from '../ui.js';
import { plan, MODE_LABEL, ROAD_PLACES, placeName, fmtDays, dayWord, moneyRound } from '../road.js';
import { ARTICLES } from '../../Данные/articles.js';
import { GOODS, COIN } from '../../Данные/goods.js';
/* средняя цена товара из goods.js, в грошах */
const avg = id => { const g = GOODS.flatMap(([, items]) => items).find(i => i[0] === id); return (g[2] + g[3]) / 2; };
import { icon } from '../icons.js';
import { WOUNDS, INFECTION, UNIT_DAYS, UNIT_FORMS, woundById } from '../../Данные/wounds.js';

const heroBg = id => "background-image:url('" + IMG + 'Мир/' + id + ".jpg'),radial-gradient(circle at 85% 30%,rgba(217,164,65,.22),transparent 55%),repeating-linear-gradient(135deg,rgba(255,255,255,.025) 0 2px,transparent 2px 14px)";
const WIDGETS = { shop, coins, travel:travelCalc, wound:woundCalc };

export function render(root, [id]){
  const a = ARTICLES.find(x => x.id === id) || ARTICLES[0];
  root.innerHTML = `<div class="page" data-title="${esc(a.title)}">
    <div class="eyebrow">как устроен мир</div><h1 class="h1">Мир</h1>
    <div class="world-grid">
      <nav class="toc" aria-label="Статьи">${ARTICLES.map(x => '<a href="#/world/' + x.id + '" aria-current="' + (x === a) + '">' + icon(x.icon, 18) + esc(x.title) + '</a>').join('')}</nav>
      <article class="warticle">
        <header class="whero" style="${heroBg(a.id)}"><span class="big">${icon(a.icon, 84)}</span><h2>${esc(a.title)}</h2></header>
        <p class="wlead">${esc(a.lead)}</p>
        ${canonSources('articles', a.id)}
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
const seg = (name, pairs, on) => '<div class="seg" role="group">' + pairs.map(([k, l]) => '<button data-' + name + '="' + k + '" aria-pressed="' + (k === on) + '">' + l + '</button>').join('') + '</div>';
function bindSeg(box, name, cb){
  $$('[data-' + name + ']', box).forEach(b => b.onclick = () => { $$('[data-' + name + ']', box).forEach(x => x.setAttribute('aria-pressed', x === b)); cb(b.dataset[name]); });
}

/* цена в грошах → «15–20 кордов», «3–5 марок», «2 гроша» */
function money(lo, hi){
  const unit = hi >= COIN.корд ? [COIN.корд, ['корд', 'корда', 'кордов']] : hi >= COIN.марка ? [COIN.марка, ['марка', 'марки', 'марок']] : [1, ['грош', 'гроша', 'грошей']];
  const a = lo / unit[0], b = hi / unit[0], f = v => n1(v);
  return (a === b ? f(a) : f(a) + '–' + f(b)) + ' ' + plural(Math.round(b), unit[1]);
}
/* сколько это в работе подёнщика: средний дневной заработок из goods.js, 25 рабочих дней в месяц */
function inLife(g){
  const d = g / avg('day-labour');
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
    seg('u', [[String(COIN.корд), 'кордов'], [String(COIN.марка), 'марок'], ['1', 'грошей']], String(COIN.корд)) + '</div><div class="wout" id="out"></div>';
  let u = COIN.корд; const amt = $('#amt', box), out = $('#out', box);
  const paint = () => {
    const g = Math.max(0, +amt.value || 0) * u;
    const k = Math.floor(g / COIN.корд), m = Math.floor(g % COIN.корд / COIN.марка), gr = Math.round(g % COIN.марка);
    out.innerHTML = [[k + ' · ' + m + ' · ' + gr, 'кордов · марок · грошей'], [n1(g / avg('day-labour')), 'дней работы подёнщика'], [n1(g / avg('room')), 'ночей в отдельной комнате'],
      [n1(g / avg('stew')), 'мисок похлёбки с хлебом'], [n1(g / avg('horse-saddle')), 'верховых лошадей']].map(([b, s]) => '<div><b>' + b + '</b><small>' + s + '</small></div>').join('');
  };
  amt.oninput = paint; bindSeg(box, 'u', v => { u = +v; paint(); }); paint();
}

/* сколько идти: тот же расчёт, что на карте (Скрипты/road.js), без карты */
function travelCalc(box){
  box.className = 'card widget';
  const opts = ROAD_PLACES.map(id => [id, placeName(id)]).sort((a, b) => a[1].localeCompare(b[1], 'ru'));
  const sel = (id, v) => '<select id="' + id + '" aria-label="' + (id === 'f' ? 'Откуда' : 'Куда') + '">' + opts.map(([k, n]) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>';
  box.innerHTML = '<h3>СКОЛЬКО ИДТИ</h3><div class="row road-pick">' + sel('f', 'capital') + '<span>→</span>' + sel('t', 'shadowport') + '</div>' +
    '<div class="row" style="margin-top:10px">' + seg('m', Object.entries(MODE_LABEL), 'horse') + seg('s', [['summer', 'лето'], ['autumn', 'осень'], ['winter', 'зима']], 'autumn') + '</div><div class="wout" id="out"></div><div id="legs" class="road-legs"></div>';
  let mode = 'horse', season = 'autumn'; const f = $('#f', box), t = $('#t', box), out = $('#out', box);
  const paint = () => {
    const P = f.value === t.value ? null : plan({ from: f.value, to: t.value, season, mode, people: 2 });
    if (!P){ out.innerHTML = '<div><b>—</b><small>' + (f.value === t.value ? 'выбери два разных места' : 'зимой этим способом не пройти') + '</small></div>'; $('#legs', box).innerHTML = ''; return; }
    out.innerHTML = [['≈ ' + fmtDays(P.days), dayWord(P.days) + (P.estimated ? ', местами оценка' : '')], [P.miles, 'миль'], [moneyRound(P.cost.lo, P.cost.hi), 'в дороге на двоих']]
      .map(([b, s]) => '<div><b>' + b + '</b><small>' + s + '</small></div>').join('');
    $('#legs', box).innerHTML = P.legs.map(l => esc(l.route.n) + ' · ' + fmtDays(l.days) + ' ' + dayWord(l.days)).join(' → ') +
      (P.warns.length ? '<div class="evline bad">' + P.warns.map(esc).join(' ') + '</div>' : '') +
      ' <a href="#/map/' + f.value + '/' + t.value + '">на карте →</a>';
  };
  f.onchange = t.onchange = paint; bindSeg(box, 'm', v => { mode = v; paint(); }); bindSeg(box, 's', v => { season = v; paint(); }); paint();
}

/* когда встанет: сроки записи 14 (Данные/wounds.js) на одной шкале дней */
function woundCalc(box){
  box.className = 'card widget';
  box.innerHTML = '<h3>КОГДА ВСТАНЕТ</h3><div class="row">' + seg('w', WOUNDS.map(w => [w.id, w.short]), 'bolt') + seg('x', [['plain', 'без микстуры'], ['mix', 'с микстурой']], 'mix') + '</div>' +
    '<div class="wout" id="out"></div><div class="wtl" id="tl"></div><div id="more"></div>';
  let wid = 'bolt', mx = 'mix';
  const fmtR = ({r, u}) => (r[0] === r[1] ? r[0] : r[0] + '–' + r[1]) + ' ' + plural(r[1], UNIT_FORMS[u]);
  const days = ({r, u}) => r.map(x => x * UNIT_DAYS[u]);
  const mixGood = GOODS.flatMap(([, it]) => it).find(i => i[0] === 'mixture');
  const out = $('#out', box);
  const paint = () => {
    const w = woundById(wid), hasMix = !!w.mix, kind = hasMix ? mx : 'plain', steps = w[kind];
    $$('[data-x]', box).forEach(b => { b.disabled = !hasMix && b.dataset.x === 'mix'; b.setAttribute('aria-pressed', b.dataset.x === kind); });
    const ready = steps.ready, rd = days(ready).map(Math.round);
    out.innerHTML = '<div><b>' + fmtR(ready) + '</b><small>' + esc(ready.what) + '</small></div>' + (ready.u === 'd' ? '' :
      '<div><b>' + (rd[0] === rd[1] ? rd[0] : rd[0] + '–' + rd[1]) + '</b><small>' + plural(rd[1], ['день', 'дня', 'дней']) + ' от ранения</small></div>');
    const max = Math.max(...Object.values(steps).map(s => days(s)[1])) * 1.08;
    const pc = d => (d / max * 100).toFixed(2) + '%';
    $('#tl', box).innerHTML = Object.values(steps).map(s => { const [a, b] = days(s);
      return '<div class="wtl-row"><span>' + esc(s.what) + '</span><div class="wtl-bar"><i style="width:' + pc(a) + '"></i><em style="left:' + pc(a) + ';width:calc(' + pc(b - a) + ' + 3px)"></em></div><b>' + fmtR(s) + '</b></div>'; }).join('') +
      '<div class="wtl-axis"><span>ранен</span><span>' + Math.round(max) + ' ' + plural(Math.round(max), ['день', 'дня', 'дней']) + '</span></div>';
    $('#more', box).innerHTML = '<p class="pending">' + esc(w.survive) + (w.infect ? ' Без обработки заражение приходит через ' + fmtR(w.infect) + '.' : '') + '</p>' +
      (kind === 'mix'
        ? '<p class="pending">Микстура: ' + money(mixGood[2], mixGood[3]) + '. ' + esc(mixGood[5]) + ' Алхимия даёт шанс выжить и ускоряет — но не отменяет.</p>'
        : '<div class="winf"><b>Заражение без микстуры</b><ol><li><span>2-я ночь</span>' + esc(INFECTION.when) + '</li><li><span>3 ночи</span>' + esc(INFECTION.care) + '</li><li><span>4-е утро</span>' + esc(INFECTION.end) + '</li></ol></div>') +
      '<p class="pending">Никакого «к утру почти оправился»: боль, слабость и скованность остаются в сцене и мешают действовать.</p>';
  };
  bindSeg(box, 'w', v => { wid = v; paint(); }); bindSeg(box, 'x', v => { mx = v; paint(); }); paint();
}
