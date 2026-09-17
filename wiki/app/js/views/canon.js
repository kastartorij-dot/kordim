/* Канон: чтение блоков мира (герои, правила, лорбук, приложения) прямо в вики.
   Данные — canon.js, автосборка из канон/*.md скриптом канон/_build/export-wiki.mjs.
   Пока только чтение: поиск, разделы, статус, ключи. Правка и «Входящие» — позже. */
import { $, $$, esc } from '../ui.js';
import { CANON } from '../../data/canon.js';

const GROUPS = [
  { k: 'герои', label: 'Герои', c: 'var(--ochre)' },
  { k: 'правила', label: 'Правила ведения', c: 'var(--mute)' },
  { k: 'записи', label: 'Лорбук', c: 'var(--ember)' },
  { k: 'приложения', label: 'Приложения', c: 'var(--dusk)' },
];

/* ключ блока для ссылки из поиска: у приложений в шапках нет id — берём заголовок */
export const canonKey = (group, item) => group + '-' + String(item.id || item.title).toLowerCase().replace(/\s+/g, '-');

const STATUS = {
  'канон': { label: 'канон', c: 'var(--sage)' },
  'открытый вопрос': { label: 'открытый вопрос', c: 'var(--ember)' },
  'черновик': { label: 'черновик', c: 'var(--dusk)' },
  'заморожен': { label: 'заморожен', c: 'var(--mute)' },
};

/* статус в шапке блока бывает с пояснением: «заморожен — выведен из сюжета 15.09…».
   Ярлык берём по слову до тире, пояснение показываем внутри раскрытого блока. */
function statusOf(raw) {
  const s = String(raw || 'канон');
  const i = s.indexOf(' — ');
  const key = (i < 0 ? s : s.slice(0, i)).trim();
  return { ...(STATUS[key] || { label: key, c: 'var(--mute)' }), note: i < 0 ? '' : s.slice(i + 3).trim() };
}

/* лёгкий markdown: абзацы, **жирный**, `код` */
function md(text) {
  return text
    .split(/\n\s*\n/)
    .map(p => {
      const line = esc(p.trim())
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
      return '<p>' + line + '</p>';
    })
    .join('');
}

export function render(root, [param]) {
  const all = GROUPS.flatMap(g => CANON[g.k].map(item => ({ ...item, группа: g.k })));
  let group = 'все';
  let query = '';

  root.innerHTML = `<div class="page canon-page" data-title="Канон">
    <div class="eyebrow">источник истины</div>
    <h1 class="h1">Канон</h1>
    <p class="lead">Единственный источник правды о мире. Собран из ${all.length} блоков — редактируются
      по одному, автор утверждает правку, отсюда пересобирается мастер-документ.</p>
    <div class="canon-bar">
      <input class="canon-search" placeholder="Поиск по тексту и ключам…">
      <div class="seg" id="canonSeg">
        <button aria-pressed="true" data-g="все">Всё <small>${all.length}</small></button>
        ${GROUPS.map(g => `<button aria-pressed="false" data-g="${g.k}">${g.label} <small>${CANON[g.k].length}</small></button>`).join('')}
      </div>
    </div>
    <div class="canon-grid" id="canonGrid"></div>
  </div>`;

  const grid = $('#canonGrid', root);

  function matches(item) {
    if (group !== 'все' && item.группа !== group) return false;
    if (!query) return true;
    const hay = (item.title + ' ' + (item.ключи || []).join(' ') + ' ' + item.текст).toLowerCase();
    return hay.includes(query);
  }

  function card(item) {
    const st = statusOf(item.статус);
    const gLabel = GROUPS.find(g => g.k === item.группа)?.label || item.группа;
    return `<article class="canon-item" data-id="${esc(canonKey(item.группа, item))}">
      <button class="canon-h">
        ${typeof item.id === 'number' || /^\d+$/.test(item.id) ? `<span class="canon-num">${esc(item.id)}</span>` : ''}
        <h3>${esc(item.title)}</h3>
        <span class="canon-st" style="--c:${st.c}"${st.note ? ` title="${esc(st.note)}"` : ''}>${esc(st.label)}</span>
        <span class="canon-part">${esc(gLabel)}</span>
      </button>
      <div class="canon-body" hidden>
        ${st.note ? `<p class="canon-note" style="--c:${st.c}">${esc(st.label)}: ${esc(st.note)}</p>` : ''}
        ${item.ключи && item.ключи.length ? `<div class="canon-keys">${item.ключи.map(k => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
        <div class="canon-text">${md(item.текст)}</div>
      </div>
    </article>`;
  }

  function paint() {
    const list = all.filter(matches);
    grid.innerHTML = list.length
      ? list.map(card).join('')
      : '<div class="empty">Ничего не нашлось.</div>';
  }
  paint();

  /* пришли по ссылке из поиска — раскрыть нужный блок и подвести к нему */
  if (param) {
    const art = $(`.canon-item[data-id="${CSS.escape(param)}"]`, root);
    if (art) {
      $('.canon-body', art).hidden = false;
      art.classList.add('open');
      requestAnimationFrame(() => art.scrollIntoView({ block: 'center' }));
    }
  }

  grid.addEventListener('click', e => {
    const h = e.target.closest('.canon-h');
    if (!h) return;
    const art = h.closest('.canon-item');
    const body = $('.canon-body', art);
    body.hidden = !body.hidden;
    art.classList.toggle('open', !body.hidden);
  });

  $('#canonSeg', root).addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    group = b.dataset.g;
    $$('#canonSeg button', root).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    paint();
  });

  const search = $('.canon-search', root);
  search.oninput = () => { query = search.value.trim().toLowerCase(); paint(); };
}
