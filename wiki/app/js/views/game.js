/* Мини-игра: отдельный проект в папке «Мини-игра», сервер отдаёт его по адресу /game/. */
export function render(root){
  root.innerHTML = `<div class="game" data-title="Игра">
    <div class="gbar"><b>Кордим RPG</b>
      <span>Текстовая игра по миру через OpenRouter. Лорбук игры причёсан под канон 13.09: контора Сайдена вместо Гильдии, марка = 10 грошей.</span>
      <a href="../game/Index.html" target="_blank" rel="noopener">Открыть отдельно ↗</a></div>
    <div class="gwrap"><iframe src="../game/Index.html" title="Кордим RPG"></iframe></div>
  </div>`;
}
