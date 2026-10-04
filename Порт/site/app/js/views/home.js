import { esc, IMG, MAP_IMG, personChip } from '../ui.js';
import { PEOPLE } from '../../data/people.js';
import { PLACES } from '../../data/places.js';
import { FACTIONS } from '../../data/factions.js';
import { EVENTS } from '../../data/events.js';
import { ARTICLES } from '../../data/articles.js';
import { CHARGED, OPEN } from '../../data/questions.js';

export function render(root){
  const profiles = PEOPLE.filter(p => p.profile).length;
  root.innerHTML = `<div class="page" data-title="Главная">
    <div class="home-hero">
      <div>
        <div class="eyebrow">ранняя осень 1026</div>
        <h1 class="h1">Кордим</h1>
        <p class="lead">Единственная страна между Свинцовым морем и Хребтом Мясника. Сорок лет после мора: людей мало, работы много, всё делается руками и потому дорого. Магии нет — сталь, физика, алхимия, труд и расчёт.</p>
        <div>${['grace','nikto','elowen','arn'].map(personChip).join('')}</div>
      </div>
      <a class="home-map" href="#/map" aria-label="Открыть карту"><img src="${MAP_IMG}" alt=""></a>
    </div>
    <div class="tiles">
      <a class="tile" href="#/people"><span class="n">${PEOPLE.length}</span><b>Люди</b><span>Полных профилей с хронологией: ${profiles}</span></a>
      <a class="tile" href="#/places"><span class="n">${PLACES.length}</span><b>Места</b><span>Города, лес, берега и тайные базы</span></a>
      <a class="tile" href="#/factions"><span class="n">${FACTIONS.length}</span><b>Фракции</b><span>Кто кого держит и чем ручается</span></a>
      <a class="tile" href="#/map"><span class="n">8</span><b>Карта</b><span>Тракты, сезоны, «в путь»</span></a>
      <a class="tile" href="#/chronicle"><span class="n">${EVENTS.length}</span><b>Хроника</b><span>От первой волны Чумы до настоящего</span></a>
      <a class="tile" href="#/world"><span class="n">${ARTICLES.length}</span><b>Мир</b><span>Деньги, контора, алхимия, закон, быт</span></a>
      <a class="tile" href="#/questions"><span class="n">${CHARGED.length + OPEN.length}</span><b>Вопросы</b><span>Заряженное и нерешённое</span></a>
      <a class="tile" href="#/game"><span class="n">▶</span><b>Игра</b><span>Текстовая RPG по миру</span></a>
    </div>
    <div class="row2">
      <section class="card"><h3>ЗАРЯЖЕНО <a href="#/questions">все</a></h3><ul class="list">${CHARGED.slice(0,5).map(c => '<li><b>' + esc(c[0]) + '.</b> ' + esc(c[1]) + '</li>').join('')}</ul></section>
      <section class="card"><h3>ПОСЛЕДНЕЕ В ХРОНИКЕ <a href="#/chronicle">вся</a></h3><ul class="list">${EVENTS.filter(e => e.s >= 1024).slice(-5).map(e => '<li><b>' + esc(e.y) + '.</b> ' + esc(e.t) + '</li>').join('')}</ul></section>
    </div>
  </div>`;
}
