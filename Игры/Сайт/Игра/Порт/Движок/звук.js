// Музыка и звуки интерфейса. Музыка — по району, месту и часу; звуки синтезируются WebAudio,
// без файлов. Браузер разрешает звук только после первого нажатия, до него всё молчит.
import { настройкиИнтерфейса } from './настройки-интерфейса.js';

const БАЗА = new URL('../Ресурсы/Музыка/', import.meta.url).href;
const ПО_МЕСТУ = { 'синий-час': 'синий-час', таверна: 'таверна', 'лачуга-локи': 'лачуга', маяк: 'маяк', ночлежка: 'трущобы', 'двор-горма': 'трущобы' };
const ПО_РАЙОНУ = {
  доки: 'доки', торговый: 'рынок', трущобы: 'трущобы', маяк: 'маяк', 'рыбацкий-берег': 'лачуга',
  'управный-двор': 'тревога', 'сухопутные-ворота': 'тревога', 'жилые-улицы': 'город', 'ремесленные-дворы': 'город',
};
// Ползунок 0–100 → громкость дорожки: 100 — прежнее «громко» (0.68), 60 — «средне» (≈0.4), 30 — «тихо» (≈0.2).
export const громкостьМузыки = v => 0.68 * Math.max(0, Math.min(100, v)) / 100;
// Звуки событий: 70 — прежний уровень «вкл», множитель громкости каждого тона и шороха.
export const множительЗвуков = v => Math.max(0, Math.min(100, v)) / 70;
const громкость = () => громкостьМузыки(настройкиИнтерфейса().музыка);

let разрешено = false, нужная = null, играет = null;
const дорожки = new Map(); // имя → <audio>

function плавно(а, до, мс, потом) {
  const от = а.volume, т0 = performance.now();
  clearInterval(а._плавно);
  а._плавно = setInterval(() => {
    const к = Math.min(1, (performance.now() - т0) / мс);
    а.volume = от + (до - от) * к;
    if (к >= 1) { clearInterval(а._плавно); потом?.(); }
  }, 40);
}

function включить() {
  if (!разрешено) return;
  const можно = настройкиИнтерфейса().музыка > 0 && !document.hidden;
  const имя = можно ? нужная : null;
  if (имя === играет) { if (имя) плавно(дорожки.get(имя), громкость(), 600); return; } // сменили громкость
  if (играет) { const старая = дорожки.get(играет); плавно(старая, 0, 1400, () => старая.pause()); }
  играет = имя;
  if (!имя) return;
  let а = дорожки.get(имя);
  if (!а) { а = new Audio(БАЗА + имя + '.mp3'); а.loop = true; а.preload = 'auto'; дорожки.set(имя, а); }
  а.volume = 0;
  а.play().then(() => плавно(а, громкость(), 2200)).catch(() => { играет = null; });
}

// Какая музыка нужна сейчас: меню, место, ночь или район.
export function музыкаДля(S) {
  if (!S) return 'главная';
  if (S.мир.конецДня?.финал) return 'печаль';
  const место = S.сцена?.место;
  if (место && ПО_МЕСТУ[место]) return ПО_МЕСТУ[место];
  if (S.мир.отрезок === 'ночь') return 'сверчки';
  return ПО_РАЙОНУ[S.мир.район] ?? 'город';
}
export function музыка(имя) { нужная = имя; включить(); }
export function обновитьЗвук() { включить(); }

