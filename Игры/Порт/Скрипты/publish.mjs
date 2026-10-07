// Собирает только игровые файлы в Игры/Сайт/Игра/Порт/. Документы, тесты и исходники арта
// остаются в проекте, но не попадают в публичные статические файлы.
import { cp, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(source, '..', '..');
const output = resolve(repository, 'Игры', 'Сайт', 'Игра', 'Порт');
const parent = dirname(output);
const temporary = join(parent, `.port-build-${process.pid}`);
const backup = join(parent, `.port-backup-${process.pid}`);
const entries = ['index.html', 'Данные', 'Движок', 'Сцены', 'Ресурсы'];

if (output !== join(repository, 'Игры', 'Сайт', 'Игра', 'Порт') || source === repository) {
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
  if (existing.includes('Порт')) {
    if (existing.includes(`.port-backup-${process.pid}`)) throw new Error('Резервная папка сборки уже существует');
    await rename(output, backup);
    oldMoved = true;
  }
  // На Windows каталог может оставаться видимым сразу после rename.
  // Удаляем только уже сохранённую копию выпуска, исходники не затрагиваются.
  await rm(output, { recursive: true, force: true });
  try {
    await rename(temporary, output);
  } catch (error) {
    // Windows может запрещать перенос подготовленного каталога (EPERM/EBUSY).
    // Старый выпуск уже в backup; копирование завершается до его удаления.
    if (!['EPERM', 'EBUSY'].includes(error.code)) throw error;
    await cp(temporary, output, { recursive: true, errorOnExist: true, force: false });
  }
  if (oldMoved) await rm(backup, { recursive: true });
  console.log(`Собрано: ${output}`);
} catch (error) {
  if (oldMoved) {
    // Если копирование прервалось, возвращаем весь прежний выпуск.
    await rm(output, { recursive: true, force: true });
    await rename(backup, output);
  }
  throw error;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
