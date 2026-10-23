// Все сцены близости, на которые ссылаются данные мест, и файлы, которых для них нет.
// Отсутствующий файл — ошибка сборки (шаг 11 п. 6): запасная фраза «Дальше — без слов» задачу не закрывает.
// Используется в check-published.mjs и Тесты/шаг11.mjs.
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { МЕСТА } from '../Данные/места.js';

const source = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function сценыБлизости() {
  const все = [];
  for (const м of МЕСТА) for (const [комната, К] of Object.entries(м.модуль.КОМНАТЫ ?? {})) {
    const б = К.близость;
    if (!б) continue;
    for (const сцена of б.сцены ? б.сцены.map(x => x.сцена) : [б.сцена]) все.push({ место: м.id, комната, сцена });
  }
  return все;
}

export async function недостающиеСцены(корень = source) {
  const нет = [];
  for (const з of сценыБлизости()) {
    try { await access(join(корень, 'Сцены', 'Близость', `${з.сцена}.md`)); } catch { нет.push(з); }
  }
  return нет;
}
