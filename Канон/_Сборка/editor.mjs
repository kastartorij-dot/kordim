// Редактор — клон читалки для ответов автора: что Claude ждёт от автора и очередь будущих арок.
// Источник — Канон/Редактор/*.md (не канон, рабочие списки), шаблон — editor-template.html рядом.
// Результат — Игры/Сайт/Читалка/Редактор.html (в гите, на сайте /read → «Редактор») и
// Проза/Читалка/Редактор.html (для ПК, в гит не идёт). Ответы живут в браузере (localStorage)
// и выгружаются кнопкой «Скопировать для Claude».
//
// node Канон/_Сборка/editor.mjs
//
// Разметка источника:
//   ---
//   редактор: вопросы | арки      — вид страницы (у арок свои варианты ответа по умолчанию)
//   обновлено: ДД.ММ.ГГГГ
//   ---
//   # Заголовок страницы
//   абзацы до первого ## — вступление
//   ## Раздел
//   ### В01 · Заголовок вопроса   — карточка; номер постоянный, по нему хранится ответ
//   Когда: … · Кто: … · Где: …     — (только у арок, первая строка) ярлыки
//   абзацы и «- пункты»            — справка
//   - (а) вариант. *Советую.*      — вариант ответа; «*Советую…*» или «*Мне … интереснее*» ставит звёздочку
//   > текст                        — «моё мнение» (у арок — «почему стоит»)
// Ответ на вопрос, которого больше нет в источнике, просто не показывается и не выгружается.
// Если текст вопроса поменялся после ответа, редактор пишет «вопрос изменился — проверь».

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SRC = path.join(ROOT, 'Канон', 'Редактор');
const OUTS = [path.join(ROOT, 'Игры', 'Сайт', 'Читалка'), path.join(ROOT, 'Проза', 'Читалка')];
const TEMPLATE = fs.readFileSync(path.join(HERE, 'editor-template.html'), 'utf8');

const ARC_OPTIONS = ['Хочу следующей', 'Хочу, но позже', 'Не сейчас', 'Не хочу'];
const LETTERS = 'абвгдеж';

const escH = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  return escH(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
}

function readDoc(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  const front = {};
  let i = 0;
  if (lines[0] === '---') {
    for (i = 1; i < lines.length && lines[i] !== '---'; i++) {
      const m = lines[i].match(/^([a-zа-яё]+):\s*(.*)$/i);
      if (m) front[m[1]] = m[2].trim();
    }
    i++;
  }
  const kind = front['редактор'] || 'вопросы';
  const doc = { id: kind, kind, tab: '', title: '', updated: front['обновлено'] || '', file: path.relative(ROOT, file).split(path.sep).join('/'), intro: [], sections: [] };
  let sec = null, item = null;
  const ids = new Set();
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    let m;
    if ((m = t.match(/^#\s+(.*)$/))) { doc.title = m[1]; continue; }
    if ((m = t.match(/^##\s+(.*)$/))) { sec = { title: m[1], items: [] }; doc.sections.push(sec); item = null; continue; }
    if ((m = t.match(/^###\s+(\S+)\s+·\s+(.*)$/))) {
      if (!sec) { sec = { title: '', items: [] }; doc.sections.push(sec); }
      if (ids.has(m[1])) throw new Error(`${doc.file}: номер ${m[1]} повторяется`);
      ids.add(m[1]);
      item = { id: m[1], title: inline(m[2]), meta: [], ctx: [], opinion: [], options: [], raw: [t] };
      sec.items.push(item);
      continue;
    }
    if (!item) { if (!sec) doc.intro.push(inline(t)); continue; }
    item.raw.push(t);
    if (kind === 'арки' && !item.meta.length && !item.ctx.length && /^Когда:/.test(t)) { item.meta = t.split(/\s+·\s+/).map(inline); continue; }
    if ((m = t.match(/^-\s+\(([а-яa-z])\)\s+(.*)$/i))) {
      const rec = /\*(Советую|Мне[^*]*интересн)[^*]*\*/.test(m[2]);
      item.options.push({ k: m[1], html: inline(m[2]), rec });
      continue;
    }
    if ((m = t.match(/^>\s?(.*)$/))) { item.opinion.push(inline(m[1])); continue; }
    if ((m = t.match(/^[-*]\s+(.*)$/))) { item.ctx.push({ kind: 'li', html: inline(m[1]) }); continue; }
    item.ctx.push({ kind: 'p', html: inline(t) });
  }
  for (const s of doc.sections) for (const it of s.items) {
    if (!it.options.length && kind === 'арки') { it.options = ARC_OPTIONS.map((o, n) => ({ k: LETTERS[n], html: o, rec: false })); it.short = true; }
    it.h = createHash('sha1').update(it.raw.join('\n')).digest('hex').slice(0, 8);
    delete it.raw;
  }
  doc.tab = kind === 'арки' ? 'Будущие арки' : 'Ждёт тебя';
  return doc;
}

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.md')).sort();
const docs = files.map(f => readDoc(path.join(SRC, f)));
const all = docs.flatMap(d => d.sections.flatMap(s => s.items.map(it => it.id)));
const dup = all.filter((x, n) => all.indexOf(x) !== n);
if (dup.length) throw new Error('номера повторяются между страницами: ' + dup.join(', '));

const json = JSON.stringify(docs).replace(/</g, '\\u003c');
const html = TEMPLATE.replace('__DATA__', () => json);
for (const dir of OUTS) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Редактор.html'), html);
}
console.log('✓ Редактор.html — ' + docs.map(d => `${d.tab}: ${d.sections.reduce((n, s) => n + s.items.length, 0)}`).join(', '));
