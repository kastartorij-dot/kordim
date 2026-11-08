// Экспортирует блоки канона в Игры/Сайт/Приложение/Данные/canon.js — для вкладки «Канон» в вики,
// и собирает из канона то, что раньше правилось руками: sources.js (из links в шапках блоков),
// questions.js (заряженное из приложения, «ждёт автора» из плана), journal.js (из журнала правок).
// Читает манифест.json, снимает с тела служебные заголовки (они уже есть в шапке
// блока как title/id) и строку `Ключи: ...` (она уже есть как ключи[]).
//
// node Канон/_Сборка/export-wiki.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readBlockFile, substitute, parseLinks, LINK_KINDS, DATA } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KANON = path.join(ROOT, 'Канон');
const OUT = path.join(ROOT, 'Игры', 'Сайт', 'Приложение', 'Данные', 'canon.js');
// Лента правок для главной: датированные записи журнала из 00_шапка.md, новые сверху.
const OUT_JOURNAL = path.join(ROOT, 'Игры', 'Сайт', 'Приложение', 'Данные', 'journal.js');

function readBlock(rel) {
  const { front, lists, body: raw } = readBlockFile(rel);
  const keys = lists.ключи || [];
  const links = parseLinks(lists.links, rel);
  // числа ({{price:…}}, {{pop:…}}, {{coin:…}}) — из данных сайта, как и в мастере
  let body = substitute(raw, rel);
  // снимаем ведущие заголовки (# ЧАСТЬ ..., ## N. Title) и вступление раздела —
  // они дублируют title/раздел из шапки и не нужны в теле карточки.
  body = body.replace(/^﻿?/, '');
  const bodyLines = body.split('\n');
  let i = 0;
  while (i < bodyLines.length) {
    const l = bodyLines[i].trim();
    if (l === '') { i++; continue; }
    if (/^#{1,2}\s/.test(l)) { i++; continue; }
    if (/^Пятьдесят три Записи/.test(l)) { i++; continue; }
    break;
  }
  body = bodyLines.slice(i).join('\n');
  // снимаем строку ключей внутри тела (осталась от лорбука SillyTavern)
  body = body.replace(/^`Ключи:[^\n]*`\n?/m, '');
  // снимаем висящий разделитель --- в конце
  body = body.replace(/\n-{3,}\s*$/, '');
  return { front, keys, links, lists, body: body.trim() };
}

const manifest = JSON.parse(fs.readFileSync(path.join(KANON, 'манифест.json'), 'utf8'));

const blocks = []; // для sources.js и questions.js: группа, ключ, links, шапка
function toItem(rel, группа) {
  const { front, keys, links, lists, body } = readBlock(rel);
  blocks.push({ группа, key: String(front.id ?? front.title), links, lists, body, rel });
  return {
    id: front.id,
    title: front.title,
    часть: front.часть || null,
    раздел: front.раздел || null,
    статус: front.статус || 'канон',
    ключи: keys,
    links: links.map(l => l.kind + ':' + l.id),
    текст: body,
  };
}

const out = {
  собрано: new Date().toISOString().slice(0, 10),
  герои: [],
  правила: [],
  записи: [],
  приложения: [],
};

for (const part of manifest.части) {
  const target = part.заголовок.includes('ГЕРОИ') ? out.герои
    : part.заголовок.includes('ПРАВИЛА') ? out.правила
    : out.записи;
  const группа = target === out.герои ? 'герои' : target === out.правила ? 'правила' : 'записи';
  for (const rel of part.блоки) target.push(toItem(rel, группа));
}
for (const rel of manifest.приложения) out.приложения.push(toItem(rel, 'приложения'));

/* журнал: абзацы вида «**Заголовок, ДД.ММ.ГГГГ** текст» в разделе «Что изменено против исходника» */
function readJournal() {
  const src = fs.readFileSync(path.join(KANON, manifest.шапка), 'utf8').replace(/\r\n/g, '\n');
  const at = src.indexOf('## Что изменено против исходника');
  if (at < 0) return [];
  const entries = [];
  src.slice(at).split(/\n\s*\n/).forEach((p, order) => {
    const m = p.trim().match(/^\*\*(.+?)\*\*:?\s*([\s\S]*)$/);
    if (!m) return;
    const d = m[1].match(/(\d{1,2})\.(\d{2})\.(\d{4})/);
    if (!d) return;
    const title = m[1].replace(/,?\s*\d{1,2}\.\d{2}\.\d{4}\s*:?$/, '').replace(/:$/, '').trim();
    entries.push({ date: `${d[3]}-${d[2]}-${d[1].padStart(2, '0')}`, title, text: m[2].replace(/\s+/g, ' ').trim(), order });
  });
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order).map(({ order, ...e }) => e);
}
const journal = readJournal();
const generatedJournal = '// Автосборка из журнала правок Канон/00_шапка.md (export-wiki.mjs). Не редактировать руками.\n'
  + `export const JOURNAL = ${JSON.stringify(journal, null, 1)};\n`;


