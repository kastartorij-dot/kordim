/* Арки: проза, собранная из проза/*.md скриптом канон/_build/export-scenes.mjs.
   Плитка = arc (своя история — «Дело Обрана Дюра», «Как появилась Нора», «Лихо»...),
   НЕ сюжетная линия хроники: несколько арок могут идти по одной линии (grace) и всё
   равно быть разными плитками. Линия (line) используется только для цвета плитки и
   для списка «в хронике, но ещё не написано» — он общий по линии, не по одной арке.
   #/scenes — список арок со сценами.
   #/scenes/<арка> — все сцены арки одним текстом, по порядку событий (s), главы —
   заголовки сцен. Под каждой главой — статус (если не «готово»), люди, место. */
import { $, esc, personChip, placeChip, proseHTML, plural } from '../ui.js';
import { SCENES, scenesOf } from '../../data/scenes.js';
import { EVENTS, LINES, LINE_COLOR } from '../../data/events.js';
import { UNPLAYED } from '../../data/unplayed.js';

export function render(root, [arc]) {
  return arc ? arcView(root, arc) : listView(root);
}

function arcTitle(arc, list){ return LINES[arc] || list[0].title; }

function listView(root) {
  const arcs = [...new Set(SCENES.map(s => s.arc))];
  root.innerHTML = `<div class="page" data-title="Арки">
    <div class="eyebrow">проза</div><h1 class="h1">Арки</h1>
    <p class="lead">Написанные сцены, собранные по историям. Внутри арки — читаются
      одним текстом по порядку событий, а не по дате правки файла.</p>
    <div class="scene-arcs">${arcs.length ? arcs.map(k => {
      const list = scenesOf(k), words = list.reduce((s, x) => s + x.words, 0);
      const draft = list.some(s => s.status !== 'готово');
      return `<a class="card scene-arc" href="#/scenes/${k}" style="--c:${LINE_COLOR[list[0].line] || 'var(--ochre)'}">
        <b>${esc(arcTitle(k, list))}</b>
        <span>${list.length} ${plural(list.length, ['сцена', 'сцены', 'сцен'])} · ${words.toLocaleString('ru-RU')} слов</span>
        ${draft ? '<span class="badge draft">есть черновики</span>' : ''}
      </a>`;
    }).join('') : '<p class="empty">Пока ничего не написано — сцены появятся здесь по мере готовности.</p>'}</div>
    ${UNPLAYED.length ? `<h3 class="scene-todo-h">В РАБОТЕ <small>${UNPLAYED.length}</small></h3>
    <div class="scene-arcs">${UNPLAYED.map(a => `<div class="card scene-arc todo">
        <b>${esc(a.h)}</b>
        <span>${esc(a.y)}</span>
        <p>${esc(a.t)}</p>
        <div>${a.people.map(personChip).join('')}</div>
        <span class="badge">не отыграно</span>
      </div>`).join('')}</div>` : ''}
  </div>`;
}

function arcView(root, arc) {
  const list = scenesOf(arc);
  if (!list.length) {
    root.innerHTML = `<div class="page" data-title="${esc(arc)}"><h1 class="h1">${esc(arc)}</h1><p><a href="#/scenes">← все арки</a></p><p class="empty">Для этой арки ещё нет сцен.</p></div>`;
    return;
  }
  const name = arcTitle(arc, list);
  const line = list[0].line;
  const words = list.reduce((s, x) => s + x.words, 0);
  const covered = new Set(SCENES.map(s => s.event));
  const missing = line ? EVENTS.filter(e => (e.lines || []).includes(line) && !covered.has(e.slug)) : [];

  root.innerHTML = `<div class="page scene-page" data-title="${esc(name)}" style="--c:${LINE_COLOR[line] || 'var(--ochre)'}">
    <div class="eyebrow"><a href="#/scenes">арки</a></div>
    <h1 class="h1">${esc(name)}</h1>
    <p class="lead">${list.length} ${plural(list.length, ['сцена', 'сцены', 'сцен'])} · ${words.toLocaleString('ru-RU')} слов подряд</p>
    <article class="prose scene-flow">
      ${list.map(chapter).join('')}
    </article>
    ${missing.length ? `<section class="card" style="margin-top:28px"><h3>В ХРОНИКЕ, НО ЕЩЁ НЕ НАПИСАНО <small>${missing.length}</small></h3>
      <ul class="list">${missing.map(e => '<li><b>' + esc(e.y) + '.</b> ' + esc(e.h) + '</li>').join('')}</ul></section>` : ''}
  </div>`;
}

function chapter(s) {
  /* первая строка текста часто повторяет заголовок файла (# Название) — он уже показан
     в шапке главы строкой выше, второй раз голым текстом с решёткой не нужен */
  const body = s.text.replace(/^#\s+.*(?:\n+|$)/, '');
  return `<header class="scene-chap">
    <h2>${esc(s.title)}</h2>
    <div class="scene-meta">
      ${s.status !== 'готово' ? '<span class="badge draft">' + esc(s.status) + '</span>' : ''}
      ${s.place ? placeChip(s.place) : ''}
      ${s.people.map(personChip).join('')}
      <span class="scene-words">${s.words.toLocaleString('ru-RU')} слов</span>
    </div>
  </header>${proseHTML(body)}`;
}
