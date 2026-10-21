// Шаг 10: настоящие графы, поздние события, услуги и решения журнала.
import assert from 'node:assert/strict';
import { новоеСостояние } from '../Движок/состояние.js';
import { МЕСТА } from '../Данные/места.js';
import { войти, действияСцены, вернутьсяВГород, видСцены, выполнено } from '../Движок/разговор.js';
import * as диалог from '../Движок/диалог.js';
import { датьТему, СЛЫШАЛ, верностьТемы } from '../Движок/знание.js';
import { положить, естьВещь } from '../Движок/вещи.js';
import { нить, решитьЖурнал, обновитьНить, узнатьЖурнал, состояниеЖурнала, выводБренна, итогБренна } from '../Движок/нить-бренна.js';
import { ЗАПИСИ, узлыИУровень, собратьВывод } from '../Данные/нить-бренна.js';

const clone = S=>JSON.parse(JSON.stringify(S));
const click=(S,id)=>{const a=действияСцены(S).find(a=>a.id===id);assert.ok(a,'нет '+id);assert.ok(a.можно,a.почему);a.выполнить(S);};
function scene(place,room,who,day=3,begin='семья',setup=()=>{}) {
  const S=новоеСостояние(begin,1123),м=МЕСТА.find(m=>m.id===place);
  S.герой.кошель=500;S.герой.тело={сыт:3,отдых:3,тепло:3,цел:3};
  S.мир.день=day;S.мир.отрезок=м.модуль.ЛЮДИ[who]?.условие?.отрезок ?? (м.когда.includes('день')?'день':м.когда[0]);S.мир.район=м.район;
  setup(S);
  if(typeof м.модуль.ЛЮДИ[who]?.условие==='function') {
    let ok=false;
    for(const d of [day,...Array.from({length:30},(_,i)=>i+1)]){S.мир.день=d;const t=м.когда.find(t=>{S.мир.отрезок=t;return м.модуль.ЛЮДИ[who].условие(S);});if(t){S.мир.отрезок=t;ok=true;break;}}
    assert.ok(ok,'нет времени встречи '+who);
  }
  войти(S,place);assert.ok(S.сцена,place);S.сцена.вошёл=true;S.сцена.комната=room;S.сцена.диалог=null;S.сцена.собеседник=null;
  S.мир.места[place].визитов=2;
  if(who){click(S,'заговорить:'+who);if(S.сцена.диалог?.ветка==='вход'){const a=действияСцены(S).find(a=>!a.закреплён);assert.ok(a);a.выполнить(S);}}
  return S;
}
function baseFor(m,id) {const room=Object.entries(m.модуль.КОМНАТЫ).find(([,r])=>r.люди.includes(id))[0];return scene(m.id,room,id);}
const manifest=МЕСТА.flatMap(m=>Object.keys(m.модуль.ЛЮДИ).map(id=>({m,id,g:m.модуль.ДИАЛОГИ?.[id]}))).filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i);
for(const {id,g} of manifest)assert.ok(g,'нет графа '+id);
assert.ok(manifest.length>=39);
let nodes=0,choices=0;
for(const {m,id,g} of manifest) {
  if(id==='sib')continue; // пилот имеет собственный полный тест.
  for(const [bk,b]of Object.entries(g.ветки)) {
    assert.ok(b.узлы.старт,id+'/'+bk);
    for(const [uk,u]of Object.entries(b.узлы)) {
      nodes++;assert.ok(u.варианты.length,id+'/'+bk+'/'+uk+' тупик');
      const ids=new Set();
      for(const a of u.варианты) {
        choices++;assert.ok(!ids.has(a.ид),id+'/'+bk+' повтор id '+a.ид);ids.add(a.ид);
        assert.ok(!Array.isArray(a.эффект),'массив эффекта выбора');
        for(const d of [a.дальше,a.успех?.дальше,a.провал?.дальше].filter(Boolean)) {
          if(typeof d==='object')assert.ok(g.ветки[d.ветка],id+' → '+d.ветка);
          else assert.ok(['хаб','назад','закрыть'].includes(d)||b.узлы[d],id+'/'+bk+' → '+d);
        }
      }
    }
  }
  // Первая и повторная встреча, уход и сезонная сцена через интерфейс.
  for(const day of [3,27]) {
    const S=baseFor(m,id);S.сцена.вход.день=day;S.мир.день=day;
    assert.ok(видСцены(S).диалог);
    const a=действияСцены(S).find(a=>a.id==='отойти');assert.ok(a);a.выполнить(S);
    if(!выполнено(S,m.модуль.ЛЮДИ[id].условие)){assert.ok(!действияСцены(S).some(a=>a.id==='заговорить:'+id));continue;}
    click(S,'заговорить:'+id);
    assert.ok(S.мир.люди[id].знаком);
  }
}
console.log('Графы: '+manifest.length+' жителей, '+nodes+' узлов, '+choices+' вариантов; все переходы определены.');

