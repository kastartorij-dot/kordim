// Для fony_page.py: какие комнаты каких мест показывают какой файл фона (как в игре, через путиФона).
// Запуск: node fony_rooms.mjs <папка Игры/Порт>
import fs from 'fs';
const root=process.argv[2];
const {МЕСТА}=await import(root+'/Данные/места.js');
const {путиФона}=await import(root+'/Данные/фоны-комнат.js');
const R=root+'/Ресурсы/';
const out={};
for(const м of МЕСТА){const д=м.модуль;const п=д.КАРТИНКИ?.папкиФонов||[];
  for(const [id,к] of Object.entries(д.КОМНАТЫ||{})){
    const f=путиФона(м.id,id,п).find(x=>fs.existsSync(R+x));
    if(f)(out[f]??=[]).push({место:м.имя,комната:к.имя,когда:м.когда||[]});}}
console.log(JSON.stringify(out));
