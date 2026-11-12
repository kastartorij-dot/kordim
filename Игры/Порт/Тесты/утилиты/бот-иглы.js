// Бот для «Иглы» в песочнице (песочница-игр.html): ведёт иглу мышью как человек — с задержкой реакции
// 200–250 мс, дрожью руки и своей скоростью. Запуск из консоли страницы песочницы:
//   const б = await import('./Тесты/утилиты/бот-иглы.js'); await б.серия({ варианты: ['i01-yakor'], навыки: [0, 2], раз: 5 })
// Возвращает таблицу уровней. ускорение > 1 подгоняет часы страницы (rAF и performance.now), чтобы серия шла быстрее.
const ШИР = 960;
const ВЫС = 540;
const ждать = мс => new Promise(r => setTimeout(r, мс));
const гаусс = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

let часыПодогнаны = false;
function подогнатьЧасы(к) {
  if (часыПодогнаны || к === 1) return;
  часыПодогнаны = true;
  const родные = performance.now.bind(performance);
  const ноль = родные();
  performance.now = () => ноль + (родные() - ноль) * к;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = f => raf(() => f(performance.now()));
}

function событие(тип, x, y, цель) {
  const холст = document.querySelector('.пс-холст');
  const r = холст.getBoundingClientRect();
  const e = new PointerEvent(тип, { clientX: r.left + x / ШИР * r.width, clientY: r.top + y / ВЫС * r.height, pointerId: 1, button: 0, bubbles: true, pointerType: 'mouse' });
  (цель ?? холст).dispatchEvent(e);
}

// Одна партия. рука: { скорость px/с, дрожь px, реакция [мс, мс] }.
export async function партия({ вариант, навык = 0, рука = {} } = {}) {
  const { скорость = 170, дрожь = 3, шум = 1.2, реакция = [200, 250] } = рука;
  document.body.dataset.исход = '';
  window.песочница.сост.навык = навык;
  const пуск = window.песочница.пуск('игла', { вариант });
  await ждать(400);
  document.querySelector('.пс-старт .пс-кн')?.click();
  await ждать(100);
  const поле = () => window.пс?.поле;
  const рукаXY = { x: 450, y: 330 };
  let нажата = false;
  let отпуститьВ = null;
  let нажатьВ = null;
  const история = []; // снимки наметки — человек видит руку с задержкой
  const t0 = performance.now();
  const реакц = () => реакция[0] + Math.random() * (реакция[1] - реакция[0]);
  let прошлое = performance.now();
  while (!document.body.dataset.исход && performance.now() - t0 < 180000) {
    await ждать(16);
    const д = поле()?.отладка?.();
    if (!д) continue;
    const сейчас = performance.now();
    const dt = Math.min(0.1, (сейчас - прошлое) / 1000);
    прошлое = сейчас;
    история.push({ t: сейчас, точки: д.точки, i: д.i });
    while (история.length > 2 && сейчас - история[1].t > реакция[1]) история.shift();
    const видно = история.find(h => сейчас - h.t <= реакция[0]) ?? история.at(-1);
    if (!д.точки) continue;
    const опасно = д.фаза !== 'тихо' || д.дурно > 0 || д.бледность > 0.65;
    const wobble = { x: Math.sin(сейчас / 230) * дрожь, y: Math.cos(сейчас / 310) * дрожь };
    if (нажата) {
      if (опасно && отпуститьВ == null) отпуститьВ = сейчас + реакц();
      if (отпуститьВ != null && сейчас >= отпуститьВ) {
        событие('pointerup', рукаXY.x, рукаXY.y, window);
        нажата = false;
        отпуститьВ = null;
        continue;
      }
      if (!д.ведёт) { // линия кончилась или игла соскочила
        событие('pointerup', рукаXY.x, рукаXY.y, window);
        нажата = false;
        continue;
      }
      // целимся на несколько точек вперёд по наметке, какой она была миг назад
      const тч = видно.точки ?? д.точки;
      const цель = тч[Math.min(тч.length - 1, д.i + 4)];
      const dx = цель.x - рукаXY.x;
      const dy = цель.y - рукаXY.y;
      const L = Math.hypot(dx, dy) || 1;
      const шаг = Math.min(L, скорость * dt);
      рукаXY.x += dx / L * шаг;
      рукаXY.y += dy / L * шаг;
      событие('pointermove', рукаXY.x + wobble.x + гаусс() * шум, рукаXY.y + wobble.y + гаусс() * шум);
    } else {
      if (опасно) { нажатьВ = null; continue; }
      if (нажатьВ == null) нажатьВ = сейчас + реакц();
      const м = д.точки[д.i];
      // рука подходит к метке
      const dx = м.x - рукаXY.x;
      const dy = м.y - рукаXY.y;
      const L = Math.hypot(dx, dy) || 1;
      const шаг = Math.min(L, скорость * 3 * dt);
      рукаXY.x += dx / L * шаг;
      рукаXY.y += dy / L * шаг;
      событие('pointermove', рукаXY.x, рукаXY.y);
      if (сейчас >= нажатьВ && L < 6) {
        событие('pointerdown', рукаXY.x + гаусс() * шум, рукаXY.y + гаусс() * шум);
        нажата = true;
        нажатьВ = null;
      }
    }
  }
  if (нажата) событие('pointerup', рукаXY.x, рукаXY.y, window);
  await пуск;
  const [, уровень, очки] = (document.body.dataset.исход || '::').split(':');
  return { вариант, навык, уровень, очки: Number(очки), ...(() => { const д = поле()?.отладка?.() ?? {}; return { кляксы: д.кляксы, морщины: д.морщины, соскоки: д.соскоки }; })() };
}

// Руки людей: точная (осторожный, медленный), средняя, грубая (торопится, дрожит).
export const РУКИ = {
  точная: { скорость: 150, дрожь: 3, шум: 1.2 },
  средняя: { скорость: 170, дрожь: 4, шум: 1.6 },
  грубая: { скорость: 200, дрожь: 5, шум: 2 },
};

export async function серия({ варианты, навыки = [0], раз = 3, руки = ['средняя'], ускорение = 1 } = {}) {
  подогнатьЧасы(ускорение);
  const итог = [];
  for (const вариант of варианты) for (const навык of навыки) for (const рука of руки) for (let k = 0; k < раз; k++) {
    итог.push({ рука, ...(await партия({ вариант, навык, рука: РУКИ[рука] })) });
    window.__итогиИглы = итог;
  }
  return итог;
}

// Сводка: сколько раз какой уровень по варианту, навыку и руке.
export const сводка = итог => {
  const т = {};
  for (const р of итог) {
    const к = `${р.вариант} · навык ${р.навык} · ${р.рука}`;
    (т[к] ??= { плохо: 0, нормально: 0, отлично: 0, очки: [] })[р.уровень]++;
    т[к].очки.push(р.очки);
  }
  return т;
};
