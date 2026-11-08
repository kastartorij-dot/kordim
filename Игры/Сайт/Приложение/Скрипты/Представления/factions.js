/* Фракции: схема «кто с кем» (все связи из factions.js RELATIONS на одном круге) и карточки.
   Нажми фракцию на схеме — останутся её связи и список под схемой; ещё раз — всё снова. */
import { $, $$, esc } from '../ui.js';
import { FACTIONS, RELATIONS, REL_LABEL, factionById } from '../../Данные/factions.js';
import { personById } from '../../Данные/people.js';
import { icon } from '../icons.js';

/* короткие подписи для круга */
const SHORT = { kontora:'Контора', council:'Совет', church:'Церковь', crown:'Корона', houses:'Торговые дома', loge:'Ложа',
  college:'Коллегия', order:'Орден', knives:'Мокрые ножи', cartel:'Картель', fist:'Братство', hunters:'Охотники',
  heralds:'Вестники', blades:'Клинки', kessmen:'Люди Кесса', likho:'Лихо' };
/* порядок по кругу: Столица — восток — Порт — лес и юг, чтобы связи меньше перекрещивались */
const ORDER = ['council', 'church', 'crown', 'houses', 'college', 'order', 'loge', 'kessmen', 'likho', 'kontora', 'hunters', 'heralds', 'fist', 'cartel', 'knives', 'blades'];
const COL = { soyuz:'var(--sage)', delo:'var(--dusk)', spor:'var(--ember)' };

function scheme(){
  const ids = [...ORDER.filter(id => factionById(id)), ...FACTIONS.map(f => f.id).filter(id => !ORDER.includes(id))];
  const N = ids.length, C = 300, R = 205;
  const at = Object.fromEntries(ids.map((id, i) => { const a = i / N * Math.PI * 2 - Math.PI / 2; return [id, [C + Math.cos(a) * R, C + Math.sin(a) * R, a]]; }));
  const linked = new Set(RELATIONS.flatMap(r => [r[0], r[1]]));
  const edges = RELATIONS.map(([a, b, t, txt], i) => {
    const [x1, y1] = at[a], [x2, y2] = at[b], mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const cx = C + (mx - C) * .35, cy = C + (my - C) * .35;   // дуга чуть к центру
    return `<path class="rel-e ${t}" data-a="${a}" data-b="${b}" data-i="${i}" d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" stroke="${COL[t]}"><title>${esc(SHORT[a] || a)} — ${esc(SHORT[b] || b)}: ${esc(txt)}</title></path>`;
  }).join('');
  const nodes = ids.map(id => { const f = factionById(id), [x, y, a] = at[id];
    const lx = C + Math.cos(a) * (R + 16), ly = C + Math.sin(a) * (R + 16), anchor = Math.abs(Math.cos(a)) < .2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
    return `<g class="rel-n${linked.has(id) ? '' : ' lone'}" data-id="${id}" tabindex="0" role="button" aria-label="${esc(f.name)}">
      <circle cx="${x}" cy="${y}" r="9" fill="${f.color}"/><circle class="hit" cx="${x}" cy="${y}" r="22"/>
      <text x="${lx}" y="${ly + 4 + (Math.abs(Math.cos(a)) < .2 ? (Math.sin(a) > 0 ? 10 : -8) : 0)}" text-anchor="${anchor}">${esc(SHORT[id] || f.name)}</text></g>`; }).join('');
  return `<svg class="rel-svg" viewBox="-60 0 720 600" role="img" aria-label="Связи фракций">${edges}${nodes}</svg>`;
}

const relRow = ([a, b, t, txt]) => `<div class="rel-row" data-a="${a}" data-b="${b}"><span class="t ${t}">${REL_LABEL[t]}</span>
  <div><a href="#/faction/${a}">${esc(factionById(a).name)}</a> — <a href="#/faction/${b}">${esc(factionById(b).name)}</a><small>${esc(txt)}</small></div></div>`;

export function render(root){
  root.innerHTML = `<div class="page" data-title="Фракции">
    <div class="eyebrow">силы</div><h1 class="h1">Фракции</h1>
    <p class="lead">Поручительство стоит ровно того, чем ручается держатель: синдикат — страхом, Коллегия — клеймом, Орден — уставом, Кесс — лесом, Сайден — собственным карманом.</p>
    <section class="card rel-map">
      <div class="rel-head"><h3>КТО С КЕМ <small>${RELATIONS.length}</small></h3>
        <div class="rel-key">${Object.entries(REL_LABEL).map(([k, l]) => '<span><i style="background:' + COL[k] + '"></i>' + l + '</span>').join('')}</div></div>
      <div class="rel-grid"><div class="rel-pic">${scheme()}</div>
        <div><p class="rel-hint" id="relHint">Нажми фракцию — останутся её связи.</p><div class="rel-list" id="relList">${RELATIONS.map(relRow).join('')}</div></div></div>
    </section>
    <div class="facs">${FACTIONS.map(f => `<a class="card fac" href="#/faction/${f.id}" style="--fc:${f.color}">
      <div class="fhead">${icon(f.icon, 30)}<div><b>${esc(f.name)}</b><div class="kind">${esc(f.kind)}</div></div></div>
      <p>${esc(f.text[0])}</p>
      <div class="who">${[...f.head.map(id => (personById(id) || {}).name).filter(Boolean), f.size].filter(Boolean).map(esc).join(' · ')}</div>
    </a>`).join('')}</div>
  </div>`;

  let cur = null;
  const pick = id => {
    cur = cur === id ? null : id;
    const box = $('.rel-map', root);
    box.classList.toggle('focus', !!cur);
    $$('.rel-n', root).forEach(n => n.classList.toggle('on', n.dataset.id === cur || !!cur && RELATIONS.some(r => (r[0] === cur && r[1] === n.dataset.id) || (r[1] === cur && r[0] === n.dataset.id))));
    $$('.rel-e,.rel-row', root).forEach(e => e.classList.toggle('on', !!cur && (e.dataset.a === cur || e.dataset.b === cur)));
    const n = cur ? RELATIONS.filter(r => r[0] === cur || r[1] === cur).length : 0;
    $('#relHint', root).innerHTML = cur
      ? '<b>' + esc(factionById(cur).name) + '</b>: ' + (n ? n + ' ' + (n === 1 ? 'связь' : n < 5 ? 'связи' : 'связей') : 'связей в данных нет') + ' · <a href="#/faction/' + cur + '">страница фракции →</a>'
      : 'Нажми фракцию — останутся её связи.';
  };
  $$('.rel-n', root).forEach(n => { n.onclick = () => pick(n.dataset.id); n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(n.dataset.id); } }; });
}
