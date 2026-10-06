// Проверяет, что опубликованная копия игры совпадает с исходниками.
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repository = resolve(source, '..', '..');
const published = join(repository, 'Игры', 'Сайт', 'Игра', 'Порт');
const entries = ['index.html', 'Данные', 'Движок', 'Сцены', 'Ресурсы'];

async function filesUnder(path, prefix = '') {
  if ((await stat(path)).isFile()) return [prefix];
  const result = [];
  for (const name of await readdir(path)) result.push(...await filesUnder(join(path, name), join(prefix, name)));
  return result;
}

async function digest(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

const sourceFiles = new Set();
const publishedFiles = new Set();
for (const entry of entries) {
  for (const file of await filesUnder(join(source, entry), entry)) sourceFiles.add(file);
  for (const file of await filesUnder(join(published, entry), entry)) publishedFiles.add(file);
}

const missing = [...sourceFiles].filter(file => !publishedFiles.has(file));
const extra = [...publishedFiles].filter(file => !sourceFiles.has(file));
const different = [];
for (const file of sourceFiles) {
  if (publishedFiles.has(file) && await digest(join(source, file)) !== await digest(join(published, file))) different.push(file);
}

const storiesSource = join(repository, 'Игры', 'Генератор_Историй', 'Index.html');
const storiesPublished = join(repository, 'Игры', 'Сайт', 'Игра', 'Истории', 'index.html');
if (await digest(storiesSource) !== await digest(storiesPublished)) different.push('Генератор_Историй/Index.html');
const storiesDir = dirname(storiesSource);
const storiesOutputDir = dirname(storiesPublished);
for (const entry of ['chronicles.css', 'chronicles.js', 'assets']) {
  for (const file of await filesUnder(join(storiesDir, entry), entry)) {
    try {
      if (await digest(join(storiesDir, file)) !== await digest(join(storiesOutputDir, file))) different.push('Генератор_Историй/' + file);
    } catch { missing.push('Истории/' + file); }
  }
}

if (missing.length || extra.length || different.length) {
  console.error('Копии игр не синхронны. Запусти: npm run publish-all');
  if (missing.length) console.error('Нет в Игры/Сайт/Игра/Порт:', missing.join(', '));
  if (extra.length) console.error('Лишнее в Игры/Сайт/Игра/Порт:', extra.join(', '));
  if (different.length) console.error('Отличается:', different.join(', '));
  process.exitCode = 1;
} else {
  console.log(`Копии игр синхронны: Порт — ${sourceFiles.size} файлов; Хроники — HTML, интерфейс и иллюстрации.`);
}