// Первая беседа не поглощает событие: в том же визите и после сериализации/нового визита.
for(const [place,room,id,key,kind,value]of [
 ['двор-горма','ворота-горма','branka','событие_спасибо','флаг','помог_бранке'],
 ['двор-горма','ворота-горма','branka','событие_дни','тема','gorm_chetnye'],
 ['двор-горма','ворота-горма','branka','событие_слёг','тема','lozh_gorm'],
 ['двор-горма','ворота-горма','nim','событие_горм','тема','lozh_gorm'],
 ['лекарь','очередь-лекаря','mila','событие_спасибо','флаг','помог_миле'],
 ['лекарь','очередь-лекаря','mila','событие_ночью','тема','seraya_radost'],
])for(const next of [false,true]) {
  let S=scene(place,room,id);const g=МЕСТА.find(m=>m.id===place).модуль.ДИАЛОГИ[id];
  assert.ok(!действияСцены(S).some(a=>a.id==='ветка:'+key));
  for(const k of g.хаб.filter(k=>!k.startsWith('событие_')))S.мир.диалоги[id].ветки[k]={исход:'пройдена',входов:1,награды:{}};
  if(kind==='флаг')S.мир.места[place].флаги.push(value);else датьТему(S,value,СЛЫШАЛ,place);
  if(next){S=clone(S);диалог.закрыть(S);вернутьсяВГород(S);S.мир.день++;S.мир.отрезок='утро';войти(S,place);S.сцена.комната=room;click(S,'заговорить:'+id);}
  assert.ok(действияСцены(S).some(a=>a.id==='ветка:'+key),id+' '+key);
  click(S,'ветка:'+key);
  let guard=0;while(S.сцена.диалог.режим==='ветка'&&guard++<8){const a=действияСцены(S).find(a=>a.вид==='вариант'&&a.можно);assert.ok(a);a.выполнить(S);}
  if(id==='branka'&&value==='lozh_gorm')assert.equal(верностьТемы(S,value),'опровергнуто');
}
console.log('Поздние события: 12 последовательностей прошли.');

// Услуги, дела и подарки сохраняются в хабе графа.
{
 const S=scene('аптека','lavka','sibilla');assert.ok(действияСцены(S).some(a=>a.id==='обмен'));
}
{
 const S=scene('синий-час','komnata_nii','niya');assert.ok(действияСцены(S).some(a=>a.id==='остаться'));
}
// Песня не закрыта навсегда и не кормит/не платит при одном приветствии.
{
 const S=scene('таверна','zal','nora');S.мир.люди.nora.распол=1;
 click(S,'ветка:песня');click(S,'вариант:песня:ждать');click(S,'вариант:песня:ясно');
 assert.ok(!действияСцены(S).some(a=>a.id==='ветка:песня'));
 вернутьсяВГород(S);S.мир.отрезок='вечер';войти(S,'таверна');click(S,'заговорить:nora');click(S,'вариант:вход:подойти');
 assert.ok(действияСцены(S).some(a=>a.id==='ветка:песня'));
}
// Все три начала: старшая не приписывает работу в конторе.
for(const begin of ['семья','бумаги','наколки']){
 const S=scene('синий-час','zal','starshaya',3,begin);
 click(S,'ветка:знакомство');assert.ok(!видСцены(S).диалог.лента.some(l=>/Ты снизу, из конторы/.test(l.т)));
}

