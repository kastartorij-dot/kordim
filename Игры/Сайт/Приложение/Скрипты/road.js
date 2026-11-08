/* Дорога от А до Б: граф трактов, кратчайший путь по дням, расходы в пути.
   Всё считается из данных: тракты и сроки — routes.js (запись 15), цены — goods.js (запись 16).
   Ничего не выдумывает: где у тракта нет срока в каноне, срок оценён по длине и помечен. */
import { ROUTES, PACE } from '../Данные/routes.js';
import { GOODS, COIN } from '../Данные/goods.js';
import { placeById } from '../Данные/places.js';

const mid = ([a, b]) => Math.floor((a + b) / 2);
export const SPEED = { horse: mid(PACE.horse), foot: mid(PACE.foot), cart: mid(PACE.cart) };
export const MODE_LABEL = { horse: 'верхом', foot: 'пешком', cart: 'обозом' };
export const MODE_TOKEN = { horse: '🐴', foot: '🚶', cart: '🛒' };
/* осенью и зимой грунт вдвое медленнее (запись 15); весенняя распутица отдельно не моделируется */
export const groundFactor = season => season === 'summer' ? 1 : 2;

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const polyLen = p => p.slice(1).reduce((s, q, i) => s + dist(p[i], q), 0);

/* Рёбра графа: тракт целиком или его кусок между остановками (Ручейный посреди Южного обхода). */
export const EDGES = ROUTES.flatMap(r => {
  const cuts = [{ place: r.from, i: 0 }, ...(r.stops || []), { place: r.to, i: r.p.length - 1 }];
  const whole = polyLen(r.p);
  return cuts.slice(1).map((c, k) => {
    const a = cuts[k], p = r.p.slice(a.i, c.i + 1);
    return { route: r, from: a.place, to: c.place, p, share: polyLen(p) / whole };
  });
});

/* Срок ребра в днях [от, до] для способа и сезона; known — срок взят из канона, а не оценён. */
export function edgeDays(e, season, mode) {
  const r = e.route, base = r.days?.[mode];
  const known = !!base;
  const d = base ? base.map(x => x * e.share) : [r.miles * e.share / SPEED[mode], r.miles * e.share / SPEED[mode]];
  const f = r.ground ? groundFactor(season) : 1;
  return { days: d.map(x => x * f), known };
}
export const closed = (r, season, mode) => season === 'winter' && (r.winterClosed || []).includes(mode);

/* Кратчайший путь по середине срока. skip — множество рёбер, которые нельзя брать (для запасного пути). */
function shortest(from, to, season, mode, skip = new Set()) {
  const best = new Map([[from, 0]]), prev = new Map(), done = new Set();
  while (true) {
    let u = null, ud = Infinity;
    for (const [k, v] of best) if (!done.has(k) && v < ud) { u = k; ud = v; }
    if (u === null || u === to) break;
    done.add(u);
    for (const e of EDGES) {
      if (skip.has(e) || closed(e.route, season, mode)) continue;
      const v = e.from === u ? e.to : e.to === u ? e.from : null;
      if (!v || done.has(v)) continue;
      const { days } = edgeDays(e, season, mode), w = ud + (days[0] + days[1]) / 2;
      if (w < (best.get(v) ?? Infinity)) { best.set(v, w); prev.set(v, [u, e]); }
    }
  }
  if (!best.has(to) || from === to) return null;
  const legs = [];
  for (let v = to; v !== from;) { const [u, e] = prev.get(v); legs.unshift({ edge: e, from: u, to: v }); v = u; }
  return legs;
}

/* Полный расчёт: этапы, срок, предупреждения, запасной путь. */
export function plan({ from, to, season = 'autumn', mode = 'horse', people = 2, word = true }) {
  const legs = merge(shortest(from, to, season, mode));
  if (!legs) return null;
  const out = describe(legs, season, mode, people, word);
  /* запасной путь: лучший из тех, что обходят хотя бы один этап основного */
  let alt = null;
  for (const l of legs) {
    const a = merge(shortest(from, to, season, mode, new Set(l.edges)));
    if (!a) continue;
    const d = describe(a, season, mode, people, word);
    if (!alt || d.mid < alt.mid) alt = d;
  }
  out.alt = alt;
  /* что закрыто зимой на прямом пути — чтобы было видно, почему путь в обход */
  out.closedNear = season === 'winter' ? ROUTES.filter(r => closed(r, season, mode) && [r.from, r.to].some(x => x === from || x === to)) : [];
  return out;
}