/* sources.js: «карточка справочника → записи канона», собирается из links в шапках блоков.
   Порядок: сначала запись с пометкой «главная», дальше по порядку сборки мастера.
   Карточки идут в порядке файлов данных, чтобы дифф был читаемым. */
const load = rel => import(pathToFileURL(path.join(DATA, rel)).href);
const { PEOPLE } = await load('people.js');
const { PLACES } = await load('places.js');
const { FACTIONS } = await load('factions.js');
const { ARTICLES } = await load('articles.js');
const { EVENTS } = await load('events.js');
const ORDER = {
  people: PEOPLE.map(x => x.id), places: PLACES.map(x => x.id), factions: FACTIONS.map(x => x.id),
  articles: ARTICLES.map(x => x.id), events: EVENTS.map(x => x.slug),
};
const sources = Object.fromEntries(LINK_KINDS.map(k => [k, new Map()]));
for (const b of blocks) for (const l of b.links) {
  const m = sources[l.kind];
  if (!m.has(l.id)) m.set(l.id, { main: [], rest: [] });
  m.get(l.id)[l.main ? 'main' : 'rest'].push([b.группа, b.key]);
}
const rank = (kind, id) => { const i = ORDER[kind].indexOf(id); return i < 0 ? 1e9 : i; };
let generatedSources = '// Автосборка из links в шапках блоков канона (export-wiki.mjs). Не редактировать руками:\n'
  + '// связь карточки с записью правится в шапке блока, поле links, затем node Канон/_Сборка/export-wiki.mjs.\n'
  + '/* Связанные записи канона для сверки карточек. Ссылки не означают, что черновик утверждён. */\n'
  + 'export const SOURCES = {\n';
for (const kind of LINK_KINDS) {
  generatedSources += `  ${kind}: {\n`;
  const ids = [...sources[kind].keys()].sort((a, b) => rank(kind, a) - rank(kind, b) || a.localeCompare(b));
  for (const id of ids) {
    const { main, rest } = sources[kind].get(id);
    generatedSources += `    ${JSON.stringify(id)}: ${JSON.stringify([...main, ...rest])},\n`;
  }
  generatedSources += '  },\n';
}
generatedSources += '};\n';

/* questions.js. CHARGED — из приложения «Что заряжено»: пункт «N. **Заголовок** текст»,
   люди пункта — в шапке приложения, поле люди_пунктов («N: id, id»).
   OPEN — из плана: незакрытые пункты раздела «Ждёт решения автора». */