// Все пять решений через настоящий выбор, повтор и сохранение; время знания и награда ровно один раз.
for(const [state,place,room,id]of [
 ['возвращён','контора-дорров','весовая-дорров','весовщик'],
 ['у_дорра','контора-дорров','кабинет-дорров','rest_dorr'],
 ['продан','рынок','слухи-рынка','notarius'],
 ['сожжён','часовня','неф-часовни','una'],
 ['оставлен','часовня','неф-часовни','una']
]) {
 const sale=state==='продан'&&МЕСТА.find(м=>м.id==='приемная-нотариуса');
 let S=scene(sale?sale.id:place,sale?Object.entries(sale.модуль.КОМНАТЫ).find(([,r])=>r.люди.includes(id))[0]:room,id,3);S.мир.свидетельства.push('brenn_second_journal');положить(S,'второй-журнал');
 const cash=S.герой.кошель;
 click(S,'ветка:решение_'+state);assert.ok(естьВещь(S,'второй-журнал'),'до согласия книга у героя');
 click(S,'вариант:решение_'+state+':решить');
 assert.equal(состояниеЖурнала(S),state);assert.equal(естьВещь(S,'второй-журнал'),state==='оставлен');
 assert.equal(S.герой.кошель-cash,state==='продан'?100:state==='у_дорра'?60:0);
 assert.equal(решитьЖурнал(S,state),false,'повтор без награды');
 assert.ok(!нить(S).знают.bras,'Брас не знает сразу');
 if(state==='сожжён') {обновитьНить(S,30);assert.ok(!нить(S).знают.bras);узнатьЖурнал(S,'bras');assert.equal(S.мир.люди.bras.распол,1);узнатьЖурнал(S,'bras');assert.equal(S.мир.люди.bras.распол,1);}
 if(state==='продан'||state==='у_дорра') {узнатьЖурнал(S,'bras');const p=S.мир.люди.bras.распол;обновитьНить(S,10);assert.equal(S.мир.люди.bras.распол,p,'слух не повторяет личный эффект');}
 S=clone(S);assert.equal(состояниеЖурнала(S),state);assert.ok(итогБренна(S));
 const ids=new Set(ЗАПИСИ.map(з=>з.id));S.мир.свидетельства=[...ids];const out=выводБренна(S).текст;
 assert.ok(!out.includes('решать мне'),'после решения нет нерешённого журнала');
}
{
 const S=scene('часовня','неф-часовни','una');assert.equal(итогБренна(S),'Книга осталась у Уны.');
}
let enough=0,variants=0;
for(let mask=0;mask<(1<<ЗАПИСИ.length);mask++){
 const ids=new Set(ЗАПИСИ.filter((_,i)=>mask&(1<<i)).map(z=>z.id));const {уровень}=узлыИУровень(ids);
 if(!['понимание','полная'].includes(уровень))continue;enough++;
 const states=ids.has('brenn_second_journal')?['получен','оставлен','возвращён','у_дорра','продан','сожжён']:['не_выдан'];
 for(const state of states){const t=собратьВывод(уровень,ids,state);variants++;if(!ids.has('brenn_office_entry'))assert.ok(!t.includes('печатью'));if(state!=='получен')assert.ok(!t.includes('решать мне'));}
}
assert.equal(enough,7116);assert.equal(variants,25536);
console.log('Журнал: 5 решений, сроки, сохранение и одноразовость; вывод: 16 384 набора / 25 536 вариантов — OK.');

