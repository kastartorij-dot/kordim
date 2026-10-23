// Музыка и звуки интерфейса. Музыка — по району, месту и часу; звуки синтезируются WebAudio,
// без файлов. Браузер разрешает звук только после первого нажатия, до него всё молчит.
import { настройкиИнтерфейса } from './настройки-интерфейса.js';

const БАЗА = new URL('../Ресурсы/Музыка/', import.meta.url).href;
const ПО_МЕСТУ = { 'синий-час': 'синий-час', таверна: 'таверна', 'лачуга-локи': 'лачуга', маяк: 'маяк', ночлежка: 'трущобы', 'двор-горма': 'трущобы' };
const ПО_РАЙОНУ = {
  доки: 'доки', торговый: 'рынок', трущобы: 'трущобы', маяк: 'маяк', 'рыбацкий-берег': 'лачуга',
  'управный-двор': 'тревога', 'сухопутные-ворота': 'тревога', 'жилые-улицы': 'город', 'ремесленные-дворы': 'город',
};
const ГРОМКОСТЬ = 0.42;

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
  const можно = настройкиИнтерфейса().музыка === 'вкл';
  const имя = можно ? нужная : null;
  if (имя === играет) return;
  if (играет) { const старая = дорожки.get(играет); плавно(старая, 0, 1400, () => старая.pause()); }
  играет = имя;
  if (!имя) return;
  let а = дорожки.get(имя);
  if (!а) { а = new Audio(БАЗА + имя + '.mp3'); а.loop = true; а.preload = 'auto'; дорожки.set(имя, а); }
  а.volume = 0;
  а.play().then(() => плавно(а, ГРОМКОСТЬ, 2200)).catch(() => {});
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
  г.gain.setValueAtTime(0, t); г.gain.linearRampToValueAtTime(громк, t + 0.004); г.gain.exponentialRampToValueAtTime(0.0001, t + длит);
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
  г.gain.value = громк;
  и.connect(ф).connect(г).connect(к.destination); и.start(t);
}
const ЗВУКИ = {
  клик: () => { шорох(0.05, 0.22, 2400, 900); тон(190, 0.07, 0.05, 'triangle'); },
  монета: () => { тон(1880, 0.25, 0.06); тон(2510, 0.18, 0.035, 'sine', 0.01); тон(2090, 0.3, 0.05, 'sine', 0.08); },
  трата: () => { тон(1320, 0.12, 0.045); тон(990, 0.2, 0.04, 'sine', 0.06); },
  страница: () => шорох(0.18, 0.28, 600, 3200),
  шаг: () => { шорох(0.12, 0.3, 300, 160); шорох(0.1, 0.22, 340, 180); },
  день: () => { тон(392, 1.4, 0.04, 'triangle'); тон(587, 1.6, 0.03, 'triangle', 0.12); тон(784, 1.8, 0.02, 'sine', 0.24); },
};
export function звук(имя) {
  if (!разрешено || настройкиИнтерфейса().звуки !== 'вкл') return;
  try { ЗВУКИ[имя]?.(); } catch {}
}

// Первое нажатие открывает звук; дальше каждая доступная кнопка тихо щёлкает.
document.addEventListener('pointerdown', () => {
  if (!разрешено) { разрешено = true; try { контекст().resume(); } catch {} включить(); }
}, true);
document.addEventListener('keydown', () => { if (!разрешено) { разрешено = true; включить(); } }, true);
document.addEventListener('click', е => {
  const к = е.target.closest?.('button');
  if (к && !к.disabled && !к.dataset.тихо) звук('клик');
}, true);
