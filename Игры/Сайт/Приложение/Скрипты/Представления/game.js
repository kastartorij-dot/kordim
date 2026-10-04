/* Игра «Порт Теней»: исходники лежат в Игры/Порт/, сайт получает собранную копию по адресу /Игра/Порт/. */
export function render(root){
  root.innerHTML = `<div class="game" data-title="Игра">
    <div class="gbar"><b>Порт Теней</b>
      <span>Текстовая игра «Порт Теней» по миру Кордима.</span>
      <span class="glinks">
        <a href="../Игра/Порт/index.html" target="_blank" rel="noopener">Открыть отдельно ↗</a>
        <a href="../Игра/Истории/index.html" target="_blank" rel="noopener">Хроники · генератор историй ↗</a>
      </span></div>
    <div class="gwrap"><iframe src="../Игра/Порт/index.html" title="Порт Теней"></iframe></div>
  </div>`;
}
