// Пролог (четвёртая версия, 13.11). Данные — Данные/вступление.js, поле пролог.
//
// Монтаж: кадр прибытия живёт (вода, паруса, огни, дым из труб, чайки, люди на причале, герой дышит) →
// подписи рассказа → окрик грузчика облаком с его головой → бросок швартова (дуга-подсказка, физика каната) →
// канат натягивают, баржу подводят к причалу → сходня (план ролика) → разговор на стоп-кадре сапог →
// «Ты не знал.» в темноте → пролёт над городом с титром игры → выбор начала.
//
// Всё рисуется в холст 836 × 470 крупным пикселем, без фильтров: и кадр, и ролик. Канат — свой холст 418 × 235.
// Координаты кадра прибытия — 1672 × 941 (канат) и 836 × 470 (живые места: паруса, люди, трубы).
// Касание / пробел / Enter — дальше; Esc или «Пропустить» — к выбору. «Меньше движения» — кадр не живёт,
// камера стоит, вместо ролика — стоп-кадры.
import { ВСТУПЛЕНИЕ } from '../Данные/вступление.js';
import { путьРесурса } from './задник.js';
import { музыка, звук } from './звук.js';
import { настройкиИнтерфейса } from './настройки-интерфейса.js';

const П = ВСТУПЛЕНИЕ.пролог;
const ждать = мс => new Promise(r => setTimeout(r, мс));

const ВШ = 836, ВВ = 470, НШ = 418, НВ = 235, М = НШ / 1672;
// Бросок: рука героя и верх тумбы; вода, настил причала и ближний борт баржи (координаты 1672 × 941).
const РУКА = { x: 486, y: 636 }, ТУМБА = { x: 1282, y: 532 };
const водаНа = x => (x < 560 || x > 1188 ? 9999 : 596), настилНа = x => (x > 1188 ? 528 : 9999);
const бортНа = x => (x < 470 || x > 1188 ? 9999 : x < 700 ? 612 : 612 + (x - 700) * 0.4);

// Живые места кадра прибытия (836 × 470). Паруса колышутся; у людей верх тела сдвигается на пиксель.
const ГОРИЗОНТ = 232;
const ПАРУСА = [{ x0: 125, x1: 158, y0: 132, y1: 205, ф: 0 }, { x0: 312, x1: 349, y0: 125, y1: 218, ф: 1.7 }];
const ЛЮДИ = [ // x0..x1, y0..y1 — верх тела; dx/dy — куда сдвигается; т — период, с; ф — сдвиг фазы
  { x0: 712, x1: 746, y0: 217, y1: 246, dx: 1, dy: 0, т: 0.75, ф: 0 },   // толкает тележку
  { x0: 642, x1: 664, y0: 219, y1: 244, dx: 0, dy: -1, т: 1.15, ф: 0.3 }, // у тележки
  { x0: 781, x1: 809, y0: 216, y1: 247, dx: 0, dy: -1, т: 0.9, ф: 0.6 },  // с мешком
  { x0: 606, x1: 624, y0: 219, y1: 236, dx: -1, dy: 0, т: 1.7, ф: 0.1 }, // у ящиков
  { x0: 150, x1: 251, y0: 186, y1: 262, dx: 0, dy: -1, т: 3.6, ф: 0, вдох: 0.42 }, // герой дышит
];
const ТРУБЫ = [{ x: 645, y: 116 }, { x: 680, y: 124 }, { x: 742, y: 101 }, { x: 795, y: 86 }, { x: 530, y: 141 }];

