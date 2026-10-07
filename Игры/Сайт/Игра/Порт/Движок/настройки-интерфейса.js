// Предпочтения чтения хранятся отдельно от игровых сохранений.
const ключ = 'порт-теней-интерфейс';
const значения = { размер: ['обычный', 'крупный'], контраст: ['обычный', 'высокий'], движение: ['обычное', 'меньше'] };
export function настройкиИнтерфейса() {
  let сохранено = {};
  try { сохранено = JSON.parse(localStorage.getItem(ключ) ?? '{}') ?? {}; } catch {}
  return Object.fromEntries(Object.entries(значения).map(([к, в]) => [к, в.includes(сохранено[к]) ? сохранено[к] : в[0]]));
}
let размерыШапки;
export function применитьНастройки() {
  const hud = document.getElementById('hud');
  if (hud && !размерыШапки) {
    размерыШапки = new ResizeObserver(() => document.documentElement.style.setProperty('--hud-height', (hud.offsetTop + hud.offsetHeight) + 'px'));
    размерыШапки.observe(hud);
  }
  const н = настройкиИнтерфейса();
  document.documentElement.dataset.размер = н.размер;
  document.documentElement.dataset.контраст = н.контраст;
  document.documentElement.dataset.движение = н.движение;
}
export function изменитьНастройку(ключНастройки, значение) {
  if (!значения[ключНастройки]?.includes(значение)) return;
  const н = { ...настройкиИнтерфейса(), [ключНастройки]: значение };
  try { localStorage.setItem(ключ, JSON.stringify(н)); } catch {}
  применитьНастройки();
}
