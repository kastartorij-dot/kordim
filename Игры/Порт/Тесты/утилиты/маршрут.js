// Известный маршрут через те же действия, что рисуют игровые экраны.
// Никаких правок кошеля, тела, даты, отношений или стадий цели.
import assert from 'node:assert/strict';
import { новоеСостояние, сохранить, загрузить } from '../../Движок/состояние.js';
import { доступныеДействия } from '../../Движок/действия.js';
import { действияСцены, вернутьсяВГород } from '../../Движок/разговор.js';
import { действияЦелей } from '../../Движок/цели.js';
import { действияХозяйства } from '../../Движок/хозяйство.js';
import { МЕСТА } from '../../Данные/места.js';
import { работа } from '../../Данные/работы.js';
import { условияПлаты, допОтдых } from '../../Движок/смена.js';

const СЛОТЫ = ['утро', 'день', 'вечер', 'ночь'];
const момент = S => `${S.мир.день}/${S.мир.отрезок}/${S.мир.район}${S.сцена ? '/'+S.сцена.место+'/'+S.сцена.комната : ''}`;

export class Маршрут {
  constructor(начало, цель, зерно = 11) {
    this.S = новоеСостояние(начало, зерно);
    this.начало = начало; this.цель = цель; this.зерно = зерно;
    this.шаги = []; this.итоги = []; this.заметки = []; this.память = new Map();
    this.checkpoint();
  }
  note(текст) { this.заметки.push({ момент: момент(this.S), текст }); }
  checkpoint() {
    globalThis.localStorage = {
      getItem: k => this.память.get(k) ?? null,
      setItem: (k,v) => this.память.set(k,String(v)),
      removeItem: k => this.память.delete(k),
    };
    const до = JSON.stringify(this.S);
    сохранить(this.S, 'авто');
    this.S = загрузить('авто');
    assert.ok(this.S, 'партия загружается: '+this.начало+'/'+this.цель);
    assert.equal(JSON.stringify(this.S), до, 'загрузка не меняет действующую партию');
  }
  click(a, { panel = false } = {}) {
    assert.ok(a?.можно, `недоступно ${a?.id}: ${a?.почему}; ${момент(this.S)}`);
    assert.ok(this.шаги.length < 2500, 'маршрут не зациклился');
    const до = { момент: момент(this.S), кошель: this.S.герой.кошель };
    const номер = this.S.мир.шаг ?? 0;
    const результат = a.выполнить(this.S);
    // Панель вещей/журнала увеличивает шаг сама после успешной операции.
    // Городские и сценические действия уже делают это внутри своего контроллера.
    if (panel) {
      assert.ok(результат, 'операция панели выполнена: '+a.id);
      this.S.мир.шаг = номер + 1;
    }
    this.шаги.push({ n:this.шаги.length+1, ...до, id:a.id, текст:a.текст, после:момент(this.S), кошельПосле:this.S.герой.кошель });
    assert.ok(Number.isFinite(this.S.герой.кошель) && this.S.герой.кошель >= 0, 'кошель законен');
    for (const v of Object.values(this.S.герой.тело)) assert.ok(Number.isInteger(v) && v>=0 && v<=3);
    this.checkpoint();
  }
  city(id) {
    assert.equal(this.S.сцена, null, 'городская кнопка только вне сцены');
    assert.equal(this.S.мир.конецДня, null, 'сначала закрыть итог дня');
    const a = доступныеДействия(this.S).find(a => a.id===id);
    assert.ok(a, `нет городской кнопки ${id}; ${момент(this.S)}`);
    this.click(a);
  }
  service(id) { this.city('услуга:'+id); }
  scene(поиск) {
    assert.ok(this.S.сцена, 'нужна сцена: '+поиск);
    const A = действияСцены(this.S);
    const a = A.find(a => поиск instanceof RegExp ? поиск.test(a.текст) && a.можно : a.id===поиск);
    assert.ok(a, `нет кнопки ${поиск}; ${момент(this.S)}; есть: ${A.map(a=>a.id+'='+a.текст+(a.можно?'':' [нет:'+a.почему+']')).join(' | ')}`);
    this.click(a);
  }
  goal(id) {
    this.leave(); this.dismiss();
    const a = действияЦелей(this.S).find(a=>a.id===`цель:выбрать:${id}`);
    assert.ok(a, 'есть выбор цели '+id+'; '+момент(this.S)); this.click(a, { panel: true });
  }
  dismiss() {
    if (!this.S.мир.конецДня) return;
    if (this.S.мир.конецДня.финал) return; // Приёмка останавливается на настоящем экране финала.
    assert.ok(!this.S.мир.конецДня.отъезд, 'нельзя продолжить после отъезда');
    this.итоги.push(structuredClone(this.S.мир.конецДня));
    this.шаги.push({ n:this.шаги.length+1, момент:момент(this.S), id:'экран:начать-день', текст:'Начать день', после:момент(this.S), кошельПосле:this.S.герой.кошель });
    // Та же операция, что обработчик «Начать день» в рендерКонецДня.
    this.S.мир.конецДня = null; this.checkpoint();
  }
  leave() {
    for (let i=0; this.S.сцена && i<30; i++) {
      if (this.S.сцена.итог) {
        const до = момент(this.S);
        // Эта кнопка существует только поверх настоящего итога места.
        вернутьсяВГород(this.S);
        this.шаги.push({ n:this.шаги.length+1, момент:до, id:'экран:в-город', текст:'В город', после:момент(this.S), кошельПосле:this.S.герой.кошель });
        assert.equal(this.S.сцена, null, 'выход из итога места разрешён');
        this.checkpoint();
        break;
      }
      if (this.S.сцена.собеседник) { this.leaveTalk(); continue; }
      const A = действияСцены(this.S);
      const выход = A.find(a=>a.вид==='финал' && a.можно);
      if (выход) { this.click(выход); continue; }
      // Из комнат «Синего часа» выходят через крыльцо и Сиба.
      // В прочих местах выход расположен в стартовой комнате.
      const модуль = МЕСТА.find(m=>m.id===this.S.сцена.место)?.модуль;
      const дверь = this.S.сцена.место==='синий-час' ? 'krylco' : модуль?.старт;
      assert.ok(дверь && this.S.сцена.комната!==дверь, 'нет доступного выхода: '+момент(this.S));
      this.room(дверь);
    }
    assert.equal(this.S.сцена, null, 'место закрыто через доступные кнопки');
  }
  leaveTalk() {
    for (let i=0; this.S.сцена?.собеседник && !this.S.сцена.итог && i<15; i++) {
      const A = действияСцены(this.S).filter(a=>a.можно);
      const a = A.find(a=>a.id==='отойти') ?? A.find(a=>a.вид==='вариант' && a.закреплён) ?? A.find(a=>/Вернуться|Назад|Отойти/.test(a.текст));
      assert.ok(a, 'есть выход из разговора'); this.click(a);
    }
    assert.ok(!this.S.сцена?.собеседник || this.S.сцена.итог, 'разговор закрыт или завершён итогом');
  }
  talk(npc) {
    if (this.S.сцена?.собеседник===npc && this.S.сцена?.диалог?.режим==='хаб') return;
    this.leaveTalk(); this.scene('заговорить:'+npc);
    for(let i=0; this.S.сцена?.диалог?.режим==='ветка' && i<12; i++) {
      const A=действияСцены(this.S).filter(a=>a.вид==='вариант' && a.можно);
      const a=A.find(a=>!a.закреплён) ?? A[0]; assert.ok(a,'приветствие имеет продолжение'); this.click(a);
    }
    assert.equal(this.S.сцена?.диалог?.режим,'хаб','открыт хаб '+npc);
  }
  room(цель) {
    this.leaveTalk();
    for(let попытка=0; this.S.сцена?.комната!==цель && попытка<12; попытка++) {
      const модуль=МЕСТА.find(m=>m.id===this.S.сцена?.место)?.модуль;
      assert.ok(модуль?.КОМНАТЫ[цель], 'комната существует '+цель);
      const очередь=[[this.S.сцена.комната,[]]], видели=new Set(); let путь;
      while(очередь.length) {
        const [комната,шаги]=очередь.shift();
        if(комната===цель){путь=шаги;break;}
        if(видели.has(комната))continue;видели.add(комната);
        for(const сосед of модуль.КОМНАТЫ[комната].соседи??[])очередь.push([сосед,[...шаги,сосед]]);
      }
      assert.ok(путь?.length,'есть путь к '+цель);
      this.scene('пойти:'+путь[0]);
    }
    assert.equal(this.S.сцена?.комната,цель,'дошли до комнаты '+цель);
  }
  feed() {
    if(this.S.сцена || this.S.мир.конецДня || this.S.мир.смена)return;
    for(let i=0;i<5;i++) {
      const т=this.S.герой.тело;
      const A=доступныеДействия(this.S).filter(a=>a.можно&&a.вид==='еда');
      const е=(т.тепло<2 ? A.find(a=>a.id==='еда:похлёбка') : null)
        ?? (т.сыт<3 ? A.filter(a=>a.цена>0).sort((a,b)=>a.цена-b.цена)[0] : null);
      if(!е)break;this.click(е);
    }
    const вода=доступныеДействия(this.S).find(a=>a.id==='вода:пить'&&a.можно);if(вода)this.click(вода);
  }
  shift() {
    for(let i=0;this.S.мир.смена&&i<12;i++) {
      const A=доступныеДействия(this.S).filter(a=>a.можно);
      // Выбор по видимой цене: не платить за случайную рабочую историю.
      const a=A.find(a=>a.id==='смена:дальше')??A.find(a=>!a.подпись?.match(/\d+ гр/))??A[0];
      assert.ok(a,'есть продолжение смены');this.click(a);
    }
    assert.ok(!this.S.мир.смена,'смена закрылась');
  }
  workHere() {
    this.feed();
    const A=доступныеДействия(this.S);
    const порядок=this.начало==='наколки'?['наколки','весы','разгрузка','разноска','сети-берега','подсобка-двора','баня']:['весы','разгрузка','разноска','сети-берега','подсобка-двора','чтец','баня'];
    for(const id of порядок) {
      const a=A.find(a=>a.id==='работа:'+id&&a.можно);if(!a)continue;
      const р=работа(id),садится=условияПлаты(this.S,р).садится;
      if(садится || this.S.герой.тело.отдых-(р.цена?.отдых??0)-допОтдых(this.S,р)<1)continue;
      this.click(a);this.shift();return true;
    }
    return false;
  }
  wait() { this.feed(); this.city('отрезок:здесь'); }
  travel(район) {
    this.leave(); this.dismiss(); if(this.S.мир.район===район)return;
    this.feed(); this.city('переход:'+район); this.dismiss(); this.feed();this.gear();
  }
  gear() {
    if(this.S.сцена||this.S.мир.конецДня||this.S.мир.смена||this.S.герой.одежда?.верх)return;
    const a=доступныеДействия(this.S).find(a=>a.id==='купить:плащ'&&a.можно);
    if(!a||this.S.герой.кошель<25)return;
    this.click(a);
    const x=this.S.герой.при_себе.find(x=>x.тип==='плащ');
    const надеть=действияХозяйства(this.S).find(a=>a.id==='надеть:'+x.uid);
    this.click(надеть, { panel: true });
  }
  sleep() {
    this.leave();this.dismiss();this.feed();
    const A=доступныеДействия(this.S);
    const сон=A.find(a=>a.id==='сон:угол'&&a.можно)??A.find(a=>a.id==='сон:вдова'&&a.можно)??A.find(a=>a.id==='сон:койка'&&a.можно);
    if(сон){this.click(сон);this.dismiss();return;}
    // В городе всегда есть реальный путь к крыше. Ночной переход может стоить
    // бессонной ночи: его последствия сохраняются, а не исправляются фикстурой.
    if(this.S.мир.район!=='доки'){this.travel('доки');return;}
    const дешевле=A.filter(a=>a.вид==='сон'&&a.можно).sort((a,b)=>a.цена-b.цена)[0];
    assert.ok(дешевле,'доступен ночлег');this.click(дешевле);this.dismiss();
  }
  daily() {
    this.leave();this.dismiss();this.feed();
    if(this.S.мир.отрезок==='ночь' || (this.S.мир.отрезок==='вечер'&&this.S.герой.тело.отдых===0)){this.sleep();return;}
    if(this.workHere())return;
    const о=this.S.мир.отрезок,р=this.S.мир.район;
    if(о==='утро'&&р==='доки'){this.travel('трущобы');return;}
    if(о==='утро'&&р!=='доки'){this.travel('доки');return;}
    if(о==='день'&&р==='доки'&&!this.S.герой.одежда?.верх){this.travel('торговый');return;}
    if(о==='вечер'&&р!=='доки'){this.travel('доки');return;}
    this.wait();
  }
  until(день) {
    this.leave();this.dismiss();
    if(this.S.мир.день>=день)return;
    for(let i=0;this.S.мир.день<день&&i<800;i++)this.daily();
    assert.equal(this.S.мир.день,день,'не пропущен намеченный день '+день);
  }
  slot(отрезок) {
    this.leave();this.dismiss();
    if(СЛОТЫ.indexOf(this.S.мир.отрезок)>СЛОТЫ.indexOf(отрезок))this.until(this.S.мир.день+1);
    for(let i=0;this.S.мир.отрезок!==отрезок&&i<12;i++){this.feed();this.wait();this.dismiss();}
    assert.equal(this.S.мир.отрезок,отрезок);
  }
  earn(сумма,{byDay=30}={}) {
    this.leave();this.dismiss();
    for(let i=0;this.S.герой.кошель<сумма&&i<1000;i++) {
      assert.ok(this.S.мир.день<=byDay,`не заработано ${сумма} к дню ${byDay}: ${момент(this.S)}, ${this.S.герой.кошель}гр.`);
      this.daily();
    }
    assert.ok(this.S.герой.кошель>=сумма, 'сумма заработана');
  }
  visit(id,{room,npc,at}={}) {
    this.leave();this.dismiss();
    const м=МЕСТА.find(m=>m.id===id);assert.ok(м,'место существует '+id);
    this.travel(м.район);if(at)this.slot(at);
    for(let i=0;i<15;i++) {
      if(this.S.мир.район!==м.район)this.travel(м.район);
      this.feed();const a=доступныеДействия(this.S).find(a=>a.id==='место:'+id);
      if(a?.можно){this.click(a);break;}
      if(this.S.мир.отрезок==='ночь')this.sleep();else this.wait();
      this.dismiss();
    }
    assert.equal(this.S.сцена?.место,id,'вошли в '+id);
    if(id==='синий-час'){
      const A=действияСцены(this.S);
      if(A.some(a=>a.id==='вариант:вход:платить'&&a.можно))this.scene('вариант:вход:платить');
      if(действияСцены(this.S).some(a=>a.id==='вариант:вход:войти'&&a.можно))this.scene('вариант:вход:войти');
    }
    if(room)this.room(room);if(npc)this.talk(npc);
  }
  finish() {
    this.leave();this.dismiss();
    for(let i=0;!this.S.мир.итогСезона&&i<1000;i++)this.daily();
    assert.ok(this.S.мир.итогСезона,'получен финал сезона');
    assert.ok(this.S.герой.тело.цел>0,'герой дошёл до финала живым');
    this.checkpoint();
    return this.S.мир.итогСезона;
  }
}
