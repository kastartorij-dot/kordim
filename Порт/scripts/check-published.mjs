// Проверяет, что опубликованная копия игры совпадает с исходниками.
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repository = resolve(source, '..');
const published = join(repository, 'wiki', 'game', 'port');
const entries = ['index.html', 'данные', 'движок', 'сцены', 'assets'];

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

if (missing.length || extra.length || different.length) {
  console.error('Копия игры не синхронна. Запусти: npm run publish');
  if (missing.length) console.error('Нет в wiki/game/port:', missing.join(', '));
  if (extra.length) console.error('Лишнее в wiki/game/port:', extra.join(', '));
  if (different.length) console.error('Отличается:', different.join(', '));
  process.exitCode = 1;
} else {
  console.log(`Копия игры синхронна: ${sourceFiles.size} файлов.`);
}
