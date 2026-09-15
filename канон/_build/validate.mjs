// Проверяет блоки канона на снятые вещи (Гильдия, гримдарк и т.п. из канон/запреты.txt)
// и на пустые ключи у записей ЧАСТИ III. Не трогает файлы, только печатает отчёт.
//
// node канон/_build/validate.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KANON = path.join(ROOT, 'канон');
const manifest = JSON.parse(fs.readFileSync(path.join(KANON, 'манифест.json'), 'utf8'));
const banFile = path.join(KANON, 'запреты.txt');
const bans = fs.existsSync(banFile)
  ? fs.readFileSync(banFile, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'))
  : [];

// Шапка (журнал правок) намеренно исключена: там описывается сама отмена
// («Гильдия наёмников упразднена», «ярлык гримдарк снят») — это не нарушение,
// а история решения.
const allFiles = [...manifest.части.flatMap(p => p.блоки), ...manifest.приложения];

let problems = 0;
for (const rel of allFiles) {
  const text = fs.readFileSync(path.join(KANON, rel), 'utf8');
  const bodyStart = text.indexOf('\n---\n', 4) + 5;
  const front = text.slice(0, bodyStart);
  const body = text.slice(bodyStart);

  for (const term of bans) {
    if (body.includes(term)) {
      console.log(`⚠ ${rel}: снятая формулировка «${term}»`);
      problems++;
    }
  }
  if (/^id: \d+/m.test(front) && /ключи:\s*\[\]/.test(front)) {
    console.log(`⚠ ${rel}: пустые ключи`);
    problems++;
  }
}

console.log(problems ? `\nНайдено ${problems} проблем.` : '\nOK: запретов не найдено, ключи на месте.');
process.exit(problems ? 1 : 0);
