import { esc } from '../ui.js';
import { FACTIONS } from '../../Данные/factions.js';
import { personById } from '../../Данные/people.js';
import { icon } from '../icons.js';

export function render(root){
  root.innerHTML = `<div class="page" data-title="Фракции">
    <div class="eyebrow">силы</div><h1 class="h1">Фракции</h1>
    <p class="lead">Поручительство стоит ровно того, чем ручается держатель: синдикат — страхом, Коллегия — клеймом, Орден — уставом, Кесс — лесом, Сайден — собственным карманом.</p>
    <div class="facs">${FACTIONS.map(f => `<a class="card fac" href="#/faction/${f.id}" style="--fc:${f.color}">
      <div class="fhead">${icon(f.icon, 30)}<div><b>${esc(f.name)}</b><div class="kind">${esc(f.kind)}</div></div></div>
      <p>${esc(f.text[0])}</p>
      <div class="who">${[...f.head.map(id => (personById(id) || {}).name).filter(Boolean), f.size].filter(Boolean).map(esc).join(' · ')}</div>
    </a>`).join('')}</div>
  </div>`;
}
