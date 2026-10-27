// Реальные пропуски сроков, отказ и завершение сезона из сцены/смены.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { НАЧАЛА } from '../Данные/герой.js';
import { действияЦелей, сводкаЦели } from '../Движок/цели.js';
import { следующийШагУехать } from '../Движок/уехать.js';
import { Маршрут } from './утилиты/маршрут.js';
import { пройтиИмя } from './маршруты/имя.js';

const каталог='Тесты/Результаты/Сквозные_маршруты_23_10_2026';
const отчёт=process.argv.includes('--report');
const сценарии={
  async 'поздний-отказ-сцена'(p) {
    p.until(22);p.goal('уехать');
    assert.match(следующийШагУехать(p.S),/Локи/);
    p.click(действияЦелей(p.S).find(a=>a.id==='цель:снять'),{panel:true});
    p.goal('угол');assert.ok(сводкаЦели(p.S).шаг.length>20);
    p.click(действияЦелей(p.S).find(a=>a.id==='цель:снять'),{panel:true});
    p.until(30);p.travel('жилые-улицы');p.slot('ночь');
    p.visit('ночлежка');
    assert.equal(p.S.мир.день,30);assert.equal(p.S.мир.итогСезона,undefined);
    p.leave();
    assert.equal(p.S.мир.день,31);assert.ok(p.S.мир.конецДня.финал);
    assert.equal(p.S.мир.итогСезона.исход,'отказ-от-цели');
  },
  async 'пропуск-подтверждения'(p) {
    p.until(3);p.goal('уехать');p.earn(50,{byDay:14});
    p.visit('контора-дорров',{npc:'tobb'});
    p.scene(/Прочесть расписание/);p.scene(/Выбрать береговой/);p.scene(/Записаться по книге/);p.leave();
    p.until(22);
    assert.equal(p.S.мир.уехать.исход,'не-подтвердил');
    assert.match(следующийШагУехать(p.S),/Локи/);
    assert.doesNotMatch(следующийШагУехать(p.S),/^Подтверди место/);
    p.finish();assert.ok(p.S.мир.итогСезона);
    assert.notEqual(p.S.мир.итогСезона.исход,'по-книге');
  },
  async 'финал-из-смены'(p) {
    // Меняется стратегия прохождения, игровое состояние не подправляется.
    p.finish=function() {
      this.until(30);this.travel('маяк');this.slot('ночь');this.feed();
      const кошельДо=this.S.герой.кошель;
      this.city('работа:маяк');
      // При отсутствии события работа завершается этой же кнопкой;
      // при наличии карточки сначала требуется закончить её решения.
      if(this.S.мир.смена && this.S.мир.смена.стадия!=='итог'){
        assert.equal(this.S.мир.итогСезона,undefined,'финал ждёт завершения смены');
        this.shift();
      }
      assert.ok(this.S.герой.кошель>кошельДо,'выплата последней смены учтена');
      assert.equal(this.S.мир.день,31);assert.ok(this.S.мир.конецДня.финал);
      this.checkpoint();return this.S.мир.итогСезона;
    };
    await пройтиИмя(p);
    assert.equal(p.S.мир.итогСезона.исход,'человек-стороны');
  },
};
if(отчёт)fs.mkdirSync(каталог,{recursive:true});
let выполнено=0;
for(const {id:начало} of НАЧАЛА)for(const [сценарий,идти] of Object.entries(сценарии)) {
  const p=new Маршрут(начало,сценарий);
  try {
    await идти(p);p.checkpoint();выполнено++;
    console.log(`OK ${начало}/${сценарий}: ${p.S.мир.итогСезона.исход}; ${p.шаги.length} действий`);
    if(отчёт)fs.writeFileSync(`${каталог}/календарь-${начало}-${сценарий}.json`,JSON.stringify({начало,сценарий,зерно:p.зерно,итог:p.S.мир.итогСезона,шаги:p.шаги,дни:p.итоги,сохранение:p.S},null,2)+'\n');
  }catch(e){console.error(начало,сценарий,p.шаги.slice(-8));throw e;}
}
assert.equal(выполнено,9);
console.log('Календарные маршруты: 9/9');
