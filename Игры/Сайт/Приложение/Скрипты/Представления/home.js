import { esc, MAP_IMG, personChip } from '../ui.js';
import { PEOPLE } from '../../Данные/people.js';
import { EVENTS } from '../../Данные/events.js';
import { CHARGED } from '../../Данные/questions.js';
import { SCENES } from '../../Данные/scenes.js';
import { PLAN } from '../../Данные/plan.js';
import { JOURNAL } from '../../Данные/journal.js';
import { progress } from './plan.js';

/* Главная — «куда дальше»: что поменялось, что ждёт автора, где мир молчит (РП §7.4, ИФ-17). */
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const day = iso => { const [, m, d] = iso.split('-').map(Number); return d + ' ' + MONTHS[m - 1]; };
const md = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
const clip = (s, n) => s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s;

function changes(){
  const entry = e => '<li><span class="hn-date">' + day(e.date) + '</span><b>' + md(e.title) + '</b><p>' + md(clip(e.text.replace(/^\([^)]*\)[:.]?\s*/, ''), 170)) + '</p></li>';
  const first = JOURNAL.slice(0, 4), rest = JOURNAL.slice(4, 14);
  return '<section class="card hn hn-new"><h3>ЧТО НОВОГО <small>журнал правок</small></h3><ul class="hn-list">' + first.map(entry).join('') + '</ul>' +
    (rest.length ? '<details class="hn-more"><summary>ещё ' + rest.length + '</summary><ul class="hn-list">' + rest.map(entry).join('') + '</ul></details>' : '') + '</section>';
}

function waiting(){
  const open = PLAN.decisions.filter(x => x.author && x.st !== 'done');
  const plan = progress();
  const item = x => '<li' + (x.st === 'part' ? ' class="part"' : '') + '>' + md(x.text) + '</li>';
  return '<section class="card hn hn-wait"><h3>ЖДЁТ АВТОРА <a href="#/plan">план ' + plan.total + '%</a></h3>' +
    '<p class="hn-count"><b>' + open.length + '</b> ' + (open.length % 10 === 1 && open.length % 100 !== 11 ? 'решение' : open.length % 10 >= 2 && open.length % 10 <= 4 && (open.length % 100 < 10 || open.length % 100 >= 20) ? 'решения' : 'решений') + ' за тобой; начатые — сверху</p>' +
    '<ul class="hn-list hn-todo">' + [...open.filter(x => x.st === 'part'), ...open.filter(x => x.st !== 'part')].slice(0, 5).map(item).join('') + '</ul>' +
    '<a class="hn-link" href="#/plan">все решения →</a></section>';
}

function silence(){
  const people = PEOPLE.filter(p => !p.frozen);
  const scened = new Set(SCENES.flatMap(s => s.events || [s.event]));
  const key = EVENTS.filter(e => e.key);
  const draft = SCENES.filter(s => s.status !== 'готово');
  const rows = [
    [people.filter(p => !p.profile).length, people.length, 'людей без полного профиля'],
    [people.filter(p => !p.img).length, people.length, 'без портрета'],
    [key.filter(e => !scened.has(e.slug)).length, key.length, 'ключевых событий без сцены'],
    [draft.length, SCENES.length, 'сцен ждут приёмки: ' + draft.map(s => s.title.split(' — ')[0]).join(', ')],
  ];
  return '<section class="card hn hn-quiet"><h3>ГДЕ МИР МОЛЧИТ <a href="#/questions">все</a></h3><ul class="hn-list">' +
    rows.map(([n, of, t]) => '<li><span class="hn-n">' + n + '<i>из ' + of + '</i></span><span>' + esc(t) + '</span></li>').join('') +
    '</ul><a class="hn-link" href="#/questions">куда расти →</a></section>';
}

export function render(root){
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
    <div class="home-next">${changes()}${waiting()}${silence()}</div>
    <div class="row2">
      <section class="card"><h3>ЗАРЯЖЕНО <a href="#/questions">все</a></h3><ul class="list">${CHARGED.slice(0,5).map(c => '<li><b>' + esc(c[0]) + '.</b> ' + esc(c[1]) + '</li>').join('')}</ul></section>
      <section class="card"><h3>ПОСЛЕДНЕЕ В ХРОНИКЕ <a href="#/chronicle">вся</a></h3><ul class="list">${EVENTS.filter(e => e.s >= 1024).slice(-5).map(e => '<li><b>' + esc(e.y) + '.</b> ' + esc(e.t) + '</li>').join('')}</ul></section>
    </div>
  </div>`;
}
