import { esc, IMG } from '../ui.js';
import { PEOPLE, GROUPS } from '../../Данные/people.js';
import { placeById } from '../../Данные/places.js';

export function render(root){
  root.innerHTML = `<div class="page" data-title="Люди">
    <div class="eyebrow">реестр</div><h1 class="h1">Люди</h1>
    <p class="lead">Полный профиль — с хронологией по годам, разговорами и вещами. Остальные пока короткой карточкой.</p>
    <div class="filters seg" role="group" aria-label="Фильтр">
      <button data-f="all" aria-pressed="true">Все</button><button data-f="full" aria-pressed="false">С хронологией</button>
    </div>
    <div id="groups"></div>
  </div>`;
  const box = root.querySelector('#groups');
  function paint(f){
    box.innerHTML = GROUPS.map(([g, label]) => {
      const list = PEOPLE.filter(p => p.g === g && (f === 'all' || p.profile));
      if (!list.length) return '';
      return '<div class="grp-h">' + label.toUpperCase() + '</div><div class="people">' + list.map(card).join('') + '</div>';
    }).join('') || '<p class="empty">Пока пусто.</p>';
  }
  root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
    root.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', x === b)); paint(b.dataset.f);
  });
  paint('all');
}
function card(p){
  const pl = p.place ? placeById(p.place) : null;
  const av = '<img class="av" src="' + IMG + (p.img || 'Лица/' + p.id + '.jpg') + '" alt="" data-initial="' + esc(p.name[0]) + '" onerror="kordimNoImg(this)">';
  return '<a class="pcard" href="#/person/' + p.id + '">' + av + '<div><b>' + esc(p.name) + (p.alias ? ' <span style="color:var(--mute)">' + esc(p.alias) + '</span>' : '') + '</b><small>' + esc(p.role) + (pl ? ' · ' + esc(pl.name) : '') + '</small>' +
    (p.profile ? '<span class="badge ok">хронология</span>' : '') + '</div></a>';
}
