---
name: no-autostash-shared-folder
description: In D:\AI\kordim another Claude session often edits the same checkout; never run git pull --autostash there
metadata:
  node_type: memory
  type: feedback
  originSessionId: ddedb184-846c-40aa-94b5-dd04e5942df5
  modified: 2026-10-27T09:27:39.808Z
---

Do not run `git pull --rebase --autostash` (or any stash/reset) in `D:\AI\kordim` while files outside your own commit are modified: they usually belong to a parallel session working in the same folder.

**Why:** on 27.10.2026 the autostash stashed that session's uncommitted work and `reset --hard` failed halfway on Windows ("unable to unlink … Invalid argument"). That left 21 of its files rolled back and a dangling `.git/rebase-merge`. It was restored file by file from the autostash commit, and the copy kept as `stash@{0}`.

**How to apply:** commit only your own paths, then run `git fetch`. If the branch is not behind, just `git push`. If it is behind, `git pull --rebase` without autostash works only when the tree is clean. Otherwise stop and ask the user rather than stash someone else's work.
