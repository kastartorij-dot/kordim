// Поведение окон: верхний слой, клавиатура и возврат фокуса.
const окна = new WeakMap();
const видимые = узел => [...узел.querySelectorAll('button:not(:disabled), a[href], input, select, textarea, summary, [tabindex="0"]')].filter(x => !x.hidden && x.getClientRects().length);
function верхнее() {
  return [...document.querySelectorAll('.ов')].filter(x => x.getClientRects().length)
    .sort((a, b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex)).at(-1);
}
export function показатьОкно(ов, закрыть = null) {
  const прежний = document.activeElement;
  const данные = { закрыть, прежний, вкладка: прежний?.dataset?.вкладка };
  окна.set(ов, данные);
  const бокс = ов.querySelector('.овбокс, .ovbox');
  if (бокс) { бокс.setAttribute('role', 'dialog'); бокс.setAttribute('aria-label', бокс.querySelector('h1, h2')?.textContent ?? 'Окно'); бокс.tabIndex = -1; }
  (видимые(ов)[0] ?? бокс)?.focus({ preventScroll: true });
}
export function закрытьОкно(ов) {
  const д = окна.get(ов);
  ов.remove();
  const цель = д?.прежний?.isConnected ? д.прежний
    : д?.вкладка ? document.querySelector('[data-вкладка="' + д.вкладка + '"]') : document.getElementById('hud-меню');
  цель?.focus({ preventScroll: true });
}
document.addEventListener('keydown', e => {
  const ов = верхнее();
  if (!ов) return;
  if (e.key === 'Escape') {
    e.preventDefault(); e.stopImmediatePropagation();
    окна.get(ов)?.закрыть?.();
  } else if (e.key === 'Tab') {
    const доступ = видимые(ов);
    if (ов.classList.contains('пан')) доступ.push(...видимые(document.getElementById('панель')), ...видимые(document.getElementById('hud')));
    const i = доступ.indexOf(document.activeElement);
    if (!доступ.length) { e.preventDefault(); return; }
    e.preventDefault();
    const следующий = i < 0 ? (e.shiftKey ? доступ.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + доступ.length) % доступ.length;
    доступ[следующий].focus();
  }
}, true);
