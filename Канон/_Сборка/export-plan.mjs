// Собирает Канон/ПЛАН_развития.md в Игры/Сайт/Приложение/Данные/plan.js для раздела «План».
// Источник истины — markdown; здесь только разбор отметок, проценты считает страница.
//
// Разметка пункта:  - [x] Текст (коды источников) ·· **А** ✓ 17.09
//   [x] сделано · [~] частично · [ ] не сделано · [3/13] сделано 3 из 13 · [-] снято
//   · / ·· / ··· — трудоёмкость, **А** — ждёт автора, ✓ ДД.ММ — дата закрытия.
// Пункты живут под «### Раздел» внутри «## Мир и лор», «## Справочник и сайт», «## Сейчас в работе»;
// «## Ждёт решения автора» и «## Снято» — плоские списки; «## Порядок» — нумерованный список.
//
// node Канон/_Сборка/export-plan.mjs          — пересобрать
// node Канон/_Сборка/export-plan.mjs --check  — только сверить (для CI)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'Канон', 'ПЛАН_развития.md');
const OUT = path.join(ROOT, 'Игры', 'Сайт', 'Приложение', 'Данные', 'plan.js');

const lines = fs.readFileSync(SRC, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
const fail = (n, msg) => { console.error(`ПЛАН_развития.md:${n}: ${msg}`); process.exit(1); };

const GROUPS = { 'Сейчас в работе': 'now', 'Мир и лор': 'lore', 'Справочник и сайт': 'site' };
const plan = { now: [], decisions: [], groups: [], dropped: [], order: [] };
let section = null, area = null;

function parseItem(mark, rest, n) {
  let text = rest.trim(), date = null, author = false, effort = 0, refs = null;
  const d = text.match(/\s*✓\s*(\d{2})\.(\d{2})\s*$/);
  if (d) { date = d[1] + '.' + d[2]; text = text.slice(0, d.index).trim(); }
  if (/\s\*\*А\*\*\s*$/.test(' ' + text)) { author = true; text = text.replace(/\s*\*\*А\*\*\s*$/, '').trim(); }
  const e = text.match(/\s(·{1,3})$/);
  if (e) { effort = e[1].length; text = text.slice(0, e.index).trim(); }
  const r = text.match(/\s\(([^()]*)\)$/);
  if (r && /(О §|Л\d|П07|Р09|ПИ-|ИФ-|РП|КТ|`[0-9a-f]{7}`)/.test(r[1])) { refs = r[1]; text = text.slice(0, r.index).trim(); }
  let st, p, frac = null;
  if (mark === 'x') { st = 'done'; p = 1; }
  else if (mark === '~') { st = 'part'; p = 0.5; }
  else if (mark === ' ') { st = 'open'; p = 0; }
  else if (mark === '-') { st = 'drop'; p = null; }
  else {
    const m = mark.match(/^(\d+)\/(\d+)$/);
    if (!m || +m[1] > +m[2] || +m[2] === 0) fail(n, `непонятная отметка [${mark}]`);
    frac = [+m[1], +m[2]]; p = frac[0] / frac[1]; st = p === 1 ? 'done' : p === 0 ? 'open' : 'part';
  }
  if (!text) fail(n, 'пустой пункт');
  return { st, p, frac, text, refs, effort, author, date };
}

lines.forEach((line, i) => {
  const n = i + 1;
  let m;
  if ((m = line.match(/^## (.+)$/))) {
    const t = m[1].trim(); area = null;
    section = GROUPS[t] ? { kind: 'group', key: GROUPS[t], title: t }
      : t === 'Ждёт решения автора' ? { kind: 'decisions' }
      : t === 'Снято' ? { kind: 'dropped' }
      : t === 'Порядок' ? { kind: 'order' } : null;
    if (section && section.kind === 'group' && section.key !== 'now') plan.groups.push({ key: section.key, title: t, areas: [] });
    return;
  }
  if (!section) return;
  if ((m = line.match(/^### (.+)$/))) {
    if (section.kind !== 'group') fail(n, 'подраздел «###» вне «Сейчас в работе», «Мир и лор», «Справочник и сайт»');
    area = { title: m[1].trim(), items: [] };
    (section.key === 'now' ? plan.now : plan.groups[plan.groups.length - 1].areas).push(area);
    return;
  }
  if ((m = line.match(/^- \[([^\]]*)\] (.*)$/))) {
    const it = parseItem(m[1], m[2], n);
    if (section.kind === 'group') { if (!area) fail(n, 'пункт до первого «###»'); area.items.push(it); }
    else if (section.kind === 'decisions') plan.decisions.push(it);
    else if (section.kind === 'dropped') { if (it.st !== 'drop') fail(n, 'в «Снято» только [-]'); plan.dropped.push(it); }
    else fail(n, 'пункт-отметка в «Порядке»');
    if (it.st === 'drop' && section.kind !== 'dropped') fail(n, '[-] только в разделе «Снято»');
    return;
  }
  if (section.kind === 'order' && (m = line.match(/^(\d+)\. \*\*(.+?)\*\*\s*(·{1,3})?\.?\s*(.*)$/))) {
    plan.order.push({ n: +m[1], title: m[2], effort: m[3] ? m[3].length : 0, text: m[4].trim() });
  }
});

const all = [...plan.now, ...plan.groups.flatMap(g => g.areas)].flatMap(a => a.items).concat(plan.decisions);
if (!plan.groups.length || !all.length) fail(0, 'не нашёл ни одного раздела с пунктами');
const undated = all.filter(x => x.st === 'done' && !x.frac && !x.date);
if (undated.length) console.warn('Без даты закрытия: ' + undated.map(x => '«' + x.text + '»').join(', '));

const out = `// СГЕНЕРИРОВАНО из Канон/ПЛАН_развития.md скриптом Канон/_Сборка/export-plan.mjs — руками не редактировать.
// st: done · part · open · drop; p — готовность 0…1; effort: 1 час, 2 полсессии, 3 сессия+; author — ждёт ответа автора.
export const PLAN = ${JSON.stringify(plan, null, 1)};
`;

if (process.argv.includes('--check')) {
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') !== out) {
    console.error('План справочника устарел. Запустите node Канон/_Сборка/export-plan.mjs');
    process.exit(1);
  }
  console.log('OK: план справочника совпадает с Канон/ПЛАН_развития.md.');
} else {
  fs.writeFileSync(OUT, out);
  const areas = plan.groups.flatMap(g => g.areas).length + plan.now.length;
  console.log(`OK: ${path.relative(ROOT, OUT)} — ${areas} разделов, ${all.length} пунктов, ${plan.dropped.length} снято, ${plan.order.length} шагов порядка.`);
}
