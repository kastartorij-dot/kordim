// Общее для скриптов сборки: чтение шапки блока и подстановка чисел из данных сайта.
//
// Числа живут в одном месте — в данных сайта (Игры/Сайт/Приложение/Данные). Блок канона
// ссылается на них подстановкой, сборка (build.mjs, export-wiki.mjs) вставляет значение:
//   {{price:horse-saddle}}          → «10–12 кордов»   (goods.js: от–до в грошах)
//   {{price:horse-saddle|число}}    → «10–12»          (без названия монеты)
//   {{price:job-special|верх,число}} → «300»           (только верхняя граница)
//   {{coin:марка}}                  → «10»             (грошей в марке, goods.js COIN)
//   {{coin:корд/марка}}             → «20»             (марок в корде)
//   {{pop:brook}}                   → «~2 000»         (places.js: число из начала поля pop)
//   {{pace:foot}}                   → «20–25»          (routes.js PACE: миль в день; foot, rain, horse, cart)
//   {{days:river.horse}}            → «2 дня»          (routes.js: срок тракта; |число — без «дней»)
// Неизвестная подстановка роняет сборку с понятной ошибкой: число не может тихо пропасть.
// Внутри `обратных кавычек` подстановки не раскрываются — так их упоминают в тексте.

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const KANON = path.join(ROOT, 'Канон');
export const DATA = path.join(ROOT, 'Игры', 'Сайт', 'Приложение', 'Данные');

const { GOODS, COIN } = await import(pathToFileURL(path.join(DATA, 'goods.js')).href);
const { PLACES } = await import(pathToFileURL(path.join(DATA, 'places.js')).href);
const { ROUTES, PACE } = await import(pathToFileURL(path.join(DATA, 'routes.js')).href);

const PRICES = new Map(GOODS.flatMap(([, items]) => items.map(([id, , lo, hi]) => [id, [lo, hi]])));
const PLACE_BY_ID = new Map(PLACES.map(p => [p.id, p]));
const ROUTE_BY_ID = new Map(ROUTES.map(r => [r.id, r]));
const range = ([a, b]) => a === b ? String(a) : `${a}–${b}`;

const FORMS = {
  грош: ['грош', 'гроша', 'грошей'],
  марка: ['марка', 'марки', 'марок'],
  корд: ['корд', 'корда', 'кордов'],
};
export function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/* Цена в грошах → самая крупная монета, в которой обе границы целые: так и пишет запись 16
   («8–10 грошей», «3–5 марок», «15–20 кордов»). */
export function formatPrice(lo, hi, flags = []) {
  const unit = (lo % COIN.корд === 0 && hi % COIN.корд === 0) ? 'корд'
    : (lo % COIN.марка === 0 && hi % COIN.марка === 0) ? 'марка' : 'грош';
  const k = unit === 'корд' ? COIN.корд : unit === 'марка' ? COIN.марка : 1;
  const a = lo / k, b = hi / k;
  const top = flags.includes('верх');
  const num = top || a === b ? String(b) : `${a}–${b}`;
  return flags.includes('число') ? num : `${num} ${plural(b, FORMS[unit])}`;
}

export function substitute(text, where = '') {
  // внутри `кода` подстановка не срабатывает: так её можно упомянуть в тексте (журнал правок)
  return text.split(/(`[^`\n]*`)/).map((part, i) => i % 2 ? part : substituteRaw(part, where)).join('');
}
function substituteRaw(text, where) {
  return text.replace(/\{\{\s*([a-zа-яё]+)\s*:\s*([^}|]+?)\s*(?:\|\s*([^}]*?)\s*)?\}\}/giu, (all, kind, key, opts) => {
    const flags = (opts || '').split(',').map(s => s.trim()).filter(Boolean);
    const fail = why => { throw new Error(`${where}: подстановка ${all} — ${why}`); };
    if (kind === 'price') {
      if (!PRICES.has(key)) fail(`нет товара «${key}» в goods.js`);
      const unknown = flags.filter(f => f !== 'число' && f !== 'верх');
      if (unknown.length) fail(`неизвестный флаг «${unknown.join(', ')}»`);
      return formatPrice(...PRICES.get(key), flags);
    }
    if (kind === 'coin') {
      if (key === 'корд/марка') return String(COIN.корд / COIN.марка);
      if (!(key in COIN)) fail(`нет монеты «${key}» в goods.js COIN`);
      return String(COIN[key]);
    }
    if (kind === 'pop') {
      const pl = PLACE_BY_ID.get(key);
      if (!pl) fail(`нет места «${key}» в places.js`);
      const m = String(pl.pop || '').match(/^~?\d[\d\s]*\d|^~?\d/);
      if (!m) fail(`у места «${key}» в pop нет числа в начале`);
      return m[0].trim();
    }
    if (kind === 'pace') {
      if (!PACE[key]) fail(`нет скорости «${key}» в routes.js PACE`);
      return range(PACE[key]);
    }
    if (kind === 'days') {
      const [rid, mode] = key.split('.');
      const d = ROUTE_BY_ID.get(rid)?.days?.[mode];
      if (!d) fail(`нет срока «${mode}» у тракта «${rid}» в routes.js`);
      return flags.includes('число') ? range(d) : `${range(d)} ${plural(d[1], ['день', 'дня', 'дней'])}`;
    }
    return fail(`неизвестный вид «${kind}» (есть price, coin, pop, pace, days)`);
  });
}

/* Блок: YAML-шапка между двумя «---» и тело. Простые поля «ключ: значение» и списки
   «ключ:» + строки «  - значение». Переносы \r снимаются. */
export function readBlockFile(rel) {
  const text = fs.readFileSync(path.join(KANON, rel), 'utf8').replace(/\r/g, '');
  const lines = text.split('\n');
  if (lines[0] !== '---') throw new Error(`${rel}: нет YAML-шапки`);
  let close = -1;
  for (let i = 1; i < lines.length; i++) if (lines[i] === '---') { close = i; break; }
  if (close < 0) throw new Error(`${rel}: не нашёл закрывающую черту шапки`);
  const front = {}, lists = {};
  let list = null;
  for (let i = 1; i < close; i++) {
    const l = lines[i];
    const item = l.match(/^\s+-\s*(.+)$/);
    if (item && list) { lists[list].push(item[1].trim()); continue; }
    const m = l.match(/^([\p{L}_]+):\s*(.*)$/u);
    if (!m) { list = null; continue; }
    if (m[2] === '') { list = m[1]; lists[list] = []; }
    else { list = null; front[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); }
  }
  return { front, lists, body: lines.slice(close + 1).join('\n') };
}

/* links: «вид:id» или «вид:id главная». Вид — раздел справочника: people, places, factions,
   articles, events (у событий id — это slug). «главная» — эта запись идёт первой среди
   источников карточки. */
export const LINK_KINDS = ['people', 'places', 'factions', 'articles', 'events'];
export function parseLinks(entries, where) {
  return (entries || []).map(s => {
    const m = s.match(/^([a-z]+):([\w-]+)(\s+главная)?$/);
    if (!m) throw new Error(`${where}: не понял links «${s}» (нужно вид:id или вид:id главная)`);
    if (!LINK_KINDS.includes(m[1])) throw new Error(`${where}: в links неизвестный вид «${m[1]}»`);
    return { kind: m[1], id: m[2], main: !!m[3] };
  });
}
