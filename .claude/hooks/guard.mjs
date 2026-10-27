// Предохранитель для сессий Claude Code в репозитории kordim (хук PreToolUse).
// Запрещает то, что уже стоило потерянной работы или ломает единственную версию игры:
// pull --autostash в общей папке, force push, reset --hard, git stash, ручную правку собранной копии сайта.
import { readFileSync } from 'node:fs';

let вход = {};
try { вход = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const инструмент = вход.tool_name || '';
const данные = вход.tool_input || {};

function запрет(причина) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: причина },
  }));
  process.exit(0);
}

if (инструмент === 'Bash' || инструмент === 'PowerShell') {
  // Текст в кавычках и во вставках heredoc — данные (сообщение коммита, файл), а не команды.
  const команда = String(данные.command || '')
    .replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?\n\s*\1\b/g, ' ')
    .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, ' ');
  // Каждую часть составной команды проверяем отдельно.
  for (const часть of команда.split(/&&|\|\||;|\n|\|/)) {
    if (!/\bgit\b/.test(часть)) continue;
    if (/\bpull\b/.test(часть) && /--autostash|autoStash=true/i.test(часть))
      запрет('git pull --autostash запрещён: в этой папке может работать другая сессия, и автостэш однажды откатил её незакоммиченные файлы. Делай git fetch, затем git pull --rebase без автостэша, коммить только свои файлы.');
    if (/\bpush\b/.test(часть) && /(\s-f\b|--force)/.test(часть))
      запрет('Принудительный push запрещён без явной просьбы автора. При отказе push: git pull --rebase, разрешить конфликт, push снова.');
    if (/\breset\b/.test(часть) && /--hard/.test(часть))
      запрет('git reset --hard запрещён: он стирает незакоммиченную работу, в том числе чужую. Спроси автора.');
    if (/\bgit\s+stash\b/.test(часть) && !/\bgit\s+stash\s+(list|show)\b/.test(часть))
      запрет('git stash запрещён: он прячет и чужие незакоммиченные правки в общей папке. Коммить свои файлы по одному или спроси автора.');
  }
}

if (инструмент === 'Edit' || инструмент === 'Write' || инструмент === 'NotebookEdit' || инструмент === 'MultiEdit') {
  const путь = String(данные.file_path || данные.notebook_path || '').replace(/\\/g, '/');
  if (/\/Игры\/Сайт\/Игра\/Порт\//.test(путь))
    запрет('Игры/Сайт/Игра/Порт/ — собранная копия, её не правят руками: правка пропадёт при следующей сборке. Правь исходник в Игры/Порт/ и запусти npm run publish.');
}
process.exit(0);
