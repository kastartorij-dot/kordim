// Собирает из Проза/*.md читалку для вычитки: красивый текст, пометки
// «не нравится / вопрос / заметка» на выделенных словах, выгрузка пометок для чата.
// Пометки живут в браузере (localStorage) и переживают пересборку: место ищется по цитате.
// Результат — Проза/Читалка/<файл>.html (для ПК, в гит не идёт, см. .gitignore) и та же
// читалка на сайте: Игры/Сайт/Читалка/ (в гите, уезжает на сайт с push; с телефона —
// kordim.kastartorij.workers.dev/read). Проза на сайте и так есть в «Сценах», нового наружу не уходит.
//
// node Канон/_Сборка/reader.mjs                      — вся проза
// node Канон/_Сборка/reader.mjs Ошерская_история.md  — один файл
//
// Разбор вычитки — вторая вкладка той же читалки: файл в Канон/ с шапкой
//   ---
//   читалка: Ошерская_история.md
//   было: <коммит>      — необязательно: с какой версией рассказа сравнивать,
//   ---                    правки подсвечиваются в читалке (кнопка «Правки»)
// Шапка — в разборе, а не в прозе, чтобы не сдвигать номера строк рассказа.
// На разборе можно ставить такие же пометки; хранятся отдельно, выгружаются вместе
// с пометками к рассказу, номера строк — по файлу разбора. Если разборов к одному
// рассказу несколько, вкладкой становится самый свежий по имени файла.

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PROZA = path.join(ROOT, 'Проза');
const OUT = path.join(PROZA, 'Читалка');
const SITE = path.join(ROOT, 'Игры', 'Сайт', 'Читалка');
const TEMPLATE = fs.readFileSync(path.join(HERE, 'reader-template.html'), 'utf8');

function readProse(file) {
  const lines = fs.readFileSync(path.join(PROZA, file), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  const front = {};
  let i = 0;
  if (lines[0] === '---') {
    for (i = 1; i < lines.length && lines[i] !== '---'; i++) {
      const m = lines[i].match(/^([a-zа-я]+):\s*(.*)$/i);
      if (m) front[m[1]] = m[2].trim();
    }
    i++;
  }
  // номер строки абзаца — как в файле, чтобы пометки из читалки совпадали с правкой
  const blocks = [];
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (/^-{3,}$|^\*{3,}$/.test(t)) { blocks.push({ kind: 'break' }); continue; }
    const h = t.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      if (h[1] === front.title && !blocks.length) continue;
      blocks.push({ kind: 'h', text: h[1] });
      continue;
    }
    blocks.push({ kind: 'p', line: i + 1, text: t });
  }
  return { front, blocks };
}