/* соседние куски одного тракта (через Ручейный и дальше) — один этап «через …» */
function merge(legs) {
  if (!legs) return null;
  const out = [];
  for (const l of legs) {
    const last = out[out.length - 1];
    if (last && last.edges[0].route === l.edge.route) { last.edges.push(l.edge); last.via.push(last.to); last.to = l.to; }
    else out.push({ edges: [l.edge], from: l.from, to: l.to, via: [] });
  }
  return out;
}

function describe(legs, season, mode, people, word) {
  let lo = 0, hi = 0, miles = 0, estimated = false;
  const warns = [];
  const L = legs.map(({ edges, from, to, via }) => {
    const r = edges[0].route, share = edges.reduce((x, e) => x + e.share, 0);
    const ds = edges.map(e => edgeDays(e, season, mode)), known = ds.every(d => d.known);
    const days = [ds.reduce((x, d) => x + d.days[0], 0), ds.reduce((x, d) => x + d.days[1], 0)];
    lo += days[0]; hi += days[1]; miles += r.miles * share; estimated ||= !known;
    const w = [];
    if (r.minGroup && people < r.minGroup) w.push(r.note);
    if (r.word && !word) w.push('Не под словом Сайдена. ' + r.holder);
    if (season === 'winter' && r.k === 'water' && r.winter) w.push(r.winter);
    warns.push(...w);
    const fwd = edges[0].from === from;
    const pts = (fwd ? edges : [...edges].reverse()).flatMap(e => e.p);
    return { route: r, from, to, via, days, known, warns: w, p: fwd ? pts : [...pts].reverse(), part: share < .999 };
  });
  return { legs: L, days: [lo, hi], mid: (lo + hi) / 2, miles: Math.round(miles), estimated, warns, cost: cost((lo + hi) / 2, mode, people) };
}

/* Расходы в пути, в грошах, от–до. Допущения названы прямо в строках — это прикидка, а не канон:
   ночлег в общей комнате, похлёбка с хлебом дважды в день, корм каждой лошади. Пошлины в каноне
   без сумм — их нет в счёте, они перечислены у этапов. */
const good = id => GOODS.flatMap(([, items]) => items).find(i => i[0] === id);
export function cost(days, mode, people) {
  const n = Math.max(1, Math.ceil(days));
  const lines = [];
  const add = (label, id, times) => { const g = good(id); lines.push({ label, lo: g[2] * times, hi: g[3] * times }); };
  add(`ночлег в общей комнате · ${n} × ${people}`, 'bed-common', n * people);
  add(`похлёбка с хлебом дважды в день · ${n} × ${people}`, 'stew', n * people * 2);
  if (mode === 'horse') add(`корм лошади · ${n} × ${people}`, 'horse-feed', n * people);
  if (mode === 'cart') add(`корм упряжной лошади · ${n}`, 'horse-feed', n);
  return { nights: n, lines, lo: lines.reduce((s, l) => s + l.lo, 0), hi: lines.reduce((s, l) => s + l.hi, 0) };
}

/* «15–20 кордов», «3–5 марок», «2 гроша» — как в записи 16 */
const plural = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2]; };
export function money(lo, hi) {
  const unit = hi >= COIN.корд ? [COIN.корд, ['корд', 'корда', 'кордов']] : hi >= COIN.марка ? [COIN.марка, ['марка', 'марки', 'марок']] : [1, ['грош', 'гроша', 'грошей']];
  return range(lo, hi, unit);
}
/* крупная монета, только если её набирается хотя бы три: «28–34 марки», а не «1,4–1,7 корда» */
export function moneyRound(lo, hi) {
  const unit = hi >= 3 * COIN.корд ? [COIN.корд, ['корд', 'корда', 'кордов']] : hi >= 3 * COIN.марка ? [COIN.марка, ['марка', 'марки', 'марок']] : [1, ['грош', 'гроша', 'грошей']];
  return range(lo, hi, unit);
}
function range(lo, hi, unit) {
  const a = Math.round(lo / unit[0]), b = Math.round(hi / unit[0]);
  return (a === b ? a : a + '–' + b) + ' ' + plural(b, unit[1]);
}
export const fmtDays = ([a, b]) => {
  const f = v => { const x = Math.round(v * 2) / 2; return String(x).replace('.5', '½').replace(/^0½$/, '½'); };
  return f(a) === f(b) ? f(a) : f(a) + '–' + f(b);
};
/* «4 дня», «8 дней», «4½ дня» — с дробью всегда «дня» */
export const dayWord = ([, b]) => { const x = Math.round(b * 2) / 2; return x % 1 ? 'дня' : plural(x, ['день', 'дня', 'дней']); };
export const placeName = id => placeById(id)?.name || id;
/* места, куда можно проложить путь: концы и остановки трактов */
export const ROAD_PLACES = [...new Set(EDGES.flatMap(e => [e.from, e.to]))];
