// Пролог (третья версия, 12.11) — без видео: один пиксельный кадр прибытия «оживает», текст — как в комиксе.
// Данные — Данные/вступление.js, поле пролог.
//
// Монтаж: кадр баржи проявляется из темноты (вода колышется, камера медленно подходит) → подписи рассказа →
// окрик грузчика облаком с его головой → бросок швартова (физика каната) → камера подходит к причалу,
// разговор облаками → «Ты не знал.» в темноте → выбор начала.
//
// Кадр рисуется в холст в половинном разрешении (836 × 470) крупным пикселем, как есть, без фильтров.
// «Живая вода»: пиксели воды (синие и отражения огней) построчно сдвигаются по синусу, 12 кадров в секунду —
// обычный приём пиксельной графики. Канат — отдельный холст 418 × 235 поверх, координаты кадра 1672 × 941.
// Касание / пробел / Enter — дальше; Esc или «Пропустить» — к выбору. «Меньше движения» — вода и камера стоят.
import { ВСТУПЛЕНИЕ } from '../Данные/вступление.js';
import { путьРесурса } from './задник.js';
import { музыка, звук } from './звук.js';
import { настройкиИнтерфейса } from './настройки-интерфейса.js';

const П = ВСТУПЛЕНИЕ.пролог;
const ждать = мс => new Promise(r => setTimeout(r, мс));

const ВШ = 836, ВВ = 470, НШ = 418, НВ = 235, М = НШ / 1672;
// Бросок: рука героя и верх тумбы на кадре прибытия; вода, настил причала и ближний борт баржи.
const РУКА = { x: 486, y: 636 }, ТУМБА = { x: 1282, y: 532 };
const водаНа = x => (x < 560 || x > 1188 ? 9999 : 596), настилНа = x => (x > 1188 ? 528 : 9999);
const бортНа = x => (x < 470 || x > 1188 ? 9999 : x < 700 ? 612 : 612 + (x - 700) * 0.4);

// Маска воды на кадре в половинном разрешении: синее ниже горизонта и светлые отражения огней между синим.
const ГОРИЗОНТ = 232;
function маскаВоды(д) {
  const п = д.data, м = new Uint8Array(ВШ * ВВ);
  for (let y = ГОРИЗОНТ; y < ВВ; y++) for (let x = 0; x < ВШ; x++) {
    const i = (y * ВШ + x) * 4;
    if (п[i + 2] > п[i] + 12 && п[i + 2] >= п[i + 1]) м[y * ВШ + x] = 1;
  }
  for (let y = ГОРИЗОНТ; y < ВВ; y++) for (let x = 0; x < ВШ; x++) {
    const j = y * ВШ + x, i = j * 4;
    if (м[j] || !(п[i] > 140 && п[i] > п[i + 2])) continue;
    let слева = false, справа = false;
    for (let k = 1; k <= 12 && !(слева && справа); k++) { if (x - k >= 0 && м[j - k] === 1) слева = true; if (x + k < ВШ && м[j + k] === 1) справа = true; }
    if (слева && справа) м[j] = 2;
  }
  return м;
}