// Markdown разбора: заголовки, абзацы, цитаты (>), пункты списков (-, 1.), --- как разрыв.
// Жирный, курсив и `код` снимаются из текста и сохраняются отрезками fmt — так пометки
// считают смещения по чистому тексту, а вид остаётся.
function inline(src) {
  let text = '';
  const fmt = [], open = {};
  const re = /\*\*|`|\*/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    const tok = m[0];
    const kind = tok === '**' ? 'b' : tok === '`' ? 'code' : 'i';
    // одиночная * посреди слова или в коде — просто символ
    if (open.code != null && kind !== 'code') continue;
    text += src.slice(last, m.index);
    last = m.index + tok.length;
    if (open[kind] != null) { if (text.length > open[kind]) fmt.push([open[kind], text.length, kind]); delete open[kind]; }
    else open[kind] = text.length;
  }
  text += src.slice(last);
  return { text, fmt };
}
function readDoc(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  let title = '';
  const blocks = [];
  let i0 = 0;
  if (lines[0] === '---') { i0 = lines.indexOf('---', 1) + 1; }
  // шапка разбора служебная, в читалку не идёт
  for (let i = i0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t || t === '>') continue;
    if (/^-{3,}$|^\*{3,}$/.test(t)) { blocks.push({ kind: 'break' }); continue; }
    let tag = 'p', depth = 0, marker = '', body = t;
    let m;
    if ((m = t.match(/^(#{1,6})\s+(.*)$/))) {
      if (m[1].length === 1 && !title) { title = m[2]; continue; }
      tag = 'h' + Math.min(m[1].length, 3); body = m[2];
    } else if ((m = t.match(/^>\s?(.*)$/))) { tag = 'quote'; body = m[1]; }
    else if ((m = raw.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/))) {
      tag = 'li'; depth = Math.floor(m[1].replace(/\t/g, '  ').length / 2); marker = /\d/.test(m[2]) ? m[2] : ''; body = m[3];
    }
    const { text, fmt } = inline(body);
    const b = { kind: 'p', line: i + 1, text, tag };
    if (fmt.length) b.fmt = fmt;
    if (depth) b.depth = depth;
    if (marker) b.marker = marker;
    blocks.push(b);
  }
  return { title, blocks };
}

// разборы: Канон/*.md с `читалка: <файл прозы>` в шапке
const KANON = path.join(ROOT, 'Канон');
const reviews = {};
for (const f of fs.readdirSync(KANON).filter(f => f.endsWith('.md')).sort()) {
  const head = fs.readFileSync(path.join(KANON, f), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  if (head[0] !== '---') continue;
  for (let i = 1; i < head.length && head[i] !== '---'; i++) {
    const m = head[i].match(/^читалка:\s*(.+)$/);
    if (m) reviews[path.basename(m[1].trim())] = `Канон/${f}`;
  }
}

// Схемы к рассказу: Проза/Схемы/<id>_*.html — отдельные страницы, кнопка в шапке читалки
const SCHEMES = path.join(PROZA, 'Схемы');
function schemesFor(id) {
  if (!fs.existsSync(SCHEMES)) return [];
  return fs.readdirSync(SCHEMES).filter(f => f.startsWith(id + '_') && f.endsWith('.html')).sort().map(f => {
    const html = fs.readFileSync(path.join(SCHEMES, f), 'utf8');
    const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || f;
    for (const dir of [OUT, SITE]) {
      fs.mkdirSync(path.join(dir, 'Схемы'), { recursive: true });
      fs.copyFileSync(path.join(SCHEMES, f), path.join(dir, 'Схемы', f));
    }
    return { href: 'Схемы/' + f, title: t.replace(/\s+—\s+схема$/, '') };
  });
}

// Правки: прошлая версия рассказа из git → какие куски нового текста вставлены/изменены и что убрано.
function gitShow(rev, rel) {
  try { return execFileSync('git', ['show', `${rev}:${rel}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { console.warn(`! не удалось взять ${rel} из ${rev} — правки не подсвечены`); return null; }
}
function parasOf(text) {
  const lines = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  if (lines[0] === '---') i = lines.indexOf('---', 1) + 1;
  const out = [];
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || /^-{3,}$|^\*{3,}$/.test(t) || /^#{1,6}\s/.test(t)) continue;
    out.push(t);
  }
  return out;
}
function lcs(a, b, eq) {
  const n = a.length, m = b.length, T = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    T[i][j] = eq(a[i], b[j]) ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
  const pairs = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { pairs.push([i, j]); i++; j++; }
    else if (T[i + 1][j] >= T[i][j + 1]) i++; else j++;
  }
  return pairs;
}
const tokens = s => s.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
// разница внутри абзаца: вставленные отрезки нового текста и убранные куски старого (с позицией в новом)
function wordDiff(oldT, newT) {
  const a = tokens(oldT), b = tokens(newT);
  const pairs = lcs(a, b, (x, y) => x === y);
  const ins = [], del = [];
  let ai = 0, bi = 0, pos = 0, same = 0;
  const offs = []; { let o = 0; for (const t of b) { offs.push(o); o += t.length; } offs.push(o); }
  const flush = (a0, a1, b0, b1) => {
    const removed = a.slice(a0, a1).join('');
    const added = b.slice(b0, b1).join('');
    if (added.trim()) {
      // края-пробелы не красим
      let s0 = offs[b0], s1 = offs[b1];
      while (s0 < s1 && /\s/.test(newT[s0])) s0++;
      while (s1 > s0 && /\s/.test(newT[s1 - 1])) s1--;
      ins.push([s0, s1]);
    }
    if (removed.trim()) del.push([offs[b0], removed.trim()]);
  };
  for (const [x, y] of pairs) {
    if (x > ai || y > bi) flush(ai, x, bi, y);
    same += b[y].trim() ? 1 : 0;
    ai = x + 1; bi = y + 1;
  }
  if (ai < a.length || bi < b.length) flush(ai, a.length, bi, b.length);
  const words = b.filter(t => t.trim()).length || 1;
  // соседние вставки через пробел — одним куском, соседние удаления в одной точке — одной пометкой
  const insM = [];
  for (const r of ins) {
    const last = insM[insM.length - 1];
    if (last && /^[\s,]*$/.test(newT.slice(last[1], r[0]))) last[1] = r[1]; else insM.push(r.slice());
  }
  const delM = [];
  for (const d of del) {
    const last = delM[delM.length - 1];
    const between = last ? newT.slice(last[0], d[0]) : '';
    // удаления, разделённые только тем, что теперь вставлено, — тоже вместе
    if (last && insM.some(r => r[0] <= last[0] && r[1] >= d[0] - 1 && between.length < 40)) last[1] += ' ' + d[1];
    else if (last && last[0] === d[0]) last[1] += ' ' + d[1];
    else delM.push(d.slice());
  }
  return { ins: insM, del: delM, ratio: same / words };
}
function diffProse(oldText, blocks) {
  const oldP = parasOf(oldText);
  const newB = blocks.filter(b => b.kind === 'p');
  const pairs = lcs(oldP, newB.map(b => b.text), (x, y) => x === y);
  let changed = 0;
  const mark = (b, d) => { if (d.ins.length) b.ins = d.ins; if (d.del.length) b.del = d.del; if (d.ins.length || d.del.length) { b.chg = 1; changed++; } };
  const gaps = [];
  let pi = 0, pj = 0;
  for (const [i, j] of [...pairs, [oldP.length, newB.length]]) { gaps.push([pi, i, pj, j]); pi = i + 1; pj = j + 1; }
  for (const [o0, o1, n0, n1] of gaps) {
    const olds = oldP.slice(o0, o1), news = newB.slice(n0, n1);
    if (!news.length) {
      // абзацы убраны целиком — показываем у следующего абзаца
      if (olds.length) { const host = newB[n1] || newB[newB.length - 1]; (host.del = host.del || []).unshift([0, olds.join(' / ')]); if (!host.chg) { host.chg = 1; changed++; } }
      continue;
    }
    // каждому новому абзацу — самый похожий старый из этого промежутка (по порядку)
    let k = 0;
    const left = [];
    news.forEach((b, idx) => {
      let best = -1, bestR = 0, bestD = null;
      for (let q = k; q < olds.length; q++) {
        const d = wordDiff(olds[q], b.text);
        if (d.ratio > bestR) { bestR = d.ratio; best = q; bestD = d; }
      }
      if (best >= 0 && bestR >= .35) {
        for (let q = k; q < best; q++) left.push([idx, olds[q]]);
        mark(b, bestD); k = best + 1;
      } else { b.ins = [[0, b.text.length]]; b.chg = 1; b.fresh = 1; changed++; }
    });
    for (let q = k; q < olds.length; q++) left.push([news.length - 1, olds[q]]);
    for (const [idx, t] of left) { const b = news[idx]; (b.del = b.del || []).push([b.text.length, t]); if (!b.chg) { b.chg = 1; changed++; } }
  }
  return changed;
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2).map(f => path.basename(f))
  : fs.readdirSync(PROZA).filter(f => f.endsWith('.md'));

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SITE, { recursive: true });
for (const file of files) {
  const { front, blocks } = readProse(file);
  const title = front.title || file.replace(/\.md$/, '');
  const docs = [{ id: file.replace(/\.md$/, ''), tab: 'Рассказ', file: `Проза/${file}`, title, status: front.status || '', blocks }];
  docs[0].schemes = schemesFor(docs[0].id);
  if (reviews[file]) {
    const rel = reviews[file];
    const review = readDoc(path.join(ROOT, rel));
    const head = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^﻿/, '').split('\n');
    const was = head[0] === '---' ? (head.slice(1, head.indexOf('---', 1)).find(l => /^было:/.test(l)) || '').replace(/^было:\s*/, '').trim() : '';
    if (was) {
      const old = gitShow(was, `Проза/${file}`);
      if (old != null) { docs[0].diffFrom = was; docs[0].changed = diffProse(old, blocks); }
    }
    docs.push({ id: docs[0].id + '~разбор', tab: 'Разбор', style: 'doc', file: rel,
      // «Ошерская история — разбор вычитки (35 заметок)» → «Разбор вычитки (35 заметок)»: история и так в подзаголовке
      title: (review.title || 'Разбор').replace(title + ' — ', '').replace(/^./, c => c.toUpperCase()),
      status: '', blocks: review.blocks });
  }
  const json = JSON.stringify(docs).replace(/</g, '\\u003c');
  const html = TEMPLATE
    .replace('__TITLE__', esc(title))
    .replace('__DATA__', () => json);
  const name = file.replace(/\.md$/, '.html');
  fs.writeFileSync(path.join(OUT, name), html);
  fs.writeFileSync(path.join(SITE, name), html);
  console.log(`✓ ${name} — ${docs.map(d => `${d.tab}: ${d.blocks.filter(b => b.kind === 'p').length} абзацев`).join(', ')}` +
    (docs[0].diffFrom ? `, правок против ${docs[0].diffFrom}: ${docs[0].changed} абзацев` : '') +
    (docs[0].schemes.length ? `, схем: ${docs[0].schemes.length}` : ''));
}

// оглавление для телефона — по всей прозе, не только по пересобранной
const list = fs.readdirSync(PROZA).filter(f => f.endsWith('.md')).map(f => {
  const { front, blocks } = readProse(f);
  const words = blocks.filter(b => b.kind === 'p').map(b => b.text).join(' ').split(/\s+/).filter(Boolean).length;
  return { href: encodeURI(f.replace(/\.md$/, '.html')), title: front.title || f.replace(/\.md$/, ''), status: front.status || '', words };
}).sort((a, b) => a.title.localeCompare(b.title, 'ru'));
const rows = list.map(x => `  <a href="${x.href}"><b>${esc(x.title)}</b><span>${x.status ? esc(x.status) + ' · ' : ''}${x.words.toLocaleString('ru-RU')} слов · ~${Math.round(x.words / 180)} мин</span></a>`).join('\n');
fs.writeFileSync(path.join(SITE, 'index.html'), `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Читалка</title>
<link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,600&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet">
<style>
:root { --bg: #f5efe3; --paper: #fbf7ef; --ink: #2a241d; --muted: #8a7f70; --rule: #e4dac8; --accent: #8c3b2a; }
@media (prefers-color-scheme: dark) { :root { --bg: #161411; --paper: #1d1a16; --ink: #ddd4c6; --muted: #8f8577; --rule: #2f2a24; --accent: #d98b6c; } }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 "PT Sans", Arial, sans-serif; }
main { max-width: 36em; margin: 0 auto; padding: calc(40px + env(safe-area-inset-top)) 16px 48px; }
.kicker { font-size: 13px; letter-spacing: .22em; text-transform: uppercase; color: var(--muted); }
h1 { font: 600 2em/1.15 "Literata", Georgia, serif; margin: .3em 0 .8em; }
a { display: block; background: var(--paper); border: 1px solid var(--rule); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; color: inherit; text-decoration: none; }
a b { display: block; font: 600 19px/1.3 "Literata", Georgia, serif; margin-bottom: 3px; }
a span { color: var(--muted); font-size: 14px; }
a.home { display: inline-block; padding: 6px 12px; border-radius: 999px; font-size: 14px; margin-bottom: 20px; }
p { color: var(--muted); font-size: 14px; margin-top: 24px; }
</style>
</head>
<body>
<main>
  <a class="home" href="../Приложение/">⌂ Кордим — на главную</a>
  <div class="kicker">Кордим · проза</div>
  <h1>Читалка</h1>
${rows}
  <p>Пометки хранятся в этом браузере. Когда закончишь — «Заметки» → «Скопировать для Claude» и вставь в чат.</p>
</main>
</body>
</html>
`);
console.log(`✓ оглавление: ${path.relative(ROOT, path.join(SITE, 'index.html'))}`);