// Каждый доступный переход проходит через настоящий обработчик; fixtures задают входные знания,
// а BFS разветвляет сохранение по вариантам, не меняя граф и не перепрыгивая через узлы.
function условия(S, у, id) {
 if(!у||typeof у==='function')return;
 const п=S.мир.диалоги[id]??={факты:[],ветки:{}};
 if(у.факт&&!п.факты.includes(у.факт))п.факты.push(у.факт);
 if(у.нетФакта)п.факты=п.факты.filter(x=>x!==у.нетФакта);
 if(у.флаг&&!S.мир.места[S.сцена.место].флаги.includes(у.флаг))S.мир.места[S.сцена.место].флаги.push(у.флаг);
 if(у.нетФлага)S.мир.места[S.сцена.место].флаги=S.мир.места[S.сцена.место].флаги.filter(x=>x!==у.нетФлага);
 for(const k of ['сыт','отдых','тепло','цел'])if(у[k])S.герой.тело[k]=у[k][0];
 if(у.доверие!==undefined)S.мир.люди[id].распол=у.доверие;
 if(у.доверияДо!==undefined)S.мир.люди[id].распол=у.доверияДо-1;
 if(у.начало)S.герой.начало=[].concat(у.начало)[0];
 if(у.любое)условия(S,у.любое[0],id);
 if(у.тема)датьТему(S,у.тема,СЛЫШАЛ);
 if(у.чужойФакт){const п=S.мир.диалоги[у.чужойФакт.кто]??={факты:[],ветки:{}};if(!п.факты.includes(у.чужойФакт.факт))п.факты.push(у.чужойФакт.факт);}
}
let исполнено=0;
for(const {m,id,g}of manifest){
 if(id==='sib')continue;
 for(const [bk,b]of Object.entries(g.ветки)){
  if(bk.startsWith('решение_')||bk.startsWith('реакция_')||bk.startsWith('рассказать_'))continue;
  const S=baseFor(m,id);S.сцена.ходы=0;S.сцена.флагиВечера.push('придвинулся');
  S.мир.люди[id].распол=4;S.герой.начало='наколки';S.герой.напряжение=3;
  S.мир.голоса.открыты=['ОТЕЦ','ДЫМ'];S.мир.темы=[...new Set([...S.мир.темы,...Object.values(g.ветки).map(b=>b.если?.тема).filter(Boolean)])];
  условия(S,b.если,id);if(bk==='показать_журнал'){положить(S,'второй-журнал');S.мир.свидетельства.push('brenn_second_journal');}
  assert.ok(диалог.войтиВВетку(S,id,bk),id+'/'+bk);
  const q=[S],seen=new Set();let guard=0;
  while(q.length){assert.ok(guard++<1000,'слишком много состояний '+id+'/'+bk);const current=q.shift();
   if(!current.сцена||current.сцена.диалог?.режим!=='ветка')continue;
   const d=current.сцена.диалог,branch=g.ветки[d.ветка];assert.ok(branch,id+' '+d.ветка);
   const u=branch.узлы[d.узел];const state=d.ветка+'/'+d.узел+':'+JSON.stringify(current.мир.диалоги[id]?.факты??[]);
   if(seen.has(state))continue;seen.add(state);
   for(const a of u.варианты){
    const copy=clone(current);условия(copy,a.если,id);
    const button=действияСцены(copy).find(x=>x.id==='вариант:'+d.ветка+':'+a.ид&&x.можно);
    if(!button)continue;const before=copy.герой.кошель;button.выполнить(copy);исполнено++;
    assert.ok(copy.герой.кошель>=0,'отрицательная оплата '+state);assert.ok(copy.герой.кошель<=before||a.эффект?.решениеЖурнала,'внезапный доход '+state);
    for(const v of Object.values(copy.герой.тело))assert.ok(v>=0&&v<=3,'тело за пределом');
    q.push(copy);
   }
  }
 }
}
assert.ok(исполнено>1000);
console.log('Графовые маршруты: исполнено '+исполнено+' переходов на разветвлённых сохранениях.');

