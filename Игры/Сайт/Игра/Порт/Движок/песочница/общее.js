// Песочница мини-игр: общий слой живых прототипов — холст, ввод, цикл, отклик (вспышка, дрожь,
// всплывающие слова, кольца, искры) и тихий звук на WebAudio.
// Каждая игра — модуль с запустить(контейнер, { навык, тихо, сигнал }) → Promise<{ уровень, очки }>,
// поэтому её можно поставить живым слоем поверх логики настоящей мини-игры.

export const НАВЫКИ = ['нет', 'умеешь', 'набил руку'];
export const ШИР = 960;
export const ВЫС = 540;
export const ЦВЕТ = {
  ночь: '#0a1013', смола: '#10181b', бумага: '#efe3c9', бумага2: '#cbbd9e', тихо: '#8f978f',
  свеча: '#e7b263', море: '#93c7c2', ржа: '#e07f62', трава: '#aac98b', чернила: '#1a1309',
  линия: 'rgba(226,198,146,.17)', линияЯрко: 'rgba(226,198,146,.45)',
};
export const ШРИФТ = {
  текст: "'Alegreya', Georgia, serif",
  метка: "'Alegreya SC', Georgia, serif",
  титул: "'Cormorant', 'Alegreya', Georgia, serif",
};

export const ограничить = (v, a, b) => Math.max(a, Math.min(b, v));
export const смешать = (a, b, t) => a + (b - a) * t;
export const случайно = (a, b) => a + Math.random() * (b - a);
export const выбрать = список => список[Math.floor(Math.random() * список.length)];

// Навык героя: 0 — нет, 1 — умеешь, 2 — набил руку. Принимает и число, и слово.
export function ступеньНавыка(н) {
  if (typeof н === 'number') return ограничить(Math.round(н), 0, 2);
  const i = НАВЫКИ.indexOf(н);
  return i < 0 ? 0 : i;
}

export function уровеньПо(очки, пороги = [0.45, 0.78]) {
  return очки >= пороги[1] ? 'отлично' : очки >= пороги[0] ? 'нормально' : 'плохо';
}

// ---------- звук ----------

export const звук = { тихо: false, громкость: 0.12 };
let аудио = null;
let мастер = null;
let шумБуфер = null;

function ак() {
  if (звук.тихо) return null;
  try {
    if (!аудио) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      аудио = new AC();
      мастер = аудио.createGain();
      мастер.connect(аудио.destination);
    }
    if (аудио.state === 'suspended') аудио.resume();
    мастер.gain.value = звук.громкость;
    return аудио;
  } catch {
    return null;
  }
}

function огибающая(a, узел, когда, громк, длит) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, когда);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, громк), когда + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, когда + длит);
  узел.connect(g);
  g.connect(мастер);
}

export function тон(f, { длит = 0.18, тип = 'triangle', громк = 0.6, через = 0, к = null } = {}) {
  const a = ак();
  if (!a) return;
  const t = a.currentTime + Math.max(0, через);
  const o = a.createOscillator();
  o.type = тип;
  o.frequency.setValueAtTime(f, t);
  if (к) o.frequency.exponentialRampToValueAtTime(к, t + длит);
  огибающая(a, o, t, громк, длит);
  o.start(t);
  o.stop(t + длит + 0.05);
}

export function шум({ длит = 0.06, громк = 0.4, через = 0, частота = 3000, вид = 'highpass' } = {}) {
  const a = ак();
  if (!a) return;
  const t = a.currentTime + Math.max(0, через);
  if (!шумБуфер) {
    шумБуфер = a.createBuffer(1, Math.floor(a.sampleRate * 0.5), a.sampleRate);
    const d = шумБуфер.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = a.createBufferSource();
  s.buffer = шумБуфер;
  const ф = a.createBiquadFilter();
  ф.type = вид;
  ф.frequency.value = частота;
  s.connect(ф);
  огибающая(a, ф, t, громк, длит);
  s.start(t);
  s.stop(t + длит + 0.05);
}

// Голос: мягкий тон с вибрато и медленной атакой — Нора, зал, подпевка. Для музыки на фоне.
export function голос(f, { длит = 0.5, через = 0, громк = 0.3, яркость = 1600, тип = 'triangle', вибрато = 0.006 } = {}) {
  const a = ак();
  if (!a) return;
  const t = a.currentTime + Math.max(0, через);
  const o = a.createOscillator();
  o.type = тип;
  o.frequency.setValueAtTime(f, t);
  const лфо = a.createOscillator();
  лфо.frequency.value = 5.2;
  const глубина = a.createGain();
  глубина.gain.setValueAtTime(0, t);
  глубина.gain.linearRampToValueAtTime(f * вибрато, t + Math.min(0.25, длит * 0.6));
  лфо.connect(глубина);
  глубина.connect(o.frequency);
  const ф = a.createBiquadFilter();
  ф.type = 'lowpass';
  ф.frequency.value = яркость;
  o.connect(ф);
  const g = a.createGain();
  const атака = Math.min(0.06, длит * 0.3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, громк), t + атака);
  g.gain.setValueAtTime(Math.max(0.0002, громк), t + длит * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + длит);
  ф.connect(g);
  g.connect(мастер);
  o.start(t);
  лфо.start(t);
  o.stop(t + длит + 0.05);
  лфо.stop(t + длит + 0.05);
}

