import { esc, personChip, placeChip, IMG } from '../ui.js';
import { CHARGED, OPEN } from '../../data/questions.js';
import { PEOPLE } from '../../data/people.js';
import { PLACES } from '../../data/places.js';
import { FACTIONS } from '../../data/factions.js';
import { EVENTS } from '../../data/events.js';
import { ARTICLES } from '../../data/articles.js';
import { SCENES } from '../../data/scenes.js';

/* «Где мир молчит» — то же, что канон/_build/silence.mjs, но считается здесь, из тех же данных,
   и каждый пункт ведёт туда, где дыру закрывать. Замороженных (Хада) не считаем. */
const link = (href, text) => '<a class="chip" href="' + href + '">' + esc(text) + '</a>';
const people = PEOPLE.filter(p => !p.frozen);
const inEvents = new Set(EVENTS.flatMap(e => e.people || []));
const scened = new Set(SCENES.map(s => s.event));
const keyEvents = EVENTS.map((e, i) => ({ ...e, i })).filter(e => e.key);
const evChip = e => link('#/chronicle/' + e.i, e.h);

/* строки без картинок считаются сразу; с картинками — после HEAD-проверки файлов */
const ROWS = [
  { t: 'Люди вне хроники', hint: 'ни в одном событии', of: people.length,
    items: () => people.filter(p => !inEvents.has(p.id)).map(p => personChip(p.id)) },
  { t: 'Без полного профиля', hint: 'шкала лет, вещи, разговор', of: people.length,
    items: () => people.filter(p => !p.profile).map(p => personChip(p.id)) },
  { t: 'Без портрета', of: people.length, files: people.map(p => [p.img, personChip(p.id)]) },
  { t: 'Места без жителей', of: PLACES.length,
    items: () => PLACES.filter(pl => !people.some(p => p.place === pl.id)).map(pl => placeChip(pl.id)) },
  { t: 'Места без событий', of: PLACES.length,
    items: () => PLACES.filter(pl => !EVENTS.some(e => e.place === pl.id)).map(pl => placeChip(pl.id)) },
  { t: 'Места без вида', of: PLACES.length, files: PLACES.map(pl => [pl.img, placeChip(pl.id)]) },
  { t: 'Места без пина на карте', of: PLACES.length,
    items: () => PLACES.filter(pl => pl.x == null || pl.y == null).map(pl => placeChip(pl.id)) },
  { t: 'Ключевые события без сцены', hint: 'проза не написана', of: keyEvents.length,
    items: () => keyEvents.filter(e => !scened.has(e.slug)).map(evChip) },
  { t: 'Ключевые события без иллюстрации', of: keyEvents.length,
    files: keyEvents.map(e => ['events/' + e.slug + '.jpg', evChip(e)]) },
  { t: 'Статьи «Мир» без обложки', of: ARTICLES.length,
    files: ARTICLES.map(a => ['world/' + a.id + '.jpg', link('#/world/' + a.id, a.title)]) },
  { t: 'Фракции без главы', hint: 'некого открыть из реестра людей', of: FACTIONS.length,
    items: () => FACTIONS.filter(f => !(f.head || []).length).map(f => link('#/faction/' + f.id, f.name)) },
];

async function exists(rel) {
  if (!rel) return false;
  try { return (await fetch(IMG + rel, { method: 'HEAD', signal: AbortSignal.timeout(8000) })).ok; }
  catch { return true; }   // нет сети — не записываем в дыры то, что просто не проверили
}

function rowHTML(r, items) {
  const body = items == null ? '<span class="sil-wait">проверяю файлы…</span>'
    : items.length ? items.join('') : '<span class="sil-ok">всё на месте</span>';
  return '<div class="q sil-row"><b>' + esc(r.t) + ' <small>' + (items == null ? '…' : items.length) + ' из ' + r.of + '</small></b>' +
    (r.hint ? '<p>' + esc(r.hint) + '</p>' : '') + '<div class="sil-items">' + body + '</div></div>';
}

export function render(root){
  root.innerHTML = `<div class="page" data-title="Вопросы">
    <div class="eyebrow">работа над миром</div><h1 class="h1">Вопросы</h1>
    <p class="lead">Заряженное — крючки, которые уже лежат в сюжете. Открытое — то, что автор ещё не решил. Ниже — где мир пока молчит.</p>
    <div class="qgrid">
      <section class="card"><h3>ЗАРЯЖЕНО <small>${CHARGED.length}</small></h3>${CHARGED.map(([t, d, ppl]) => '<div class="q"><b>' + esc(t) + '</b><p>' + esc(d) + '</p><div style="margin-top:6px">' + ppl.map(personChip).join('') + '</div></div>').join('')}</section>
      <section class="card"><h3>ОТКРЫТО <small>${OPEN.length}</small></h3>${OPEN.map(([t, d]) => '<div class="q"><b>' + esc(t) + '</b><p>' + esc(d) + '</p></div>').join('')}</section>
    </div>
    <section class="card sil" id="silence"><h3>ГДЕ МИР МОЛЧИТ <small>куда расти</small></h3>
      <div class="sil-grid">${ROWS.map((r, i) => '<div data-row="' + i + '">' + rowHTML(r, r.items ? r.items() : null) + '</div>').join('')}</div>
    </section>
  </div>`;

  let alive = true;
  ROWS.forEach(async (r, i) => {
    if (!r.files) return;
    const ok = await Promise.all(r.files.map(([rel]) => exists(rel)));
    const slot = alive && root.querySelector('[data-row="' + i + '"]');
    if (slot) slot.innerHTML = rowHTML(r, r.files.filter((_, k) => !ok[k]).map(f => f[1]));
  });
  return () => { alive = false; };
}
