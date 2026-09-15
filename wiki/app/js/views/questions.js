import { esc, personChip } from '../ui.js';
import { CHARGED, OPEN } from '../../data/questions.js';

export function render(root){
  root.innerHTML = `<div class="page" data-title="Вопросы">
    <div class="eyebrow">работа над миром</div><h1 class="h1">Вопросы</h1>
    <p class="lead">Заряженное — крючки, которые уже лежат в сюжете. Открытое — то, что автор ещё не решил.</p>
    <div class="qgrid">
      <section class="card"><h3>ЗАРЯЖЕНО <small>${CHARGED.length}</small></h3>${CHARGED.map(([t, d, ppl]) => '<div class="q"><b>' + esc(t) + '</b><p>' + esc(d) + '</p><div style="margin-top:6px">' + ppl.map(personChip).join('') + '</div></div>').join('')}</section>
      <section class="card"><h3>ОТКРЫТО <small>${OPEN.length}</small></h3>${OPEN.map(([t, d]) => '<div class="q"><b>' + esc(t) + '</b><p>' + esc(d) + '</p></div>').join('')}</section>
    </div>
  </div>`;
}
