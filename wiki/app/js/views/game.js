/* Игра «Порт Теней»: исходники лежат в Порт/, сайт получает собранную копию по адресу /game/port/. */
export function render(root){
  root.innerHTML = `<div class="game" data-title="Игра">
    <div class="gbar"><b>Кордим RPG</b>
      <span>Текстовая игра «Порт Теней» по миру Кордима.</span>
      <span class="glinks">
        <a href="../game/port/index.html" target="_blank" rel="noopener">Открыть отдельно ↗</a>
      </span></div>
    <div class="gwrap"><iframe src="../game/port/index.html" title="Порт Теней"></iframe></div>
  </div>`;
}