export const звуки = {
  удар: (через = 0, громк = 0.9) => тон(110, { к: 45, длит: 0.22, тип: 'sine', громк, через }),
  хлоп: (через = 0) => шум({ длит: 0.035, громк: 0.18, через, частота: 6500 }),
  струна: (f, громк = 0.5) => {
    тон(f, { длит: 0.55, тип: 'triangle', громк });
    тон(f * 2, { длит: 0.22, тип: 'sine', громк: громк * 0.3 });
  },
  мимо: () => {
    тон(150, { к: 80, длит: 0.2, тип: 'sawtooth', громк: 0.16 });
    шум({ длит: 0.09, громк: 0.2, частота: 500, вид: 'lowpass' });
  },
  звон: (f = 1320) => {
    тон(f, { длит: 0.4, тип: 'sine', громк: 0.32 });
    тон(f * 1.5, { длит: 0.22, тип: 'sine', громк: 0.12 });
  },
  стук: () => {
    тон(260, { к: 140, длит: 0.08, тип: 'square', громк: 0.12 });
    шум({ длит: 0.04, громк: 0.28, частота: 1800, вид: 'bandpass' });
  },
  штамп: () => {
    тон(95, { к: 50, длит: 0.16, тип: 'sine', громк: 0.8 });
    шум({ длит: 0.07, громк: 0.35, частота: 900, вид: 'lowpass' });
  },
  тик: (громк = 0.1) => шум({ длит: 0.015, громк, частота: 7000 }),
  ох: () => тон(420, { к: 300, длит: 0.25, тип: 'sine', громк: 0.18 }),
  ура: () => [0, 0.09, 0.18].forEach((через, i) => тон([660, 830, 990][i], { длит: 0.3, тип: 'triangle', громк: 0.3, через })),
};

// ---------- картинки и рисование ----------

const кэш = new Map();
// Путь — от папки Игры/Порт/ (например 'Ресурсы/Районы/доки.webp'), чтобы модуль работал откуда угодно.
export function картинка(путь) {
  const url = new URL('../../' + путь, import.meta.url).href;
  if (!кэш.has(url)) {
    кэш.set(url, new Promise(готово => {
      const i = new Image();
      i.onload = () => готово(i);
      i.onerror = () => готово(null);
      i.src = url;
    }));
  }
  return кэш.get(url);
}

export function фон(ctx, img, тёмно = 0.55, сдвиг = 0) {
  ctx.fillStyle = ЦВЕТ.ночь;
  ctx.fillRect(0, 0, ШИР, ВЫС);
  if (img) {
    const к = Math.max(ШИР / img.width, ВЫС / img.height) * 1.04;
    const w = img.width * к;
    const h = img.height * к;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, (ШИР - w) / 2 + сдвиг, (ВЫС - h) / 2, w, h);
    ctx.imageSmoothingEnabled = true;
  }
  ctx.fillStyle = `rgba(10,16,19,${тёмно})`;
  ctx.fillRect(0, 0, ШИР, ВЫС);
}

