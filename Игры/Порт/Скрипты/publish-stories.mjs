// Публикует «Кордим: Хроники» вместе с интерфейсом и иллюстрациями.
import { copyFile, cp, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..','..','..');
const source=resolve(repository,'Игры','Генератор_Историй');
const output=resolve(repository,'Игры','Сайт','Игра','Истории');
await mkdir(output,{recursive:true});
await copyFile(resolve(source,'Index.html'),resolve(output,'index.html'));
for(const name of ['chronicles.css','chronicles.js','ai-models.js','ai.js'])await copyFile(resolve(source,name),resolve(output,name));
await cp(resolve(source,'assets'),resolve(output,'assets'),{recursive:true});
console.log('Опубликованы Хроники: HTML, интерфейс и иллюстрации.');
