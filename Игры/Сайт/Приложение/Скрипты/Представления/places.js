import { esc, IMG } from '../ui.js';
import { PLACES } from '../../Данные/places.js';

export function render(root){
  root.innerHTML = `<div class="page" data-title="Места">
    <div class="eyebrow">география</div><h1 class="h1">Места</h1>
    <p class="lead">Города, лес, берега и то, чего нет на официальных картах. Подробные карты мест появятся здесь по мере готовности.</p>
    <div class="places">${PLACES.map(p => `<a class="plcard" href="#/place/${p.id}">
      <div class="im" style="${p.img ? "background-image:url('" + IMG + p.img + "')" : ''}"></div>
      <div class="tx"><b>${esc(p.name)}</b><small>${esc(p.kind)} · ${esc(p.pop)}</small><p>${esc(p.lead)}</p></div></a>`).join('')}</div>
  </div>`;
}