// Портрет без мыла: картинку обрезаем под рамку (верх лица важнее) и заранее ужимаем ступенями
// до настоящего числа пикселей экрана, потом кладём один к одному.
const ужатые = new WeakMap();
export function портрет(ctx, img, x, y, w, h, { верх = 0.08 } = {}) {
  if (!img) return;
  const м = ctx.getTransform();
  const к = Math.hypot(м.a, м.b) || 1;
  const пw = Math.max(1, Math.round(w * к));
  const пh = Math.max(1, Math.round(h * к));
  let набор = ужатые.get(img);
  if (!набор) ужатые.set(img, (набор = new Map()));
  const ключ = пw + 'x' + пh;
  let готово = набор.get(ключ);
  if (!готово) {
    // вырез с теми же пропорциями, что рамка
    let sw = img.width;
    let sh = sw * h / w;
    if (sh > img.height) { sh = img.height; sw = sh * w / h; }
    const sx = (img.width - sw) / 2;
    const sy = Math.min(img.height - sh, img.height * верх);
    let src = img;
    let [cx, cy, cw, ch] = [sx, sy, sw, sh];
    while (cw / 2 >= пw) {
      const c = document.createElement('canvas');
      c.width = Math.round(cw / 2);
      c.height = Math.round(ch / 2);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, cx, cy, cw, ch, 0, 0, c.width, c.height);
      [src, cx, cy, cw, ch] = [c, 0, 0, c.width, c.height];
    }
    готово = document.createElement('canvas');
    готово.width = пw;
    готово.height = пh;
    const g = готово.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, cx, cy, cw, ch, 0, 0, пw, пh);
    набор.set(ключ, готово);
  }
  const было = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(готово, x, y, w, h);
  ctx.imageSmoothingEnabled = было;
}

export function надпись(ctx, s, x, y, { р = 20, цвет = ЦВЕТ.бумага, выр = 'center', шрифт = ШРИФТ.текст, вес = 400, тень = true, база = 'middle' } = {}) {
  ctx.font = `${вес} ${р}px ${шрифт}`;
  ctx.textAlign = выр;
  ctx.textBaseline = база;
  if (тень) {
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillText(s, x + 1.5, y + 2);
  }
  ctx.fillStyle = цвет;
  ctx.fillText(s, x, y);
}