export function рендерПролог(onДальше) {
  const тихо = настройкиИнтерфейса().движение === 'меньше';
  музыка(null);
  const ов = document.createElement('div');
  ов.className = 'пролог';
  ов.innerHTML = `
    <button class="пролог-пропуск" type="button">Пропустить ›</button>
    <div class="пролог-кадр">
      <div class="пролог-камера">
        <canvas class="пролог-экран" width="${ВШ}" height="${ВВ}"></canvas>
        <canvas class="пролог-канат" width="${НШ}" height="${НВ}"></canvas>
      </div>
      <div class="пролог-шторка темно"></div>
      <div class="пролог-подпись" hidden></div>
      <div class="пролог-облако" hidden><div class="пролог-лицо"></div><div class="пролог-речь"><b></b><p></p></div><i class="пролог-ещё" aria-hidden="true">▸</i></div>
      <div class="пролог-замах" hidden><div class="пролог-замах-зона"></div><div class="пролог-замах-сила"></div></div>
      <div class="пролог-совет" hidden></div>
    </div>
    <div class="пролог-тьма" hidden></div>`;
  document.body.appendChild(ов);
  const $ = с => ов.querySelector(с);
  const кЭ = $('.пролог-экран').getContext('2d', { willReadFrequently: true });
  const кК = $('.пролог-канат').getContext('2d');
  const камера = $('.пролог-камера'), шторка = $('.пролог-шторка');
  const подпись = $('.пролог-подпись'), облако = $('.пролог-облако'), совет = $('.пролог-совет'), тьма = $('.пролог-тьма');

  let конец = false, ждём = null;

  // ── кадр и живая вода ──
  let исходник = null, маска = null, вывод = null;
  const кадр = new Image();
  кадр.onload = () => {
    кЭ.imageSmoothingEnabled = false;
    кЭ.drawImage(кадр, 0, 0, ВШ, ВВ);
    исходник = кЭ.getImageData(0, 0, ВШ, ВВ);
    маска = маскаВоды(исходник);
    вывод = new ImageData(new Uint8ClampedArray(исходник.data), ВШ, ВВ);
  };
  кадр.src = путьРесурса(П.кадр);
  let прошлыйКадр = 0;
  const вода = сейчас => {
    if (конец) return;
    if (исходник && !тихо && сейчас - прошлыйКадр > 80) { // ~12 кадров в секунду: так рисованная вода и живёт
      прошлыйКадр = сейчас;
      const t = сейчас / 1000, с = исходник.data, в = вывод.data;
      for (let y = ГОРИЗОНТ; y < ВВ; y++) {
        const глубь = (y - ГОРИЗОНТ) / (ВВ - ГОРИЗОНТ), сдвиг = Math.round(Math.sin(y * 0.55 + t * 3.1) * (0.6 + глубь * 1.6));
        for (let x = 0, j = y * ВШ; x < ВШ; x++, j++) {
          if (!маска[j]) continue;
          const xs = x + сдвиг, ист = сдвиг && xs >= 0 && xs < ВШ && маска[j + сдвиг] ? j + сдвиг : j, i = j * 4, k = ист * 4;
          в[i] = с[k]; в[i + 1] = с[k + 1]; в[i + 2] = с[k + 2];
        }
      }
      кЭ.putImageData(вывод, 0, 0);
    }
    requestAnimationFrame(вода);
  };
  requestAnimationFrame(вода);

  // ── управление: «вниз» и «вверх» — касание/кнопка нажата и отпущена ──
  const нажатие = e => {
    if (конец) return;
    if (e.type === 'keydown') {
      if (e.key === 'Escape') { e.preventDefault(); return закончить(); }
      if (![' ', 'Enter'].includes(e.key)) return;
      e.preventDefault(); if (e.repeat) return;
    } else if (e.target.closest('.пролог-пропуск')) return;
    ждём?.('вниз');
  };
  const отпуск = e => {
    if (конец) return;
    if (e.type === 'keyup') { if (![' ', 'Enter'].includes(e.key)) return; e.preventDefault(); }
    ждём?.('вверх');
  };
  ов.addEventListener('pointerdown', нажатие);
  ов.addEventListener('pointerup', отпуск);
  document.addEventListener('keydown', нажатие, true);
  document.addEventListener('keyup', отпуск, true);
  $('.пролог-пропуск').onclick = () => закончить();

  function закончить() {
    if (конец) return;
    конец = true;
    document.removeEventListener('keydown', нажатие, true);
    document.removeEventListener('keyup', отпуск, true);
    ов.classList.add('уходит');
    setTimeout(() => { ов.remove(); onДальше(); }, 600);
  }

  // ── текст как в комиксе: подпись рассказа — плашка в углу кадра; реплика — облако с головой говорящего ──
  const появись = el => { el.classList.remove('появись'); void el.offsetWidth; el.classList.add('появись'); };
  const скрытьТекст = () => { подпись.hidden = true; облако.hidden = true; };
  const рассказ = т => { облако.hidden = true; подпись.textContent = т; подпись.hidden = false; появись(подпись); };
  const реплика = (кто, т) => {
    подпись.hidden = true;
    const г = П.голоса[кто];
    $('.пролог-лицо').style.backgroundImage = г?.лицо ? `url("${путьРесурса(г.лицо)}")` : '';
    $('.пролог-речь b').textContent = г?.имя ?? '';
    $('.пролог-речь p').textContent = т;
    облако.hidden = false; появись(облако);
  };
  const строка = р => (р.кто ? реплика(р.кто, р.т) : рассказ(р.т));
  // Ждать касания: не раньше мин мс (чтобы не пролистнуть случайно); сам — через мс, если задано.
  const касание = (мс = 0, мин = 450) => new Promise(r => {
    const т0 = performance.now();
    ов.classList.add('ждёт');
    let таймер = null;
    const готово = () => { clearTimeout(таймер); ждём = null; ов.classList.remove('ждёт'); r(); };
    if (мс) таймер = setTimeout(готово, мс);
    ждём = к => { if (к === 'вниз' && performance.now() - т0 >= мин) готово(); };
  });
  const затемнить = (да, мс = 600) => { шторка.style.transitionDuration = мс + 'ms'; шторка.classList.toggle('темно', да); return ждать(мс); };
  const наезд = (масштаб, ox, oy, мс) => {
    if (тихо) return;
    камера.style.transformOrigin = `${ox}% ${oy}%`;
    камера.style.transition = `transform ${мс}ms cubic-bezier(.3,.1,.3,1)`;
    камера.style.transform = `translateX(-34%) scale(${масштаб})`; // сдвиг слоя из CSS + наезд
  };

  // ── сцены ──
  async function прибытие() {
    await ждать(400);
    музыка(П.музыка);
    await затемнить(false, 1800);
    наезд(1.06, 30, 60, 26000); // медленно, почти незаметно — к герою
    for (const т of П.рассказ) { if (конец) return; рассказ(т); await касание(); }
  }

  async function бросок() {
    реплика('грузчик', П.бросок.зов);
    await касание(1800, 900);
    if (конец) return;
    облако.hidden = true;
    совет.textContent = П.бросок.подсказка; совет.hidden = false;
    const итог = await канат();
    совет.hidden = true;
    if (конец) return;
    ов.dataset.бросок = итог;
    рассказ(П.бросок[итог]);
    await касание(0, 700);
  }

  async function разговор() {
    наезд(1.32, 80, 52, 9000); // камера подходит к причалу, где стоит грузчик
    for (const р of П.разговор) {
      if (конец) return;
      строка(р);
      if (р.пауза) { ов.classList.add('тишина'); музыка(null); }
      await касание(0, р.пауза ? 1400 : 600);
    }
    скрытьТекст();
    await затемнить(true, 1400);
    тьма.textContent = П.удар; тьма.hidden = false;
    await касание(0, 1500);
  }

  // ── канат: цепочка звеньев (Верле); петля летит по рассчитанной дуге к своей точке, остальное — физика ──
  function канат() {
    return new Promise(готово => {
      const N = 36, L = 1.6 * Math.hypot(ТУМБА.x - РУКА.x, ТУМБА.y - РУКА.y) / (N - 1);
      const т = Array.from({ length: N }, () => ({ x: РУКА.x, y: РУКА.y, px: РУКА.x, py: РУКА.y, вода: false, тумба: false }));
      const g = 2600, h = 1 / 120;
      let фаза = 'бухта', сила = 0, т0 = 0, полёт = 0, итог = null, брызги = [], закрыто = false, дуга = null;
      let первый = N - 3; // звенья первый..N-1 в воздухе, остальные ещё в бухте в руке
      const замах = $('.пролог-замах'), полоса = $('.пролог-замах-сила');
      замах.hidden = false;
      ов.__отл = () => ({ фаза, сила, итог, полёт, первый, конецТ: т[N - 1] }); // для проверки в браузере

      ждём = к => {
        if (к === 'вниз' && фаза === 'бухта') { фаза = 'замах'; т0 = performance.now(); замах.classList.add('идёт'); }
        else if (к === 'вверх' && фаза === 'замах') бросить();
      };
      function бросить() {
        фаза = 'полёт'; ждём = null; замах.classList.remove('идёт'); замах.hidden = true;
        if (typeof ов.__сила === 'number') сила = ов.__сила; // только для проверки в браузере
        // Сила 0,5 — ровно на тумбу; окно ±0,13; меньше — недолёт в воду, больше — перелёт за тумбу.
        итог = Math.abs(сила - 0.5) <= 0.13 ? 'удача' : сила < 0.5 ? 'недолёт' : 'перелёт';
        const цель = итог === 'удача' ? { x: ТУМБА.x, y: ТУМБА.y - 4, tf: 0.95 }
          : итог === 'недолёт' ? { x: РУКА.x + (ТУМБА.x - РУКА.x) * (0.5 + 0.7 * сила), y: водаНа(900) + 3, tf: 0.85 }
          : { x: ТУМБА.x + 70 + 260 * (сила - 0.63), y: настилНа(1300), tf: 1.05 };
        дуга = { tf: цель.tf, vx: (цель.x - РУКА.x) / цель.tf, vy: (цель.y - РУКА.y - 0.5 * g * цель.tf * цель.tf) / цель.tf };
        полёт = 0;
      }
      function всплеск(x, y) {
        звук('всплеск');
        for (let i = 0; i < 22; i++) брызги.push({ x: x + (Math.random() - 0.5) * 20, y, vx: (Math.random() - 0.5) * 360, vy: -240 - Math.random() * 460, ж: 0.45 + Math.random() * 0.4 });
      }
      function физика() {
        const к = т[N - 1], летит = дуга && полёт <= дуга.tf;
        if (летит) {
          const t = Math.min(полёт + h, дуга.tf);
          к.px = к.x; к.py = к.y;
          к.x = РУКА.x + дуга.vx * t; к.y = РУКА.y + дуга.vy * t + 0.5 * g * t * t;
          if (полёт + h >= дуга.tf) {
            if (итог === 'недолёт') { к.вода = true; всплеск(к.x, водаНа(к.x)); к.px = к.x - дуга.vx * h * 0.4; к.py = к.y; }
            else { к.тумба = true; звук('тумба'); } // на тумбе — или за тумбой, где петлю ловит грузчик
            фаза = 'лёг';
          }
        }
        for (let i = первый; i < N; i++) {
          const p = т[i]; if (p.тумба || (i === N - 1 && летит)) continue;
          let vx = (p.x - p.px) * 0.995, vy = (p.y - p.py) * 0.995;
          p.px = p.x; p.py = p.y;
          if (p.вода) { vx *= 0.9; vy = vy * 0.7 + (водаНа(p.x) + 5 + Math.sin(p.x * 0.045 + полёт * 2.2) * 3 - p.y) * 0.05; } else vy += g * h * h;
          p.x += vx; p.y += vy;
          // вода и настил ловят только падающее сверху: бухта у ног лежит ниже линии воды на кадре
          const в = водаНа(p.x), н = настилНа(p.x);
          if (!p.вода && p.y > в && p.py <= в + 1) p.вода = true;
          if (p.вода) p.y = Math.min(p.y, в + 6);
          if (p.y > н && p.py <= н + 1) { p.y = н; p.px = p.x - (p.x - p.px) * 0.4; }
          if (!p.вода && p.y > бортНа(p.x)) { p.y = бортНа(p.x); p.px = p.x - (p.x - p.px) * 0.5; }
        }
        // стравить звено: ближнее к руке отошло дальше длины звена — следующее выходит из бухты
        while (первый > 1 && Math.hypot(т[первый].x - РУКА.x, т[первый].y - РУКА.y) > L) {
          const с = т[первый], н = т[первый - 1], dx = РУКА.x - с.x, dy = РУКА.y - с.y, d = Math.hypot(dx, dy);
          н.x = с.x + dx / d * L; н.y = с.y + dy / d * L; н.px = н.x - (с.x - с.px) * 0.35; н.py = н.y - (с.y - с.py) * 0.35;
          первый--;
        }
        const от = первый <= 1 ? 1 : первый + 1;
        for (let k = 0; k < 3; k++) for (let i = от; i < N; i++) {
          const a = т[i - 1], b = т[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d <= L) continue;
          const s = (d - L) / d, закрA = i - 1 === 0 || a.тумба, закрB = b.тумба || (i === N - 1 && летит);
          if (закрA && !закрB) { b.x -= dx * s; b.y -= dy * s; }
          else if (!закрA && закрB) { a.x += dx * s; a.y += dy * s; }
          else if (!закрA && !закрB) { a.x += dx * s / 2; a.y += dy * s / 2; b.x -= dx * s / 2; b.y -= dy * s / 2; }
        }
        брызги = брызги.filter(б => (б.ж -= h) > 0);
        брызги.forEach(б => { б.x += б.vx * h; б.y += б.vy * h; б.vy += g * 0.5 * h; });
        полёт += h;
      }
      // Канат крупным пикселем: тень, тёмный контур, жила, витые блики; что под водой — притоплено; бухта в руке.
      function рисовать() {
        кК.clearRect(0, 0, НШ, НВ);
        кК.lineCap = 'round'; кК.lineJoin = 'round';
        const звенья = [{ x: РУКА.x, y: РУКА.y }, ...т.slice(Math.max(1, первый))];
        if (фаза === 'полёт' || фаза === 'лёг') {
          const путь = () => { кК.beginPath(); звенья.forEach((p, i) => (i ? кК.lineTo(p.x * М, p.y * М) : кК.moveTo(p.x * М, p.y * М))); };
          кК.save(); кК.translate(0.7, 1.3); путь(); кК.strokeStyle = 'rgba(0,0,0,.35)'; кК.lineWidth = 3.4; кК.stroke(); кК.restore();
          путь(); кК.strokeStyle = '#2a1d10'; кК.lineWidth = 3.2; кК.stroke();
          путь(); кК.strokeStyle = '#8b6a3e'; кК.lineWidth = 2; кК.stroke();
          кК.fillStyle = '#d2b077';
          let n0 = 0;
          for (let i = 1; i < звенья.length; i++) {
            const a = звенья[i - 1], b = звенья[i], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) * М));
            for (let s2 = 0; s2 < n; s2++, n0++) { if (n0 % 3) continue; const u = s2 / n; кК.fillRect(Math.round((a.x + (b.x - a.x) * u) * М), Math.round((a.y + (b.y - a.y) * u) * М) - 1, 1, 1); }
          }
          кК.strokeStyle = 'rgba(34,52,78,.55)'; кК.lineWidth = 3.6;
          for (let i = 1; i < звенья.length; i++) {
            const a = звенья[i - 1], b = звенья[i]; if (!a.вода || !b.вода) continue;
            кК.beginPath(); кК.moveTo(a.x * М, a.y * М); кК.lineTo(b.x * М, b.y * М); кК.stroke();
          }
          const к = т[N - 1];
          кК.strokeStyle = '#2a1d10'; кК.lineWidth = 1.8; кК.beginPath(); кК.ellipse(к.x * М, к.y * М - 1, 3.4, 2.1, 0, 0, Math.PI * 2); кК.stroke();
          кК.strokeStyle = '#b08a55'; кК.lineWidth = 0.9; кК.stroke();
        }
        const колец = Math.ceil(3 * (первый - 1) / (N - 4));
        for (let r = 0; r < колец; r++) {
          кК.strokeStyle = '#2a1d10'; кК.lineWidth = 1.8; кК.beginPath(); кК.ellipse(РУКА.x * М + r * 0.6, (РУКА.y + 14) * М + r * 0.5, 3.6, 5, 0.3, 0, Math.PI * 2); кК.stroke();
          кК.strokeStyle = '#9a7746'; кК.lineWidth = 0.9; кК.stroke();
        }
        кК.fillStyle = 'rgba(228,238,242,.92)';
        брызги.forEach(б => кК.fillRect(Math.round(б.x * М), Math.round(б.y * М), 1, 1));
      }
      let прошлое = performance.now(), копилка = 0;
      const шаг = сейчас => {
        if (конец || закрыто) return;
        const dt = Math.min(0.1, (сейчас - прошлое) / 1000); прошлое = сейчас;
        if (фаза === 'замах') {
          сила = 0.5 - 0.5 * Math.cos((сейчас - т0) / 1000 * Math.PI * (тихо ? 0.6 : 1.1)); // 0 → 1 → 0
          полоса.style.height = (сила * 100) + '%';
        }
        if (фаза === 'полёт' || фаза === 'лёг') {
          копилка += dt;
          while (копилка >= h) { физика(); копилка -= h; }
          if (полёт > 1.9) { закрыто = true; рисовать(); готово(итог); return; }
        }
        рисовать();
        requestAnimationFrame(шаг);
      };
      рисовать();
      requestAnimationFrame(шаг);
    });
  }

  (async () => {
    for (const сцена of [прибытие, бросок, разговор]) { if (конец) return; await сцена(); }
    закончить();
  })();
}
