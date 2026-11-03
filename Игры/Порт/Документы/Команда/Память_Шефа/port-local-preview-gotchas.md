---
name: port-local-preview-gotchas
description: ПОРТ local preview in an agent worktree — repo-py port clash and stale ES modules from python http.server cache
metadata:
  node_type: memory
  type: reference
  originSessionId: e8470482-3e26-4b35-9e65-c5b90d850b81
  modified: 2026-10-30T04:28:38.521Z
---

Проверка ПОРТа на экране из своей копии (worktree):

- Конфиг `repo-py` в корневом `.claude/launch.json` жёстко передаёт порт 8795 в `runtimeArgs`. Если 8795 занят другим агентом, preview назначает другой порт, но python всё равно пытается слушать 8795 — страница не открывается. Выход: временно добавить свой конфиг на свободном порту (`"autoPort": false`) и не коммитить его.
- Браузер держит старые модули игры из HTTP-кэша `python -m http.server`: после правки данных (`Данные/Места/*.js`) экран показывает прежнее поведение. Перед перезагрузкой — `fetch(путь, {cache:'reload'})` для изменённых файлов.
- Состояние для проверки удобно собрать в странице: `import('…/Движок/состояние.js')`, `новоеСостояние(...)`, правки полей, `сохранить(S,'авто')`, перезагрузка, «Продолжить». Звук — `localStorage['порт-теней-интерфейс']` с `музыка:0, звуки:0`.

Связано: [[port-agent-team]].
