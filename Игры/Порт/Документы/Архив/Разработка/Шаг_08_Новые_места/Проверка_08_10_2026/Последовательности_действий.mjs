// Проверка присланного пакета; в текущем main новые модули ещё отсутствуют.
// Запуск: node этот-файл.mjs ПУТЬ_К_ИЗОЛИРОВАННОЙ_КОПИИ_Игры_Порт
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const project = process.argv[2];
if (!project) throw new Error('Укажите папку исходников проверяемого пакета');
const source = async p => import(pathToFileURL(path.resolve(project, p)).href);
const { новоеСостояние } = await source('./Движок/состояние.js');
const { войти, действияСцены } = await source('./Движок/разговор.js');
const { МЕСТА } = await source('./Данные/места.js');
const { датьТему } = await source('./Движок/знание.js');
const ids=['рынок','меняльная','контора-дорров','двор-горма','ночлежка','лекарь','маяк','часовня','лачуга-локи'];
const errors=[]; let steps=0;
for(const id of ids) for(const day of [1,11,12,13,14,16,20,21,23,25,28]) for(const part of ['утро','день','вечер','ночь']) for(const seed of [1,7,20]){
 const S=новоеСостояние('семья',seed); S.мир.день=day; S.мир.отрезок=part; S.мир.район=МЕСТА.find(m=>m.id===id).район; S.герой.кошель=200; S.герой.тело.цел=2;
 for(const t of ['gorm_chetnye','mayak_ogon','lozh_strazha','gore']) датьТему(S,t,'слышал');
 войти(S,id); const route=[];
 for(let i=0; i<28 && S.сцена;i++){
  try { const choices=действияСцены(S).filter(a=>a.можно && a.вид!=='откат' && a.вид!=='финал'); if(!choices.length) break; const a=choices[(seed*37+i*19+day)%choices.length]; route.push(a.текст); a.выполнить(S); steps++; }
  catch(e){errors.push({id,day,part,seed,route,error:e.stack});break;}
 }
}
console.log(JSON.stringify({steps,errors},null,2));
