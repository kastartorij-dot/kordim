---
name: port-agent-team
description: Since 28.10.2026 the ПОРТ game is improved by an agent team run by a Шеф session; rules live in the repo
metadata:
  node_type: memory
  type: project
  originSessionId: eac438db-849f-45fb-8204-172cbe5d75b3
  modified: 2026-10-27T21:41:35.061Z
---

Since 28.10.2026 a team of agents works on ПОРТ (`Игры/Порт/`). The author talks only to the Шеф chat. Шеф starts agent sessions in their own worktrees, reviews and merges their work into `main`, publishes the site, and reports to the author.

- Rules and roles: `Игры/Порт/Документы/Команда/СИСТЕМА.md`, `ШЕФ.md`, `Роли/`.
- The single task list is `Игры/Порт/ДОСКА.md`. It holds the current cycle, night batches, «Решено за автора» and the author's decisions. Cycle 1 (Сценарист, Интерфейс, Игрок) was proposed on 28.10 and is not started yet.
- Style decision Р9 is open: backgrounds already share one style. The author picks the portrait type from 4 options on the board artifact https://claude.ai/artifact/FWnyZtTqSKak96U9f9iidg and has questions about it, deferred.
- Old step-based docs are archived in `Документы/Архив/`. Working materials are in `Документы/Материалы/`.

**Why:** the author wants semi-autonomous work instead of scattered chats, and wants nothing lost.
**How to apply:** in a ПОРТ session, read ДОСКА and the team files first. Agents commit only on their branch, and only Шеф merges and pushes. Don't create new docs; the result goes on the board. Related: [[port-agent-system-decisions]], [[no-autostash-shared-folder]]
