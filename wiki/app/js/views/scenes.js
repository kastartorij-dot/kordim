/* Арки: проза, собранная из проза/*.md скриптом канон/_build/export-scenes.mjs.
   #/scenes — список арок (= lines из хроники) со сценами.
   #/scenes/<арка> — все сцены арки одним текстом, по порядку событий (s), главы —
   заголовки сцен. Под каждой главой — статус (если не «готово»), люди, место.
   Внизу — какие события этой арки в хронике ещё без сцены. */
import { $, esc, personChip, placeChip, proseHTML, plural } from '../ui.js';
import { SCENES, scenesOf } from '../../data/scenes.js';
import { EVENTS, LINES, LINE_COLOR } from '../../data/events.js';

export function render(root, [arc]) {
  return arc ? arcView(root, arc) : listView(root);
}

function listView(root) {
  const arcs = Object.keys(LINES).filter(k => scenesOf(k).length);
  root.innerHTML = `<div class="page" data-title="Арки">
    <div class="eyebrow">проза</div><h1 class="h1">Арки</h1>
    <p class="lead">Написанные сцены, собранные по сюжетным линиям хроники. Внутри арки — читаются
      одним текстом по порядку событий, а не по дате правки файла.</p>
    <div class="scene-arcs">${arcs.length ? arcs.map(k => {
      const list = scenesOf(k), words = list.reduce((s, x) => s + x.words, 0);
      const draft = list.some(s => s.status !== 'готово');
      return `<a class="card scene-arc" href="#/scenes/${k}" style="--c:${LINE_COLOR[k]}">
        <b>${esc(LINES[k])}</b>
        <span>${list.length} ${plural(list.length, ['сцена', 'сцены', 'сцен'])} · ${words.toLocaleString('ru-RU')} слов</span>
        ${draft ? '<span class="badge draft">есть черновики</span>' : ''}
      </a>`;
    }).join('') : '<p class="empty">Пока ничего не написано — сцены появятся здесь по мере готовности.</p>'}</div>
  </div>`;
}

function arcView(root, arc) {
  const list = scenesOf(arc);
  const name = LINES[arc] || arc;
  if (!list.length) {
    root.innerHTML = `<div class="page" data-title="${esc(name)}"><h1 class="h1">${esc(name)}</h1><p><a href="#/scenes">← все арки</a></p><p class="empty">Для этой арки ещё нет сцен.</p></div>`;
    return;
  }
  const words = list.reduce((s, x) => s + x.words, 0);
  const covered = new Set(list.map(s => s.event));
  const missing = EVENTS.filter(e => (e.lines || []).includes(arc) && !covered.has(e.slug));

  root.innerHTML = `<div class="page scene-page" data-title="${esc(name)}" style="--c:${LINE_COLOR[arc] || 'var(--ochre)'}">
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
