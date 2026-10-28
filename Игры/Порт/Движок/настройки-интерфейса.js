// Предпочтения чтения хранятся отдельно от игровых сохранений.
const ключ = 'порт-теней-интерфейс';
const значения = { размер: ['обычный', 'крупный'], контраст: ['обычный', 'высокий'], движение: ['обычное', 'меньше'] };
// Громкость — ползунки 0–100: музыка и звуки событий. 0 — тишина, отдельного выключателя нет.
export const ГРОМКОСТИ = { музыка: 60, звуки: 70 }; // по умолчанию: музыка «средне», звуки как прежде «вкл»
const число = v => Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null;
// Перевод прежних выключателей: выкл → 0; громкость тихо/средне/громко → 30/60/100; звуки вкл → 70.
export function громкостиИз(с = {}) {
  const музыка = число(с.музыка) ?? (с.музыка === 'выкл' ? 0 : { тихо: 30, средне: 60, громко: 100 }[с.громкость] ?? ГРОМКОСТИ.музыка);
  const звуки = число(с.звуки) ?? (с.звуки === 'выкл' ? 0 : ГРОМКОСТИ.звуки);
  return { музыка, звуки };
}
export function настройкиИнтерфейса() {
  let сохранено = {};
  try { сохранено = JSON.parse(localStorage.getItem(ключ) ?? '{}') ?? {}; } catch {}
  return { ...Object.fromEntries(Object.entries(значения).map(([к, в]) => [к, в.includes(сохранено[к]) ? сохранено[к] : в[0]])), ...громкостиИз(сохранено) };
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
  if (ключНастройки in ГРОМКОСТИ) значение = число(Number(значение));
  else if (!значения[ключНастройки]?.includes(значение)) return;
  if (значение === null) return;
  const н = { ...настройкиИнтерфейса(), [ключНастройки]: значение };
  try { localStorage.setItem(ключ, JSON.stringify(н)); } catch {}
  применитьНастройки();
}