export function плашка(ctx, x, y, w, h, { заливка = 'rgba(13,19,22,.82)', обвод = ЦВЕТ.линияЯрко } = {}) {
  ctx.fillStyle = заливка;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = обвод;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function полоса(ctx, x, y, w, h, доля, цвет = ЦВЕТ.свеча) {
  ctx.fillStyle = 'rgba(255,236,200,.08)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = цвет;
  ctx.fillRect(x, y, w * ограничить(доля, 0, 1), h);
  ctx.strokeStyle = ЦВЕТ.линия;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// Свет свечи: тёплое пятно поверх сцены.
export function свет(ctx, x, y, r, сила = 0.35, цвет = '231,178,99') {
  const г = ctx.createRadialGradient(x, y, 0, x, y, r);
  г.addColorStop(0, `rgba(${цвет},${сила})`);
  г.addColorStop(1, `rgba(${цвет},0)`);
  ctx.fillStyle = г;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---------- поле ----------

function эл(тег, класс) {
  const e = document.createElement(тег);
  if (класс) e.className = класс;
  return e;
}

export function создатьПоле(контейнер, { подсказка = '', сигнал } = {}) {
  контейнер.replaceChildren();
  const корень = эл('div', 'пс-игра');
  const строка = эл('div', 'пс-подсказка');
  строка.textContent = подсказка;
  const рамка = эл('div', 'пс-рамка');
  const холст = эл('canvas', 'пс-холст');
  холст.tabIndex = 0;
  const слой = эл('div', 'пс-слой');
  рамка.append(холст, слой);
  корень.append(строка, рамка);
  контейнер.append(корень);

  // Холст рисуется в настоящем разрешении экрана: логика — 960×540, а пикселей столько,
  // сколько рамка занимает на мониторе (× devicePixelRatio). Иначе браузер растягивает картинку — мыло.
  const ctx = холст.getContext('2d');
  let масштаб = 1;
  let статичный = null;
  function подогнать() {
    const ш = холст.getBoundingClientRect().width || ШИР;
    const w = Math.max(ШИР / 2, Math.round(ш * (window.devicePixelRatio || 1)));
    const h = Math.round(w * ВЫС / ШИР);
    if (холст.width === w && холст.height === h) return false;
    холст.width = w;
    холст.height = h;
    масштаб = w / ШИР;
    return true;
  }
  подогнать();
  const наблюдатель = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (!холст.isConnected) return наблюдатель.disconnect();
    if (подогнать() && !живо) перерисовать();
  }) : null;
  наблюдатель?.observe(холст);
  document.fonts?.ready?.then(() => { if (!живо) перерисовать(); });
  function перерисовать() {
    if (!холст.isConnected) return;
    ctx.setTransform(масштаб, 0, 0, масштаб, 0, 0);
    if (игра) игра.нарисовать?.(ctx, поле.t);
    else статичный?.(ctx, 0);
  }

  const мышь = { x: ШИР / 2, y: ВЫС / 2, нажата: false, внутри: false };
  const клавиши = new Set();
  const снятия = [];
  const слушать = (цель, тип, fn, о) => {
    цель.addEventListener(тип, fn, о);
    снятия.push(() => цель.removeEventListener(тип, fn, о));
  };
  const точка = e => {
    const r = холст.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * ШИР, y: (e.clientY - r.top) / r.height * ВЫС };
  };

  let игра = null;
  let живо = false;
  let раф = 0;
  let последний = 0;
  let развязка = null;
  let отказ = null;
  let пороги;
  const эф = { вспышки: [], слова: [], кольца: [], искры: [], дрожь: 0 };

  const поле = {
    ctx, холст, слой, мышь, клавиши, t: 0,
    подсказка(s) { строка.textContent = s; },
    вспышка(цвет = ЦВЕТ.свеча, сила = 0.22) { эф.вспышки.push({ цвет, сила, жизнь: 1 }); },
    дрожь(с = 6) { эф.дрожь = Math.max(эф.дрожь, с); },
    слово(текст, x, y, цвет = ЦВЕТ.бумага, р = 26) { эф.слова.push({ текст, x, y, цвет, р, жизнь: 1 }); },
    кольцо(x, y, цвет = ЦВЕТ.свеча, r1 = 60) { эф.кольца.push({ x, y, цвет, r1, жизнь: 1 }); },
    искры(x, y, цвет = ЦВЕТ.свеча, n = 12) {
      for (let i = 0; i < n; i++) {
        const у = Math.random() * Math.PI * 2;
        const с = случайно(80, 260);
        эф.искры.push({ x, y, vx: Math.cos(у) * с, vy: Math.sin(у) * с - 60, цвет, жизнь: 1 });
      }
    },
    // Один кадр без хода игры — показать сцену под заставкой.
    кадр(рис) {
      статичный = рис;
      ctx.setTransform(масштаб, 0, 0, масштаб, 0, 0);
      рис(ctx, 0);
    },
    get масштаб() { return масштаб; },
    старт({ заголовок, строка: текст = '', кнопки = [{ текст: 'Начать', значение: true }] }) {
      return new Promise((готово, нет) => {
        отказ = нет;
        const панель = эл('div', 'пс-старт');
        const h = эл('h2');
        h.textContent = заголовок;
        const p = эл('p');
        p.textContent = текст;
        const ряд = эл('div', 'пс-кнопки');
        const выбрать = значение => {
          window.removeEventListener('keydown', клав, true);
          панель.remove();
          отказ = null;
          холст.focus({ preventScroll: true });
          ак();
          готово(значение);
        };
        const клав = e => {
          if (e.code === 'Enter' || e.code === 'Space') {
            e.preventDefault();
            выбрать(кнопки[0].значение);
          }
        };
        for (const к of кнопки) {
          const b = эл('button', 'пс-кн');
          b.innerHTML = к.текст;
          b.addEventListener('click', () => выбрать(к.значение));
          ряд.append(b);
        }
        панель.append(h, p, ряд);
        слой.append(панель);
        window.addEventListener('keydown', клав, true);
        снятия.push(() => window.removeEventListener('keydown', клав, true));
      });
    },
    играть(новая, п = [0.45, 0.78]) {
      игра = новая;
      пороги = п;
      поле.кончено = false;
      живо = true;
      поле.t = 0;
      последний = performance.now();
      подключитьВвод();
      раф = requestAnimationFrame(кадр);
      return new Promise((готово, нет) => {
        развязка = готово;
        отказ = нет;
      });
    },
    конец(очки) {
      if (!живо || поле.кончено) return;
      поле.кончено = true;
      очки = ограничить(Math.round(очки * 100) / 100, 0, 1);
      // Последний кадр с эффектами дорисовываем, потом гасим цикл.
      setTimeout(() => {
        остановить();
        развязка?.({ уровень: уровеньПо(очки, пороги), очки });
      }, 450);
    },
  };

  function подключитьВвод() {
    слушать(холст, 'pointerdown', e => {
      const p = точка(e);
      Object.assign(мышь, p, { нажата: true, внутри: true });
      try { холст.setPointerCapture(e.pointerId); } catch { /* не всегда можно */ }
      холст.focus({ preventScroll: true });
      игра?.мышьВниз?.(p.x, p.y, e.button);
      e.preventDefault();
    });
    слушать(холст, 'pointermove', e => {
      const p = точка(e);
      Object.assign(мышь, p, { внутри: p.x >= 0 && p.y >= 0 && p.x <= ШИР && p.y <= ВЫС });
      игра?.мышьДвиг?.(p.x, p.y);
    });
    слушать(window, 'pointerup', e => {
      if (!мышь.нажата) return;
      мышь.нажата = false;
      const p = точка(e);
      игра?.мышьВверх?.(p.x, p.y, e.button);
    });
    слушать(холст, 'pointerleave', () => { мышь.внутри = false; });
    слушать(холст, 'contextmenu', e => e.preventDefault());
    слушать(window, 'keydown', e => {
      if (e.target instanceof HTMLElement && e.target.matches('input, select, textarea')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      клавиши.add(e.code);
      игра?.клавиша?.(e.code, e);
    });
    слушать(window, 'keyup', e => {
      клавиши.delete(e.code);
      игра?.клавишаВверх?.(e.code, e);
    });
    слушать(window, 'blur', () => {
      клавиши.clear();
      if (мышь.нажата) {
        мышь.нажата = false;
        игра?.мышьВверх?.(мышь.x, мышь.y, 0);
      }
    });
  }

  function кадр(сейчас) {
    if (!живо) return;
    // Время игры идёт по настоящим часам: редкие кадры догоняются мелкими шагами,
    // чтобы физика (стрелка весов, качание) не разлеталась. Дольше полсекунды — пауза.
    let прошло = Math.min(0.5, Math.max(0, (сейчас - последний) / 1000));
    последний = сейчас;
    const всего = прошло;
    while (прошло > 1e-4 && живо && !поле.кончено) {
      const шаг = Math.min(1 / 60, прошло);
      прошло -= шаг;
      поле.t += шаг;
      игра.обновить?.(шаг, поле.t);
    }
    отрисовать(всего);
    if (живо) раф = requestAnimationFrame(кадр);
  }

  function отрисовать(dt) {
    ctx.setTransform(масштаб, 0, 0, масштаб, 0, 0);
    const д = эф.дрожь;
    эф.дрожь = Math.max(0, д - dt * 45);
    ctx.save();
    if (д > 0.2) ctx.translate((Math.random() * 2 - 1) * д, (Math.random() * 2 - 1) * д);
    игра.нарисовать?.(ctx, поле.t);
    ctx.restore();

    for (const к of эф.кольца) {
      к.жизнь -= dt * 2.4;
      const r = смешать(8, к.r1, 1 - к.жизнь);
      ctx.strokeStyle = к.цвет;
      ctx.globalAlpha = Math.max(0, к.жизнь);
      ctx.lineWidth = 3 * к.жизнь + 1;
      ctx.beginPath();
      ctx.arc(к.x, к.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const и of эф.искры) {
      и.жизнь -= dt * 1.8;
      и.vy += 420 * dt;
      и.x += и.vx * dt;
      и.y += и.vy * dt;
      ctx.globalAlpha = Math.max(0, и.жизнь);
      ctx.fillStyle = и.цвет;
      ctx.fillRect(и.x - 1.5, и.y - 1.5, 3, 3);
    }
    for (const с of эф.слова) {
      с.жизнь -= dt * 1.1;
      ctx.globalAlpha = ограничить(с.жизнь * 1.6, 0, 1);
      const пр = 1 + Math.max(0, с.жизнь - 0.8) * 1.5;
      надпись(ctx, с.текст, с.x, с.y - (1 - с.жизнь) * 40, { р: с.р * пр, цвет: с.цвет, вес: 700 });
    }
    for (const в of эф.вспышки) {
      в.жизнь -= dt * 4;
      ctx.globalAlpha = Math.max(0, в.жизнь) * в.сила;
      ctx.fillStyle = в.цвет;
      ctx.fillRect(0, 0, ШИР, ВЫС);
    }
    ctx.globalAlpha = 1;
    эф.кольца = эф.кольца.filter(к => к.жизнь > 0);
    эф.искры = эф.искры.filter(и => и.жизнь > 0);
    эф.слова = эф.слова.filter(с => с.жизнь > 0);
    эф.вспышки = эф.вспышки.filter(в => в.жизнь > 0);
  }

  function остановить() {
    живо = false;
    cancelAnimationFrame(раф);
    while (снятия.length) снятия.pop()();
    мышь.нажата = false;
    клавиши.clear();
  }

  // Для проверки из консоли: window.пс.поле.отладка?.() — состояние игры, если она его отдаёт.
  window.пс = { поле };

  сигнал?.addEventListener('abort', () => {
    остановить();
    наблюдатель?.disconnect();
    отказ?.(new DOMException('Игра прервана', 'AbortError'));
  }, { once: true });

  return поле;
}
