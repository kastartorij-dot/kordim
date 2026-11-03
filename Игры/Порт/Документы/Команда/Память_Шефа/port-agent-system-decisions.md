---
name: port-agent-system-decisions
description: "Author's decisions (27.10.2026) for the planned agent team that polishes the ПОРТ game"
metadata:
  node_type: memory
  type: project
  originSessionId: eac438db-849f-45fb-8204-172cbe5d75b3
  modified: 2026-10-27T21:27:56.963Z
---

On 27.10.2026 the author asked for a semi-autonomous agent team (lead + playtester, mechanics, writer, art, sound, UI, engineer) to bring ПОРТ (`Игры/Порт/`) to a polished state. It starts after the two chats active that day finish.

Author's answers:
- The lead may merge and publish (push to main) without the author reviewing each change.
- The author approves only important texts (finals, personal lines, new world facts).
- Season 2 waits until season 1 is perfect.
- Art: first build a style sheet with variants (code-drawn, local generation, ChatGPT manual, mix). The author doubts ComfyUI quality but agreed to try it. Only an orphan `C:\Users\Глеб\ComfyUI-Manager` was found, no ComfyUI and no models.

Installed skills in `~/.claude/skills/`: studioigor, ref2game, gauntlet-loop (by github.com/studioigor). Their scripts are Mac-oriented (sips, launchctl), so autopilot.py does not work on Windows.

Lessons from three studioigor videos the author asked me to study (27.10):
- Drawing detailed art fully in code cost about 12% of a $200 weekly limit for a 2/10 result. Generating art in pieces with code doing the effects cost about 1% and looked finished. So art = generated pieces plus code for light, rain, text and animation. Pure code is for UI, icons and effects.
- Effort cost for the same 4 tasks (API equivalent): Low $39, Medium $113, High $130, XHigh $350. The game Haiku made could not be finished. Use High by default and XHigh for the hardest parts. Don't use Haiku for game work.
- The ChatGPT Free plan can't generate images through Codex (official pricing page). Automatic image generation needs Plus.

Set up 28.10:
- ComfyUI portable v0.43.0 lives in `D:\AI\ComfyUI`. Start it with `python_embeded/python.exe -s ComfyUI/main.py --windows-standalone-build --port 8188`.
- Models: Z-Image Turbo int8 with qwen_3_4b and ae, plus FLUX.2 Klein 4B with flux2-vae. Both are Apache 2.0. Z-Image works through the API with 8 steps, cfg 1, res_multistep, CLIPLoader type lumina2.
- Test results: harbor in about 4 minutes (including model load), portrait in about 2.5 minutes. Quality is good. Prompts must ban motor boats, electric lamps, antennas and glass.
- User-scope plugins: frontend-design, playground, playwright. MCP server `comfyui` (npx comfyui-mcp) is connected. hookify was skipped because it calls `python3`, which does not exist on this machine.
- Guard hook `.claude/hooks/guard.mjs` is in the repo and registered in both `.claude/settings.json` files.

**Why:** these choices set how autonomous the lead may be and what goes to the author.
**How to apply:** don't ask for approval on routine merges or minor texts. Bring style choices and new canon to the author. Docs in ПОРТ (~50k lines) already equal the game code (~53k lines), so keep new docs minimal. Related: [[no-autostash-shared-folder]]