// ── синтезированные звуки ──
let ак = null;
const контекст = () => (ак ??= new (window.AudioContext || window.webkitAudioContext)());
function тон(частота, длит, громк, тип = 'sine', задержка = 0) {
  const к = контекст(), t = к.currentTime + задержка;
  const о = к.createOscillator(), г = к.createGain();
  о.type = тип; о.frequency.setValueAtTime(частота, t);
  г.gain.setValueAtTime(0, t); г.gain.linearRampToValueAtTime(громк * сила, t + 0.004); г.gain.exponentialRampToValueAtTime(0.0001, t + длит);
  о.connect(г).connect(к.destination); о.start(t); о.stop(t + длит + 0.02);
}
function шорох(длит, громк, от, до) {
  const к = контекст(), t = к.currentTime;
  const буфер = к.createBuffer(1, Math.ceil(к.sampleRate * длит), к.sampleRate);
  const д = буфер.getChannelData(0);
  for (let i = 0; i < д.length; i++) д[i] = (Math.random() * 2 - 1) * (1 - i / д.length);
  const и = к.createBufferSource(), ф = к.createBiquadFilter(), г = к.createGain();
  и.buffer = буфер; ф.type = 'bandpass'; ф.Q.value = 1.4;
  ф.frequency.setValueAtTime(от, t); ф.frequency.exponentialRampToValueAtTime(до, t + длит);
  г.gain.value = громк * сила;
  и.connect(ф).connect(г).connect(к.destination); и.start(t);
}
const ЗВУКИ = {
  монета: () => { тон(1880, 0.25, 0.09); тон(2510, 0.18, 0.05, 'sine', 0.01); тон(2090, 0.3, 0.075, 'sine', 0.08); },
  трата: () => { тон(1320, 0.12, 0.07); тон(990, 0.2, 0.065, 'sine', 0.06); },
  страница: () => шорох(0.18, 0.28, 600, 3200),
  шаг: () => { шорох(0.12, 0.3, 300, 160); шорох(0.1, 0.22, 340, 180); },
  // Пролог (Движок/пролог.js): петля легла на тумбу — глухой деревянный стук; мимо — всплеск.
  тумба: () => { тон(140, 0.22, 0.16, 'triangle'); тон(95, 0.3, 0.12, 'sine', 0.02); шорох(0.08, 0.25, 900, 300); },
  всплеск: () => { шорох(0.55, 0.5, 2400, 260); шорох(0.35, 0.25, 700, 180); тон(220, 0.18, 0.04, 'sine', 0.05); },
  взмах: () => шорох(0.35, 0.22, 400, 2600),
  день: () => { тон(392, 1.4, 0.1, 'triangle'); тон(587, 1.6, 0.075, 'triangle', 0.12); тон(784, 1.8, 0.05, 'sine', 0.24); },
};
let сила = 1; // множитель звуков на время одного звука
export function звук(имя) {
  const уровень = настройкиИнтерфейса().звуки;
  if (!разрешено || уровень <= 0) return;
  сила = множительЗвуков(уровень);
  try { ЗВУКИ[имя]?.(); } catch {}
}

// Шум моря для пролога (Движок/пролог.js): прибой — шум через низкий фильтр, громкость «дышит» волнами;
// поверх изредка плеск у свай. Громкость — от ползунка «Звуки событий». Включить/выключить плавно.
let море = null;
export function фонМоря(вкл) {
  const уровень = настройкиИнтерфейса().звуки;
  if (!разрешено || уровень <= 0) { if (!вкл && море) фонМоря._стоп?.(); return; }
  try {
    const к = контекст();
    if (вкл && !море) {
      const буфер = к.createBuffer(1, к.sampleRate * 3, к.sampleRate), д = буфер.getChannelData(0);
      let последний = 0;
      for (let i = 0; i < д.length; i++) { последний = последний * 0.97 + (Math.random() * 2 - 1) * 0.03; д[i] = последний * 9; } // бурый шум
      const и = к.createBufferSource(); и.buffer = буфер; и.loop = true;
      const ф = к.createBiquadFilter(); ф.type = 'lowpass'; ф.frequency.value = 520;
      const г = к.createGain(); г.gain.value = 0;
      const волна = к.createOscillator(), глубина = к.createGain(); волна.frequency.value = 0.11; глубина.gain.value = 0.05 * множительЗвуков(уровень);
      волна.connect(глубина).connect(г.gain);
      и.connect(ф).connect(г).connect(к.destination);
      и.start(); волна.start();
      г.gain.linearRampToValueAtTime(0.09 * множительЗвуков(уровень), к.currentTime + 2.5);
      const плеск = setInterval(() => { сила = множительЗвуков(настройкиИнтерфейса().звуки) * 0.5; try { шорох(0.4 + Math.random() * 0.3, 0.12, 900, 300); } catch {} }, 3800);
      море = { и, г, волна, плеск };
      фонМоря._стоп = () => {
        const м = море; if (!м) return; море = null; clearInterval(м.плеск);
        м.г.gain.cancelScheduledValues(к.currentTime); м.г.gain.setValueAtTime(м.г.gain.value, к.currentTime);
        м.г.gain.linearRampToValueAtTime(0, к.currentTime + 1.2);
        setTimeout(() => { try { м.и.stop(); м.волна.stop(); } catch {} }, 1400);
      };
    } else if (!вкл && море) фонМоря._стоп();
  } catch {}
}

// Первое нажатие открывает звук. Кнопки сами по себе не щёлкают (решение автора 23.10):
// звучат только события — монета, страница журнала, шаги, утро.
document.addEventListener('pointerdown', () => {
  if (!разрешено) { разрешено = true; try { контекст().resume(); } catch {} включить(); }
}, true);
document.addEventListener('keydown', () => { if (!разрешено) { разрешено = true; включить(); } }, true);
// Свёрнутое окно молчит; вернулись — музыка плавно возвращается.
document.addEventListener('visibilitychange', включить);
