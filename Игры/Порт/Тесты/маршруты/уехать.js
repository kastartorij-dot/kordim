import assert from 'node:assert/strict';

export async function пройтиОтъезд(p) {
  p.until(3);p.goal('уехать');p.earn(50,{byDay:14});
  p.visit('контора-дорров',{npc:'tobb'});
  p.scene(/Прочесть расписание/);p.scene(/Выбрать береговой/);p.scene(/Записаться по книге/);p.leave();
  p.until(10);p.visit('контора-дорров',{npc:'tobb'});
  p.scene(/Подтвердить место/);p.leave();
  p.earn(60,{byDay:20});p.until(17);p.visit('контора-дорров',{npc:'tobb'});
  p.scene(/держаться раннего/);p.scene(/Внести остаток/);p.leave();
  p.until(24);p.visit('выход-к-судам');p.scene(/Оглянуться на берег/);p.scene(/Взойти на борт/);
  assert.equal(p.S.мир.кампанияЗавершена,true);
  assert.equal(p.S.мир.итогСезона.исход,'по-книге');
  p.checkpoint();
}