// Финальный состав подключён, а не просто описан в файле.
for(const id of ['svanna','betta','mira','tali','ren','fila','liv','kim','cleaner','servant','leya','tava','marna']) {
 const item=manifest.find(x=>x.id===id);assert.ok(item,'не подключён '+id);
 const S=baseFor(item.m,id);const g=item.g;
 const key=g.хаб.find(k=>g.ветки[k].узлы.старт.варианты.some(a=>['помочь'].includes(a.ид)));
 if(key){click(S,'ветка:'+key);click(S,'вариант:'+key+':помочь');
 assert.ok(S.мир.диалоги[id].факты.includes('помощь'));
 click(S,'вариант:'+key+':всё');assert.ok(действияСцены(S).some(a=>['ветка:повтор','ветка:встреча'].includes(a.id)));}
}
assert.ok(!manifest.some(x=>x.id==='marna_dorr'),'двойная память Марны');
assert.equal(МЕСТА.filter(m=>m.модуль.ЛЮДИ.marna).length,2);
for(const d of [3,9,22]){const S=новоеСостояние('семья',1);S.мир.день=d;S.мир.отрезок='день';const present=МЕСТА.filter(m=>m.модуль.ЛЮДИ.marna&&выполнено(S,m.модуль.ЛЮДИ.marna.условие));assert.equal(present.length,1,'Марна одновременно в двух местах');assert.equal(present[0].id,[9,22].includes(d)?'ремесленный-двор':'причал-грузчиков');}
// Совет использует общую память людей, но не описание их рынка/конторы/двора.
for(const id of ['tobb','veyt','branka']) {
 const S=scene('дом-управы','зал-совета',id,19);
 const g=МЕСТА.find(m=>m.id==='дом-управы').модуль.ДИАЛОГИ[id];
 assert.ok(g.хаб.includes('совет'));assert.ok(!g.хаб.includes('вход'));
 assert.ok(S.мир.диалоги[id]);assert.ok(видСцены(S).диалог);
 click(S,'ветка:совет');assert.ok(видСцены(S).диалог.лента.length);
}
for(const outcome of ['одна','с-одвином']){
 const S=scene('дом-вдовы','двор-соседей','freya',23,'семья',s=>{s.мир.вытащить={решение:{исход:outcome}};});
 click(S,'ветка:вместе');const text=видСцены(S).диалог.лента.map(l=>l.т).join(' ');
 assert.match(text,outcome==='одна'?/жить отдельно/:/жить вместе/);
 click(S,'вариант:вместе:спросить');assert.ok(S.мир.диалоги.freya.факты.includes('фрея_спросили_дома'));
}
console.log('Состав, память поступка, контексты Совета и два исхода переезда — OK.');

// Структурная достижимость узлов каждой ветки и предел одного текстового блока.
for(const {id,g}of manifest)for(const [key,b]of Object.entries(g.ветки)){
 const reachable=new Set(['старт']),queue=['старт'];
 while(queue.length){const u=b.узлы[queue.shift()];for(const a of u.варианты??[])for(const next of [a.дальше,a.успех?.дальше,a.провал?.дальше])if(typeof next==='string'&&b.узлы[next]&&!reachable.has(next)){reachable.add(next);queue.push(next);}}
 for(const [k,u]of Object.entries(b.узлы)){
 assert.ok(reachable.has(k),id+'/'+key+'/'+k+' недостижим');
 for(const line of Array.isArray(u.текст)?u.текст:[])if(typeof line==='string')assert.ok(line.length<=1800,id+'/'+key+'/'+k+' слишком длинный блок');
 }
}
console.log('Линтер: локальная достижимость и длина блоков — OK.');
