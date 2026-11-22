import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../scripts/layout.gd', import.meta.url);
const target = new URL('../План/layout-data.js', import.meta.url);
const text = await readFile(source, 'utf8');
const declaration = text.match(/^const DATA := (\{[\s\S]*\})\s*$/m);
if (!declaration) throw new Error('В layout.gd не найдены данные плана.');
JSON.parse(declaration[1]);

const output = '// Копия scripts/layout.gd. Пересобрать через node Инструменты/План.mjs.\nglobalThis.NORA_LAYOUT = ' + declaration[1] + ';\n';
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== output) throw new Error('Веб-чертёж нужно пересобрать.');
} else {
  await writeFile(target, output, 'utf8');
}
