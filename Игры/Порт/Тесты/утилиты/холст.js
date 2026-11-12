// Живая игра песочницы без браузера: заглушки DOM, холста и кадров, чтобы бот играл партию в node.
// Рисование уходит в пустоту, время идёт кадрами по команде. Звук всегда выключен (тихо: true).
// const и = await партия(модуль, { навык, вариант }); и.кадр(1/60); и.клавиша('Space', true); … await и.итог
const пусто = () => {};
function холст2d() {
  const хран = { globalAlpha: 1 };
  const методы = {
    getTransform: () => ({ a: 1, b: 0 }),
    createLinearGradient: () => ({ addColorStop: пусто }),
    createRadialGradient: () => ({ addColorStop: пусто }),
    measureText: s => ({ width: String(s).length * 8 }),
  };
  return new Proxy(хран, {
    get: (_, к) => (к in хран ? хран[к] : методы[к] ?? пусто),
    set: (_, к, v) => { хран[к] = v; return true; },
  });
}

class Узел {
  constructor(тег) {
    this.тег = тег; this.дети = []; this.слушатели = {}; this.style = {}; this.dataset = {};
    this.className = ''; this.textContent = ''; this.innerHTML = ''; this.isConnected = true; this.width = 960; this.height = 540;
  }
  append(...д) { for (const x of д) { x.родитель = this; this.дети.push(x); } }
  replaceChildren() { this.дети = []; }
  remove() { const р = this.родитель; if (р) р.дети = р.дети.filter(x => x !== this); }
  addEventListener(т, f) { (this.слушатели[т] ??= []).push(f); }
  removeEventListener(т, f) { this.слушатели[т] = (this.слушатели[т] ?? []).filter(x => x !== f); }
  событие(т, e) { for (const f of [...(this.слушатели[т] ?? [])]) f(e); }
  focus() {} setPointerCapture() {} setAttribute() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; }
  getContext() { return (this.ctx ??= холст2d()); }
  найти(класс) { if (this.className === класс) return this; for (const д of this.дети) { const x = д.найти?.(класс); if (x) return x; } return null; }
}

let часы = 0;
let очередь = null;
const окно = new Узел('window');
function поставить() {
  if (globalThis.__холст) return;
  globalThis.__холст = true;
  globalThis.HTMLElement = Узел;
  globalThis.document = { createElement: т => new Узел(т), head: new Узел('head'), fonts: undefined };
  globalThis.window = globalThis;
  globalThis.addEventListener = (т, f) => окно.addEventListener(т, f);
  globalThis.removeEventListener = (т, f) => окно.removeEventListener(т, f);
  globalThis.devicePixelRatio = 1;
  globalThis.Image = class { set src(_) { setTimeout(() => this.onerror?.(), 0); } };
  globalThis.requestAnimationFrame = cb => { очередь = cb; return 1; };
  globalThis.cancelAnimationFrame = () => { очередь = null; };
  try { performance.now = () => часы; } catch { /* старый node */ }
  Object.defineProperty(globalThis, 'performance', { value: { now: () => часы }, configurable: true });
}

const ждать = (мс = 0) => new Promise(r => setTimeout(r, мс));

export async function партия(модуль, { навык = 0, вариант } = {}) {
  поставить();
  const место = new Узел('div');
  let итог = null;
  const обещание = модуль.запустить(место, { навык, тихо: true, вариант }).then(р => (итог = р));
  // дождаться заставки и нажать «Начать»
  for (let i = 0; i < 50 && !место.найти('пс-старт'); i++) await ждать(0);
  окно.событие('keydown', { code: 'Enter', repeat: false, preventDefault: пусто, target: null });
  for (let i = 0; i < 50 && !очередь; i++) await ждать(0);
  const холст = место.найти('пс-холст');
  const поле = globalThis.пс.поле;
  const и = {
    поле,
    get итог() { return итог; },
    get конец() { return поле.кончено || !!итог; },
    отладка: () => поле.отладка?.(),
    кадр(dt = 1 / 60) {
      if (!очередь) return;
      часы += dt * 1000;
      const cb = очередь; очередь = null; cb(часы);
    },
    клавиша(код, вниз = true) {
      окно.событие(вниз ? 'keydown' : 'keyup', { code: код, repeat: false, preventDefault: пусто, target: null });
    },
    мышь(тип, x, y, button = 0) {
      const e = { clientX: x, clientY: y, button, pointerId: 1, preventDefault: пусто };
      if (тип === 'вниз') холст.событие('pointerdown', e);
      else if (тип === 'двиг') холст.событие('pointermove', e);
      else окно.событие('pointerup', e);
    },
    // крутить кадры, пока игра не кончится (или не выйдет время), вызывая бота перед каждым кадром
    async доКонца(бот, { dt = 1 / 60, предел = 400 } = {}) {
      for (let t = 0; t < предел && !поле.кончено; t += dt) { бот?.(и, t); и.кадр(dt); }
      await обещание.catch(() => null);
      return итог;
    },
  };
  return и;
}
