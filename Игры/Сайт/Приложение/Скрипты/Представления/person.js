/* Страница персонажа — «досье». Одна раскладка для всех: слева портрет и кто он сейчас,
   справа текст сверху вниз. У кого собран полный профиль (Данные/Люди/*.js), добавляются
   «При себе и за душой», разделы «Кто он» и «Путь» — летопись по годам с тем, что пришло и ушло,
   и разговоры прямо в своих годах. Ничего не переключается и не прячется за наведением. */
import { $, $$, esc, IMG, pixelate, mountChat, personChip, placeChip, canonSources } from '../ui.js';
import { personById } from '../../Данные/people.js';
import { placeById } from '../../Данные/places.js';
import { EVENTS } from '../../Данные/events.js';
import { SCENES } from '../../Данные/scenes.js';

export function render(root, [id]){
  const p = personById(id);
  if (!p){ root.innerHTML = '<div class="page"><h1 class="h1">Нет такого человека</h1><p><a href="#/people">К списку людей</a></p></div>'; return; }
  const P = p.profile || null;
  const YEARS = P ? Object.keys(P.years).map(Number).sort((a, b) => a - b) : [];
  const NOW = YEARS[YEARS.length - 1];
  const now = P ? P.years[NOW] : null;
  const age = y => P && P.born ? Math.floor(y - P.born) : null;
  const label = y => String(P.years[y].label || y);
  const place = now ? now.place : p.place;
  const gallery = P && (P.gallery || []).length ? P.gallery : [p.img || 'Лица/' + p.id + '.jpg'];
  const stops = [];

  /* что при человеке сейчас; к какому году летописи прикрепить появление и уход вещи */
  const live = (x, y) => x.from <= y && (x.to == null || x.to >= y);
  const yearOf = from => YEARS.find(y => y >= from) ?? YEARS[0];
  const yearAfter = to => YEARS.find(y => y > to + .999);

  const thing = (x, cls = '') => '<li class="dz-thing' + (x.debt ? ' debt' : '') + cls + '">' +
    (x.pic ? '<span class="dz-ic" data-pic="' + esc(x.pic) + '"></span>' : '') +
    '<div><b>' + esc(x.n) + '</b>' + (x.debt ? '<span class="dz-debt">долг</span>' : '') + '<p>' + esc(x.t) + '</p></div></li>';

  /* «сейчас»: возраст и где; у короткой карточки — роль, если подзаголовок занят прозвищем */
  const nowRows = [
    age(NOW) != null ? '<div><dt>возраст</dt><dd>' + age(NOW) + ' лет</dd></div>' : '',
    now ? '<div><dt>' + esc(label(NOW)) + '</dt><dd>' + esc(now.where) + '</dd></div>' : p.alias ? '<div><dt>кто</dt><dd>' + esc(p.role) + '</dd></div>' : '',
  ].filter(Boolean);

  const side = `
    <aside class="dz-side">
      <div class="dz-photo">
        <img src="${IMG + gallery[0]}" alt="${esc(p.name)}" id="pImg" onerror="this.closest('.dz-photo').classList.add('noimg')"><canvas id="pCv" hidden></canvas>
        <button class="pxbtn" id="px" aria-pressed="false">пиксель</button>
        ${gallery.length > 1 ? '<div class="dz-gal">' + gallery.map((g, i) => '<button data-g="' + esc(g) + '" class="' + (i ? '' : 'on') + '" aria-label="Портрет ' + (i + 1) + '"><img src="' + IMG + g + '" alt="" loading="lazy"></button>').join('') + '</div>' : ''}
      </div>
      <div class="eyebrow"><a href="#/people">люди</a></div>
      <h1 class="dz-name">${esc(p.name)}</h1>
      <div class="dz-sub">${esc(P ? P.subtitle : (p.alias || p.role).toUpperCase())}</div>
      ${p.frozen ? '<p class="pending"><span class="badge draft">заморожен</span> Персонаж выведен из сюжета. Описание сохранено для справки.</p>' : ''}
      ${nowRows.length ? '<dl class="dz-now">' + nowRows.join('') + '</dl>' : ''}
      ${place && placeById(place) ? '<div>' + placeChip(place) + '</div>' : ''}
      ${P && (P.links || []).length ? '<div class="dz-links">' + P.links.map(personChip).join('') + '</div>' : ''}
      ${canonSources('people', p.id)}
      ${P && P.secret ? '<details class="secret"><summary>только для автора</summary><div class="secret-pop">' + esc(P.secret) + '</div></details>' : ''}
    </aside>`;

  /* короткая карточка: вступление, биография, факты */
  const intro = '<p class="dz-lead">' + esc(p.lead) + '</p>' +
    (!P ? (p.bio || []).map(t => '<p class="dz-p">' + esc(t) + '</p>').join('') +
      ((p.facts || []).length ? '<div class="dz-facts">' + p.facts.map(f => '<span class="chip">' + esc(f) + '</span>').join('') + '</div>' : '') +
      '<p class="dz-later">Полного досье — летописи по годам, вещей и разговоров — у этого человека пока нет.</p>' : '');

  let body = intro;
  if (P){
    const things = (P.things || []).filter(x => live(x, NOW)), promises = (P.promises || []).filter(x => live(x, NOW));
    body += `
      <section class="dz-sec" id="carry"><h2>При себе и за душой <small>${esc(label(NOW))}</small></h2>
        <div class="dz-two">
          <div><h3>При себе</h3><ul class="dz-things">${things.map(x => thing(x)).join('') || '<li class="dz-none">ничего примечательного</li>'}</ul></div>
          <div><h3>Долги и обещания</h3><ul class="dz-things" id="debts">${promises.map(x => thing(x)).join('') || '<li class="dz-none">никому не должен</li>'}</ul></div>
        </div>
      </section>
      ${(P.desc || []).length ? '<section class="dz-sec"><h2>О человеке</h2>' + P.desc.map((s, i) =>
        '<details class="dz-acc"' + (i ? '' : ' open') + '><summary>' + esc(s.h) + '</summary>' + s.p.map(t => '<p class="dz-p">' + esc(t) + '</p>').join('') + '</details>').join('') + '</section>' : ''}
      <section class="dz-sec"><h2>Путь</h2><ol class="dz-path">${YEARS.map(y => {
        const s = P.years[y];
        const era = (P.eras || []).find(([e], k, arr) => e <= y && YEARS.find(z => z >= e) === y);
        const came = [...(P.things || []), ...(P.promises || [])].filter(x => yearOf(x.from) === y);
        const went = [...(P.things || []), ...(P.promises || [])].filter(x => x.to != null && yearAfter(x.to) === y);
        const talk = (P.talks || {})[y];
        return (era ? '<li class="dz-era">' + esc(era[1]) + '</li>' : '') +
          '<li class="dz-yr' + (y === NOW ? ' now' : '') + '" id="y' + String(y).replace('.', '_') + '">' +
          '<div class="dz-when"><b>' + esc(label(y)) + '</b>' + (age(y) != null ? '<span>' + age(y) + ' лет</span>' : '') + '</div>' +
          '<div class="dz-what"><h3>' + esc(s.mark[0].toUpperCase() + s.mark.slice(1)) + '<small>' + esc(s.where) + '</small></h3><p>' + esc(s.text) + '</p>' +
          (came.length || went.length ? '<div class="dz-delta">' + came.map(x => '<span class="in' + (x.debt ? ' debt' : '') + '">+ ' + esc(x.n) + '</span>').join('') + went.map(x => '<span class="out">− ' + esc(x.n) + '</span>').join('') + '</div>' : '') +
          (talk ? '<details class="dz-talk" data-y="' + y + '"><summary>Разговор · ' + esc(talk.where) + (talk.draft ? ' <span class="badge draft">набросок</span>' : '') + '</summary><div class="dz-chat"></div></details>' : '') +
          '</div></li>';
      }).join('')}</ol></section>`;
  }

  /* где человек есть в хронике и в прозе */
  const seen = EVENTS.map((e, i) => [e, i]).filter(([e]) => (e.people || []).includes(p.id));
  if (seen.length) body += '<section class="dz-sec"><h2>В хронике и сценах <small>' + seen.length + '</small></h2><ul class="dz-seen">' + seen.map(([e, i]) => {
    const sc = SCENES.find(x => (x.events || [x.event]).includes(e.slug));
    return '<li><a href="#/chronicle/' + i + '"><span>' + esc(e.y) + '</span><b>' + esc(e.h) + '</b></a>' +
      (sc ? '<a class="dz-scene" href="#/scenes/' + esc(sc.arc) + '">сцена' + (sc.status === 'готово' ? '' : ' · черновик') + ' →</a>' : '') + '</li>';
  }).join('') + '</ul></section>';

  root.innerHTML = '<div class="dz" data-title="' + esc(p.name) + '">' + side + '<div class="dz-main">' + body + '</div></div>';

  /* картинки вещей, если нарисованы: Изображения/Предметы/<pic>.png; нет файла — остаётся значок */
  $$('.dz-ic[data-pic]', root).forEach(s => {
    const im = new Image(); im.alt = ''; im.onload = () => { s.appendChild(im); s.closest('.dz-thing').classList.add('pic'); }; im.src = IMG + 'Предметы/' + s.dataset.pic + '.png'; });

  /* разговор открывается внутри своего года; заработанное в разговоре падает в «Долги и обещания» */
  $$('.dz-talk', root).forEach(d => d.addEventListener('toggle', () => {
    if (!d.open || d.dataset.on) return; d.dataset.on = 1;
    const t = P.talks[d.dataset.y];
    stops.push(mountChat($('.dz-chat', d), t.tree, {gains:P.gains || {}, onGain:g => {
      const box = $('#debts', root); if (!box) return;
      $('.dz-none', box)?.remove(); box.insertAdjacentHTML('beforeend', thing(g, ' new'));
    }}));
  }));

  /* портрет: галерея и пиксель */
  const img = $('#pImg', root), cv = $('#pCv', root), px = $('#px', root);
  px.onclick = () => { const on = px.getAttribute('aria-pressed') !== 'true'; px.setAttribute('aria-pressed', on);
    img.hidden = on; cv.hidden = !on; if (on) pixelate(img.getAttribute('src'), cv); };
  $$('.dz-gal button', root).forEach(b => b.onclick = () => {
    $$('.dz-gal button', root).forEach(x => x.classList.toggle('on', x === b));
    img.setAttribute('src', IMG + b.dataset.g);
    if (px.getAttribute('aria-pressed') === 'true') pixelate(IMG + b.dataset.g, cv);
  });

  return () => stops.forEach(f => f && f());
}
