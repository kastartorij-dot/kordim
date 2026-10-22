// Сквозные известные маршруты. Все ресурсы и даты — из обычных игровых действий.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { НАЧАЛА } from '../Данные/герой.js';
import { Маршрут } from './утилиты/маршрут.js';
import { пройтиУгол } from './маршруты/угол.js';
import { пройтиИмя } from './маршруты/имя.js';
import { пройтиФрею } from './маршруты/фрея.js';
import { пройтиОтъезд } from './маршруты/уехать.js';

const пути={угол:пройтиУгол,имя:пройтиИмя,вытащить:пройтиФрею,уехать:пройтиОтъезд};
const фильтр=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const известные = new Set([...НАЧАЛА.map(a=>a.id), ...Object.keys(пути)]);
for (const arg of process.argv.slice(2)) assert.ok(arg==='--report' || известные.has(arg), 'неизвестный фильтр/параметр: '+arg);
const начала = фильтр.filter(a=>НАЧАЛА.some(н=>н.id===a));
const цели = фильтр.filter(a=>Object.hasOwn(пути,a));
const каталог='Документы/Разработка/Шаг_09_Главные_цели/Сквозные_маршруты_23_10_2026';
const отчёт=process.argv.includes('--report');
if(отчёт)fs.mkdirSync(каталог,{recursive:true});
let ошибок=0, выполнено=0;
for(const {id:начало} of НАЧАЛА)for(const [цель,идти] of Object.entries(пути)) {
  if(начала.length&&!начала.includes(начало))continue;
  if(цели.length&&!цели.includes(цель))continue;
  выполнено++;
  const p=new Маршрут(начало,цель);
  try {
    await идти(p);
    const итог=p.S.мир.итогСезона;
    assert.equal(итог.цель,цель);
    console.log(`OK ${начало}/${цель}: ${итог.исход}; день ${p.S.мир.день}; ${p.S.герой.кошель} гр.; тело ${JSON.stringify(p.S.герой.тело)}; ${p.шаги.length} кнопок`);
    if(отчёт)fs.writeFileSync(`${каталог}/${начало}-${цель}.json`,JSON.stringify({начало,цель,зерно:p.зерно,итог,шаги:p.шаги,дни:p.итоги,заметки:p.заметки,сохранение:p.S},null,2)+'\n');
  }catch(e){
    ошибок++;
    console.error(`FAIL ${начало}/${цель}: ${e.stack}`);
    console.error('ПОСЛЕДНИЕ ДЕЙСТВИЯ',JSON.stringify(p.шаги.slice(-12),null,2));
    if(отчёт)fs.writeFileSync(`${каталог}/${начало}-${цель}-ошибка.json`,JSON.stringify({ошибка:String(e),шаги:p.шаги,сохранение:p.S},null,2)+'\n');
  }
}
const ожидается=(начала.length ? new Set(начала).size : НАЧАЛА.length)*(цели.length ? new Set(цели).size : Object.keys(пути).length);
assert.ok(выполнено>0, 'не выполнено ни одного маршрута');
assert.equal(выполнено,ожидается,'выполнены все выбранные комбинации');
console.log(`Маршруты: ${выполнено-ошибок}/${выполнено} успешно; seed 11.`);
if(ошибок)process.exitCode=1;