const charged = blocks.find(b => b.группа === 'приложения' && b.key === 'Что заряжено');
const peopleOf = new Map((charged.lists.люди_пунктов || []).map(s => {
  const m = s.match(/^(\d+):\s*(.*)$/);
  if (!m) throw new Error(`что-заряжено.md: не понял люди_пунктов «${s}»`);
  return [+m[1], m[2].split(',').map(x => x.trim()).filter(Boolean)];
}));
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const CHARGED = charged.body.split('\n').map(l => l.match(/^(\d+)\.\s+\*\*(.+?)\*\*(.*)$/)).filter(Boolean).map(([, n, bold, rest]) => {
  const title = bold.replace(/[.:]\s*$/, '').trim();
  rest = rest.trim();
  // продолжение фразы («**Тишак** не поверил…») — текстом идёт вся фраза целиком
  const text = /^[,\p{Ll}]/u.test(rest) ? (bold + (rest.startsWith(',') ? '' : ' ') + rest).trim() : cap(rest.replace(/^[—–:.\s-]+/, ''));
  return [title, text, peopleOf.get(+n) || []];
});
const plan = fs.readFileSync(path.join(KANON, 'ПЛАН_развития.md'), 'utf8').replace(/\r/g, '');
const waitSec = plan.split(/\n## /).find(x => x.startsWith('Ждёт решения автора')) || '';
const OPEN = waitSec.split('\n').map(l => l.match(/^- \[ \] (.+)$/)).filter(Boolean).map(([, t]) => {
  t = t.replace(/\*\*А\*\*/g, '').replace(/`/g, '').replace(/\s*\([^()]*\)\s*$/, '').trim();
  const cut = t.search(/[:;]\s/);
  return cut > 0 ? [t.slice(0, cut), cap(t.slice(cut + 1).trim())] : [t, ''];
});
const generatedQuestions = '// Автосборка (export-wiki.mjs). Не редактировать руками.\n'
  + '// CHARGED — Канон/Приложения/что-заряжено.md (люди пунктов — в шапке, поле люди_пунктов);\n'
  + '// OPEN — Канон/ПЛАН_развития.md, незакрытые пункты раздела «Ждёт решения автора».\n'
  + `export const CHARGED = ${JSON.stringify(CHARGED, null, 1)};\n`
  + `export const OPEN = ${JSON.stringify(OPEN, null, 1)};\n`;
const OUT_SOURCES = path.join(DATA, 'sources.js');
const OUT_QUESTIONS = path.join(DATA, 'questions.js');

const header = '// Автосборка из Канон/Герои, Канон/Правила, Канон/Записи, Канон/Приложения.\n'
  + '// Не редактировать руками — правьте блоки и запускайте node Канон/_Сборка/export-wiki.mjs.\n';
const generated = header + `export const CANON = ${JSON.stringify(out, null, 2)};\n`;
if (process.argv.includes('--check')) {
  // Дата сборки не меняет фактов; переносы Windows и Linux могут различаться.
  const normalize = s => s.replace(/\r\n/g, '\n').replace(/("собрано": ")[^"]+(")/, '$1DATE$2');
  const stale = (file, text) => !fs.existsSync(file) || normalize(fs.readFileSync(file, 'utf8')) !== normalize(text);
  if (stale(OUT, generated) || stale(OUT_JOURNAL, generatedJournal) || stale(OUT_SOURCES, generatedSources) || stale(OUT_QUESTIONS, generatedQuestions)) {
    console.error('Канон справочника устарел. Запустите node Канон/_Сборка/export-wiki.mjs');
    process.exit(1);
  }
  console.log('OK: канон справочника совпадает с блоками.');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, generated, 'utf8');
  fs.writeFileSync(OUT_JOURNAL, generatedJournal, 'utf8');
  fs.writeFileSync(OUT_SOURCES, generatedSources, 'utf8');
  fs.writeFileSync(OUT_QUESTIONS, generatedQuestions, 'utf8');
  console.log(`Записано: ${OUT}`);
}
console.log(`Герои ${out.герои.length}, правила ${out.правила.length}, записи ${out.записи.length}, приложения ${out.приложения.length}, журнал ${journal.length}, заряжено ${CHARGED.length}, ждёт автора ${OPEN.length}`);
