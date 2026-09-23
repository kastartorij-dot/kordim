// Собирает только игровые файлы в wiki/game/port/. Документы, тесты и исходники арта
// остаются в проекте, но не попадают в публичные статические файлы.
import { cp, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(source, '..');
const output = resolve(repository, 'wiki', 'game', 'port');
const parent = dirname(output);
const temporary = join(parent, `.port-build-${process.pid}`);
const backup = join(parent, `.port-backup-${process.pid}`);
const entries = ['index.html', 'данные', 'движок', 'сцены', 'assets'];

if (output !== join(repository, 'wiki', 'game', 'port') || source === repository) {
  throw new Error('Неверный путь сборки Порта');
}
for (const entry of entries) await stat(join(source, entry));
await mkdir(parent, { recursive: true });
await rm(temporary, { recursive: true, force: true });
await mkdir(temporary);

let oldMoved = false;
try {
  for (const entry of entries) {
    await cp(join(source, entry), join(temporary, entry), { recursive: true });
  }
  const existing = await readdir(parent);
  if (existing.includes('port')) {
    if (existing.includes(`.port-backup-${process.pid}`)) throw new Error('Резервная папка сборки уже существует');
    await rename(output, backup);
    oldMoved = true;
  }
  await rename(temporary, output);
  if (oldMoved) await rm(backup, { recursive: true });
  console.log(`Собрано: ${output}`);
} catch (error) {
  if (oldMoved) {
    const existing = await readdir(parent);
    if (!existing.includes('port')) await rename(backup, output);
  }
  throw error;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
