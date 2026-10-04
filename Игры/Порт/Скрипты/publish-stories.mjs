// Публикует отдельную мини-игру «Кордим: Хроники».
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const source = resolve(repository, 'Игры', 'Генератор_Историй', 'Index.html');
const output = resolve(repository, 'Игры', 'Сайт', 'Игра', 'Истории', 'index.html');
await mkdir(dirname(output), { recursive: true });
await copyFile(source, output);
console.log(`Опубликовано: ${output}`);