// Маски кадра: вода (синее ниже горизонта и отражения огней), паруса (светлое ненасыщенное), огни (тёплое яркое).
function маски(д) {
  const п = д.data, вода = new Uint8Array(ВШ * ВВ), парус = new Uint8Array(ВШ * ВВ), огонь = new Uint8Array(ВШ * ВВ);
  for (let y = 0; y < ВВ; y++) for (let x = 0; x < ВШ; x++) {
    const j = y * ВШ + x, i = j * 4, r = п[i], g = п[i + 1], b = п[i + 2];
    if (y >= ГОРИЗОНТ && b > r + 12 && b >= g) вода[j] = 1;
    if (y < ГОРИЗОНТ && r > 200 && g > 130 && r > b + 70) огонь[j] = 1;
  }
  for (let y = ГОРИЗОНТ; y < ВВ; y++) for (let x = 0; x < ВШ; x++) {
    const j = y * ВШ + x, i = j * 4;
    if (вода[j] || !(п[i] > 140 && п[i] > п[i + 2])) continue;
    let л = false, пр = false;
    for (let k = 1; k <= 12 && !(л && пр); k++) { if (x - k >= 0 && вода[j - k] === 1) л = true; if (x + k < ВШ && вода[j + k] === 1) пр = true; }
    if (л && пр) вода[j] = 2;
  }
  for (const с of ПАРУСА) for (let y = с.y0; y < с.y1; y++) for (let x = с.x0; x < с.x1; x++) {
    const i = (y * ВШ + x) * 4, мx = Math.max(п[i], п[i + 1], п[i + 2]), мн = Math.min(п[i], п[i + 1], п[i + 2]);
    if (мx > 120 && мx - мн < 50) парус[y * ВШ + x] = 1;
  }
  return { вода, парус, огонь };
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
      <div class="пролог-замах" hidden><span class="пролог-замах-имя">сила</span><div class="пролог-замах-шкала"><div class="пролог-замах-зона"><span>тумба</span></div><div class="пролог-замах-сила"></div></div></div>
      <div class="пролог-совет" hidden></div>
      <div class="пролог-титр" hidden><div class="пролог-титр-имя"></div><div class="пролог-титр-ниже"></div></div>
    </div>
    <div class="пролог-тьма" hidden></div>`;
  document.body.appendChild(ов);
  const $ = с => ов.querySelector(с);
  const кЭ = $('.пролог-экран').getContext('2d', { willReadFrequently: true });
  const кК = $('.пролог-канат').getContext('2d');
  кЭ.imageSmoothingEnabled = false;
  const камера = $('.пролог-камера'), шторка = $('.пролог-шторка');
  const подпись = $('.пролог-подпись'), облако = $('.пролог-облако'), совет = $('.пролог-совет'), тьма = $('.пролог-тьма');
  ов.__отл = {}; // для проверки в браузере

  let конец = false, ждём = null;

  // ── источники: живой кадр прибытия, ролик (в память целиком — перемотка на любом сервере), стоп-кадры ──
  let режим = 'кадр', источник = null, нарисован = null, времяВидео = -1;
  let исходник = null, м = null, вывод = null;
  const кадр = new Image();
  кадр.onload = () => {
    const к = document.createElement('canvas'); к.width = ВШ; к.height = ВВ;
    const кк = к.getContext('2d', { willReadFrequently: true }); кк.imageSmoothingEnabled = false;
    кк.drawImage(кадр, 0, 0, ВШ, ВВ);
    исходник = кк.getImageData(0, 0, ВШ, ВВ); м = маски(исходник);
    вывод = new ImageData(new Uint8ClampedArray(исходник.data), ВШ, ВВ);
    кЭ.putImageData(вывод, 0, 0);
  };
  кадр.src = путьРесурса(П.кадр);
  const стоп = {};
  for (const [имя, путь] of Object.entries(П.стоп)) { const и = new Image(); и.src = путьРесурса(путь); стоп[имя] = и; }
  const видео = document.createElement('video');
  видео.muted = true; видео.playsInline = true; видео.setAttribute('playsinline', ''); видео.setAttribute('muted', '');
  let адрес = null;
  const ролик = тихо ? Promise.resolve(false) : fetch(путьРесурса(П.ролик))
    .then(р => (р.ok ? р.blob() : Promise.reject(р.status)))
    .then(б => { if (конец) return false; адрес = URL.createObjectURL(б); видео.src = адрес; return true; })
    .catch(() => false);

  // Живой кадр: ~12 кадров в секунду — так живёт рисованная картинка. Дым и чайки рисуются поверх.
  const дым = [], чайки = [0, 1, 2].map(i => ({ x: -30 - i * 260, y: 46 + i * 19, v: 9 + i * 2.5, ф: i * 0.7 }));
  let прошлый = 0, последнийДым = 0;
  function живой(сейчас) {
    if (!исходник) return;
    const t = сейчас / 1000, с = исходник.data, в = вывод.data;
    в.set(с);
    if (!тихо) {
      // люди и герой: верх тела на пиксель туда-обратно
      for (const ч of ЛЮДИ) {
        const фаза = ((t / ч.т + ч.ф) % 1);
        if (фаза > (ч.вдох ?? 0.5)) continue;
        for (let y = ч.y0; y < ч.y1; y++) for (let x = ч.x0; x < ч.x1; x++) {
          const xs = x - ч.dx, ys = y - ч.dy, i = (y * ВШ + x) * 4, k = (ys * ВШ + xs) * 4;
          в[i] = с[k]; в[i + 1] = с[k + 1]; в[i + 2] = с[k + 2];
        }
      }
      // паруса: низ полотна колышется сильнее, чем у рея
      for (const п of ПАРУСА) for (let y = п.y0; y < п.y1; y++) {
        const сдвиг = Math.round(Math.sin(t * 1.25 + п.ф + y * 0.05) * 1.4 * (y - п.y0) / (п.y1 - п.y0));
        if (!сдвиг) continue;
        for (let x = п.x0; x < п.x1; x++) {
          const j = y * ВШ + x; if (!м.парус[j] || !м.парус[j - сдвиг]) continue;
          const i = j * 4, k = (j - сдвиг) * 4; в[i] = с[k]; в[i + 1] = с[k + 1]; в[i + 2] = с[k + 2];
        }
      }
      // огни: каждый мерцает сам по себе
      for (let j = 0; j < ВШ * ГОРИЗОНТ; j++) {
        if (!м.огонь[j]) continue;
        const x = j % ВШ, y = (j / ВШ) | 0, кл = (x >> 3) * 31 + (y >> 3) * 17;
        const к = 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(t * (5 + (кл % 7)) + кл) * Math.sin(t * 2.3 + кл * 0.7));
        const i = j * 4; в[i] = с[i] * к; в[i + 1] = с[i + 1] * к; в[i + 2] = с[i + 2] * к;
      }
      // вода: построчный сдвиг по синусу, глубже — сильнее
      for (let y = ГОРИЗОНТ; y < ВВ; y++) {
        const глубь = (y - ГОРИЗОНТ) / (ВВ - ГОРИЗОНТ), сдвиг = Math.round(Math.sin(y * 0.55 + t * 3.1) * (0.6 + глубь * 1.6));
        if (!сдвиг) continue;
        for (let x = 0, j = y * ВШ; x < ВШ; x++, j++) {
          if (!м.вода[j]) continue;
          const xs = x + сдвиг; if (xs < 0 || xs >= ВШ || !м.вода[j + сдвиг]) continue;
          const i = j * 4, k = (j + сдвиг) * 4; в[i] = с[k]; в[i + 1] = с[k + 1]; в[i + 2] = с[k + 2];
        }
      }
    }
    кЭ.putImageData(вывод, 0, 0);
    if (тихо) return;
    // дым из труб: серые клубы поднимаются, сносит вправо, тают
    if (t - последнийДым > 0.55) { последнийДым = t; const тр = ТРУБЫ[(Math.random() * ТРУБЫ.length) | 0]; дым.push({ x: тр.x, y: тр.y, t0: t }); }
    for (let i = дым.length - 1; i >= 0; i--) {
      const д = дым[i], в2 = t - д.t0; if (в2 > 4) { дым.splice(i, 1); continue; }
      const r = 1 + Math.floor(в2 * 0.9), a = 0.32 * (1 - в2 / 4);
      кЭ.fillStyle = `rgba(196,200,212,${a.toFixed(3)})`;
      кЭ.fillRect(Math.round(д.x + в2 * 3.2 + Math.sin(в2 * 2) * 1.2) - r, Math.round(д.y - в2 * 6.5) - r, r * 2, r * 2);
    }
    // чайки: «галочка» с двумя положениями крыльев
    for (const ч of чайки) {
      ч.x += ч.v / 12; if (ч.x > ВШ + 20) ч.x = -40;
      const x = Math.round(ч.x), y = Math.round(ч.y + Math.sin(t * 0.8 + ч.ф) * 4), вверх = Math.sin(t * 9 + ч.ф * 5) > 0;
      кЭ.fillStyle = '#e9e6de';
      if (вверх) { кЭ.fillRect(x - 2, y - 1, 1, 1); кЭ.fillRect(x - 1, y, 3, 1); кЭ.fillRect(x + 2, y - 1, 1, 1); }
      else { кЭ.fillRect(x - 2, y + 1, 1, 1); кЭ.fillRect(x - 1, y, 3, 1); кЭ.fillRect(x + 2, y + 1, 1, 1); }
    }
  }
  const цикл = сейчас => {
    if (конец) return;
    if (режим === 'кадр') { if (сейчас - прошлый > 80) { прошлый = сейчас; живой(сейчас); } }
    else {
      const готов = источник === видео ? видео.readyState >= 2 : источник?.complete && источник.naturalWidth > 0;
      if (готов && (источник !== нарисован || (источник === видео && видео.currentTime !== времяВидео))) {
        кЭ.drawImage(источник, 0, 0, ВШ, ВВ); нарисован = источник; времяВидео = источник === видео ? видео.currentTime : -1;
      }
    }
    requestAnimationFrame(цикл);
  };
  requestAnimationFrame(цикл);

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
    видео.pause();
    document.removeEventListener('keydown', нажатие, true);
    document.removeEventListener('keyup', отпуск, true);
    ов.classList.add('уходит');
    setTimeout(() => { ов.remove(); видео.removeAttribute('src'); видео.load(); if (адрес) URL.revokeObjectURL(адрес); onДальше(); }, 600);
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
  const камераСброс = () => { камера.style.transition = 'none'; камера.style.transform = ''; void камера.offsetWidth; };

  // План ролика с/по чистыми кадрами; касание — сразу к концу плана. Без ролика — стоп-кадр плана.
  async function план(имя, скорость) {
    const п = П.планы[имя];
    режим = 'видео';
    const есть = await Promise.race([ролик, ждать(6000).then(() => false)]);
    if (!есть || видео.error) { источник = стоп[имя]; await касание(3200); return; }
    видео.pause();
    await new Promise(r => { const ок = () => { видео.removeEventListener('seeked', ок); r(); }; видео.addEventListener('seeked', ок); setTimeout(ок, 2500); видео.currentTime = п.с; });
    источник = видео; видео.playbackRate = скорость;
    if (!(await видео.play().then(() => true).catch(() => false))) { источник = стоп[имя]; await касание(3200); return; }
    await new Promise(r => {
      const т = () => { if (конец || видео.currentTime >= п.по || видео.ended) return r(); requestAnimationFrame(т); };
      ждём = к => { if (к === 'вниз') { ждём = null; r(); } };
      т();
    });
    ждём = null; видео.pause();
    источник = стоп[имя]; // конец плана — чистый стоп-кадр: на медленном экране видео успевает проскочить склейку
  }

  // ── сцены ──
  async function прибытие() {
    await ждать(400);
    музыка(П.музыка);
    await затемнить(false, 1800);
    наезд(1.05, 30, 60, 26000); // медленно, почти незаметно — к герою
    for (const т of П.рассказ) { if (конец) return; рассказ(т); await касание(); }
  }

  let канатУпр = null;
  async function бросок() {
    реплика('грузчик', П.бросок.зов);
    await касание(1800, 900);
    if (конец) return;
    облако.hidden = true;
    совет.textContent = П.бросок.подсказка; совет.hidden = false;
    канатУпр = await канат();
    совет.hidden = true;
    if (конец) return;
    ов.dataset.бросок = канатУпр.итог;
    рассказ(П.бросок[канатУпр.итог]);
    await касание(0, 700);
    // швартовка: канат натягивают, баржу подводят — камера подходит к причалу
    скрытьТекст();
    канатУпр.натянуть();
    наезд(1.3, 76, 58, 2600);
    await ждать(тихо ? 600 : 2200);
  }

  async function сходня() {
    await затемнить(true, 500);
    канатУпр?.стоп(); кК.clearRect(0, 0, НШ, НВ); камераСброс();
    рассказ(П.сходня);
    затемнить(false, 500);
    await план('сходня', 0.85);
    await касание(1400, 300);
    // разговор на стоп-кадре сапог: шаги остановились, грузчик говорит; кадр медленно подходит и темнеет
    ов.dataset.сцена = 'разговор';
    наезд(1.1, 50, 60, 16000);
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

  async function город() {
    тьма.classList.add('уходит');
    ов.classList.remove('тишина'); ов.dataset.сцена = '';
    камераСброс();
    источник = стоп.город; режим = 'видео';
    затемнить(false, 1400);
    await ждать(500);
    тьма.hidden = true;
    const т = $('.пролог-титр');
    $('.пролог-титр-имя').textContent = П.титр.имя; $('.пролог-титр-ниже').textContent = П.титр.ниже;
    setTimeout(() => { if (!конец) { т.hidden = false; появись(т); } }, 1200);
    await план('город', 0.75);
    await касание(2200, 600);
  }

  // ── канат: цепочка звеньев (Верле); петля летит по рассчитанной дуге к своей точке, остальное — физика ──
  // Пока держишь — пунктир показывает, куда ляжет петля, тумба светится, когда попадаешь.
  function канат() {
    return new Promise(готово => {
      const N = 36; let L = 1.6 * Math.hypot(ТУМБА.x - РУКА.x, ТУМБА.y - РУКА.y) / (N - 1);
      const Lтуго = 1.03 * Math.hypot(ТУМБА.x - РУКА.x, ТУМБА.y - РУКА.y) / (N - 1);
      const т = Array.from({ length: N }, () => ({ x: РУКА.x, y: РУКА.y, px: РУКА.x, py: РУКА.y, вода: false, тумба: false }));
      const g = 2600, h = 1 / 120;
      let фаза = 'бухта', сила = 0, т0 = 0, полёт = 0, итог = null, брызги = [], дуга = null, туго = false, стоп = false, отдано = false;
      let первый = N - 3;
      const замах = $('.пролог-замах'), полоса = $('.пролог-замах-сила');
      замах.hidden = false;
      ов.__отл = { данные: () => ({ фаза, сила, итог, полёт, первый, конецТ: т[N - 1] }) };

      const исходПо = с => (Math.abs(с - 0.5) <= 0.13 ? 'удача' : с < 0.5 ? 'недолёт' : 'перелёт');
      const цельПо = с => {
        const и = исходПо(с);
        return и === 'удача' ? { x: ТУМБА.x, y: ТУМБА.y - 4, tf: 0.95 }
          : и === 'недолёт' ? { x: РУКА.x + (ТУМБА.x - РУКА.x) * (0.5 + 0.7 * с), y: водаНа(900) + 3, tf: 0.85 }
          : { x: ТУМБА.x + 70 + 260 * (с - 0.63), y: настилНа(1300), tf: 1.05 };
      };
      const дугаПо = ц => ({ tf: ц.tf, vx: (ц.x - РУКА.x) / ц.tf, vy: (ц.y - РУКА.y - 0.5 * g * ц.tf * ц.tf) / ц.tf });

      ждём = к => {
        if (к === 'вниз' && фаза === 'бухта') { фаза = 'замах'; т0 = performance.now(); замах.classList.add('идёт'); }
        else if (к === 'вверх' && фаза === 'замах') бросить();
      };
      function бросить() {
        фаза = 'полёт'; ждём = null; замах.classList.remove('идёт', 'в-цель'); замах.hidden = true;
        if (typeof ов.__сила === 'number') сила = ов.__сила; // только для проверки в браузере
        итог = исходПо(сила); дуга = дугаПо(цельПо(сила)); полёт = 0;
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
            else { к.тумба = true; звук('тумба'); }
            фаза = 'лёг';
          }
        }
        // швартовка: петлю (если не на тумбе) переносят на тумбу, канат выбирают — он поднимается из воды и натягивается
        if (туго) {
          if (!к.тумба) { к.x += (ТУМБА.x - к.x) * 0.04; к.y += (ТУМБА.y - 4 - к.y) * 0.04; к.вода = false; if (Math.hypot(к.x - ТУМБА.x, к.y - ТУМБА.y) < 6) к.тумба = true; }
          if (L > Lтуго) L *= 0.996;
          for (const p of т) p.вода = false;
        }
        for (let i = первый; i < N; i++) {
          const p = т[i]; if (p.тумба || (i === N - 1 && (летит || туго))) continue;
          let vx = (p.x - p.px) * 0.995, vy = (p.y - p.py) * 0.995;
          p.px = p.x; p.py = p.y;
          if (p.вода) { vx *= 0.9; vy = vy * 0.7 + (водаНа(p.x) + 5 + Math.sin(p.x * 0.045 + полёт * 2.2) * 3 - p.y) * 0.05; } else vy += g * h * h;
          p.x += vx; p.y += vy;
          const в = водаНа(p.x), н = настилНа(p.x);
          if (!туго && !p.вода && p.y > в && p.py <= в + 1) p.вода = true;
          if (p.вода) p.y = Math.min(p.y, в + 6);
          if (p.y > н && p.py <= н + 1) { p.y = н; p.px = p.x - (p.x - p.px) * 0.4; }
          if (!p.вода && p.y > бортНа(p.x)) { p.y = бортНа(p.x); p.px = p.x - (p.x - p.px) * 0.5; }
        }
        while (первый > 1 && Math.hypot(т[первый].x - РУКА.x, т[первый].y - РУКА.y) > L) {
          const с = т[первый], н = т[первый - 1], dx = РУКА.x - с.x, dy = РУКА.y - с.y, d = Math.hypot(dx, dy);
          н.x = с.x + dx / d * L; н.y = с.y + dy / d * L; н.px = н.x - (с.x - с.px) * 0.35; н.py = н.y - (с.y - с.py) * 0.35;
          первый--;
        }
        const от = первый <= 1 ? 1 : первый + 1;
        for (let k = 0; k < (туго ? 6 : 3); k++) for (let i = от; i < N; i++) {
          const a = т[i - 1], b = т[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d <= L) continue;
          const s = (d - L) / d, закрA = i - 1 === 0 || a.тумба, закрB = b.тумба || (i === N - 1 && (летит || туго));
          if (закрA && !закрB) { b.x -= dx * s; b.y -= dy * s; }
          else if (!закрA && закрB) { a.x += dx * s; a.y += dy * s; }
          else if (!закрA && !закрB) { a.x += dx * s / 2; a.y += dy * s / 2; b.x -= dx * s / 2; b.y -= dy * s / 2; }
        }
        брызги = брызги.filter(б => (б.ж -= h) > 0);
        брызги.forEach(б => { б.x += б.vx * h; б.y += б.vy * h; б.vy += g * 0.5 * h; });
        полёт += h;
      }
      function рисовать(сейчас) {
        кК.clearRect(0, 0, НШ, НВ);
        кК.lineCap = 'round'; кК.lineJoin = 'round';
        // подсказка: пунктир полёта петли и метка, куда она ляжет; тумба светится, когда попадаешь
        if (фаза === 'замах') {
          const ц = цельПо(сила), д = дугаПо(ц), в_цель = исходПо(сила) === 'удача';
          const цвет = в_цель ? '#ffd27a' : '#f2ead8';
          for (let t = 0.05, i = 0; t < д.tf; t += 0.055, i++) { // пунктир 2 × 2 с тёмной подложкой — виден и на небе, и на воде
            const x = Math.round((РУКА.x + д.vx * t) * М), y = Math.round((РУКА.y + д.vy * t + 0.5 * g * t * t) * М);
            кК.fillStyle = 'rgba(20,14,8,.7)'; кК.fillRect(x - 1, y - 1, 3, 3);
            кК.fillStyle = цвет; кК.fillRect(x - 1, y - 1, 2, 2);
          }
          кК.lineWidth = 2; кК.strokeStyle = 'rgba(20,14,8,.7)';
          кК.beginPath(); кК.ellipse(ц.x * М, ц.y * М, 4.5, 2.4, 0, 0, Math.PI * 2); кК.stroke();
          кК.lineWidth = 1; кК.strokeStyle = цвет; кК.stroke();
          const пульс = 0.5 + 0.5 * Math.sin(сейчас / 160);
          кК.strokeStyle = в_цель ? `rgba(255,205,100,${0.55 + 0.45 * пульс})` : 'rgba(255,205,100,.25)';
          кК.lineWidth = в_цель ? 1.6 : 1;
          кК.beginPath(); кК.ellipse(ТУМБА.x * М, (ТУМБА.y + 8) * М, 6 + пульс, 3.2, 0, 0, Math.PI * 2); кК.stroke();
          замах.classList.toggle('в-цель', в_цель);
        }
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
        if (конец || стоп) return;
        const dt = Math.min(0.1, (сейчас - прошлое) / 1000); прошлое = сейчас;
        if (фаза === 'замах') {
          сила = 0.5 - 0.5 * Math.cos((сейчас - т0) / 1000 * Math.PI * (тихо ? 0.5 : 0.9)); // 0 → 1 → 0
          полоса.style.height = (сила * 100) + '%';
        }
        if (фаза === 'полёт' || фаза === 'лёг') {
          копилка += dt;
          while (копилка >= h) { физика(); копилка -= h; }
          if (полёт > 1.9 && !отдано) { отдано = true; готово({ итог, натянуть: () => { туго = true; }, стоп: () => { стоп = true; } }); }
        }
        рисовать(сейчас);
        requestAnimationFrame(шаг);
      };
      рисовать(performance.now());
      requestAnimationFrame(шаг);
    });
  }

  (async () => {
    for (const сцена of [прибытие, бросок, сходня, город]) { if (конец) return; await сцена(); }
    закончить();
  })();
}
