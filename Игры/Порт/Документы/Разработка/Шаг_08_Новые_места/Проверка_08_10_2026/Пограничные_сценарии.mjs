// Проверка присланного пакета; в текущем main новые модули ещё отсутствуют.
// Запуск: node этот-файл.mjs ПУТЬ_К_ИЗОЛИРОВАННОЙ_КОПИИ_Игры_Порт
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const project = process.argv[2];
if (!project) throw new Error('Укажите папку исходников проверяемого пакета');
const source = async p => import(pathToFileURL(path.resolve(project, p)).href);
const { новоеСостояние } = await source('./Движок/состояние.js');
const { войти, действияСцены } = await source('./Движок/разговор.js');
const { датьТему, верностьТемы } = await source('./Движок/знание.js');
const { занято, положить, естьВещь } = await source('./Движок/вещи.js');
const click=(S,id)=>{const a=действияСцены(S).find(a=>a.id===id);if(!a?.можно)throw new Error('missing '+id);a.выполнить(S);};
const text=(S,t)=>{const a=действияСцены(S).find(a=>a.текст.startsWith(t));if(!a?.можно)throw new Error('missing '+t);a.выполнить(S);};
const out=[];
for(const day of [5,23]) {const S=новоеСостояние('семья',7); S.мир.район='локи'; S.мир.день=day; S.мир.отрезок='день'; S.герой.кошель=0; войти(S,'лачуга-локи'); click(S,'пойти:порог-локи'); click(S,'пойти:внутри-локи'); text(S,'Сказать, что пришёл торговаться');const available=действияСцены(S).some(a=>a.текст.startsWith('Проход')&&a.можно);out.push({case:'bypass_planks',day,coins:S.герой.кошель,room:S.сцена.комната,quiet:S.сцена.лачуга?.тихо,passAvailable:available});}
{const S=новоеСостояние('семья',7);S.мир.район='маяк';S.мир.день=4;S.мир.отрезок='вечер';S.герой.кошель=50;S.мир.флаги.push('без_свидетелей');датьТему(S,'mayak_ogon');датьТему(S,'gore');войти(S,'маяк');text(S,'Подняться по лестнице');click(S,'пойти:фонарная');click(S,'заговорить:ifo');click(S,'тема:mayak_ogon');const first={shadow:S.мир.тень,protected:S.мир.флаги.includes('без_свидетелей'),leaks:structuredClone(S.мир.ушло)};click(S,'тема:gore');out.push({case:'one_conversation_two_topics',first,afterSecond:{shadow:S.мир.тень,scene:S.сцена?.место,leaks:S.мир.ушло},log:S.мир.журналДня});}
{const S=новоеСостояние('семья',7);S.мир.район='локи';S.мир.день=5;S.мир.отрезок='день';S.герой.при_себе=[];S.герой.кошель=30; for(let i=0;i<8;i++)положить(S,'сувенир'); войти(S,'лачуга-локи');text(S,'Позвать Кука');click(S,'пойти:внутри-локи');text(S,'Сказать, что пришёл торговаться');text(S,'Вещь со дна');text(S,'Разобрать сети');text(S,'Вынести ведро');out.push({case:'full_inventory_reward',bag:занято(S.герой.при_себе),received:естьВещь(S,'находка'),pending:S.мир.отложенныеВещи,award:S.мир.выдано?.находка_локи});}
console.log(JSON.stringify(out,null,2));
