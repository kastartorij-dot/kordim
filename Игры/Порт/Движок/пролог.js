// Пролог (12.11): короткое кино вместо трёх страниц текста. Данные — Данные/вступление.js, поле пролог.
// Кадры: тьма со строкой → ролик с субтитрами → бросок швартова (одно нажатие, проиграть нельзя) →
// разговор у сходни по реплике → «Ты не знал.» → onДальше (выбор начала).
// Кадр — коробка 16:9 по центру (на вертикальном телефоне — квадрат, слой 16:9 внутри сдвинут к герою),
// субтитры — в чёрной полосе под ней. Касание/пробел/Enter — дальше,
// Esc или «Пропустить» — сразу к выбору. «Меньше движения» в настройках: вместо ролика его первый кадр.
import { ВСТУПЛЕНИЕ } from '../Данные/вступление.js';
import { путьРесурса } from './задник.js';
import { музыка, звук } from './звук.js';
import { настройкиИнтерфейса } from './настройки-интерфейса.js';

const П = ВСТУПЛЕНИЕ.пролог;
const экр = т => String(т ?? '').replace(/[&<>"]/g, с => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[с]));
const ждать = мс => new Promise(r => setTimeout(r, мс));

export function рендерПролог(onДальше) {
  const тихо = настройкиИнтерфейса().движение === 'меньше';
  const громкость = Math.max(0, Math.min(1, (настройкиИнтерфейса().звуки ?? 70) / 100));
  музыка(null);
  const ов = document.createElement('div');
  ов.className = 'пролог';
  ов.innerHTML = `
    <button class="пролог-пропуск" type="button">Пропустить ›</button>
    <div class="пролог-кадр">
      <div class="пролог-слой">
        <video class="пролог-видео" playsinline preload="auto" poster="${путьРесурса(П.кадрРолика)}"></video>
        <div class="пролог-фото"></div>
        <svg class="пролог-бросок" viewBox="0 0 1672 941" aria-hidden="true"><path pathLength="100" d="M 480 600 Q 880 250 1268 572"/></svg>
      </div>
      <div class="пролог-метр" hidden><div class="пролог-зона"></div><div class="пролог-метка"></div></div>
    </div>
    <div class="пролог-титры" aria-live="polite"></div>
    <div class="пролог-дальше" hidden>нажми, чтобы продолжить</div>`;
  document.body.appendChild(ов);
  const $ = с => ов.querySelector(с);
  const видео = $('.пролог-видео'), фото = $('.пролог-фото'), титры = $('.пролог-титры'), дальше = $('.пролог-дальше');

  let конец = false, ждём = null; // ждём — функция, которую позовёт касание
  const нажатие = e => {
    if (конец) return;
    if (e.type === 'keydown') {
      if (e.key === 'Escape') { e.preventDefault(); return закончить(); }
      if (![' ', 'Enter'].includes(e.key)) return;
      e.preventDefault();
    } else if (e.target.closest('.пролог-пропуск')) return;
    ждём?.();
  };
  ов.addEventListener('pointerdown', нажатие);
  document.addEventListener('keydown', нажатие, true);
  $('.пролог-пропуск').onclick = () => закончить();

  function закончить() {
    if (конец) return;
    конец = true;
    видео.pause();
    document.removeEventListener('keydown', нажатие, true);
    ов.classList.add('уходит');
    setTimeout(() => { ов.remove(); onДальше(); }, 450);
  }
  // Строка субтитра: проявляется; кто: 'он' — реплика другого (тёплый цвет), рассказ — курсивом.
  const строка = (т, вид = '') => { титры.innerHTML = т ? `<p class="${вид}">${экр(т)}</p>` : ''; };
  // Ждать касания, но не дольше мс (авто-дальше), и не раньше мин мс (чтобы не пролистнуть случайно).
  const касание = (мс, мин = 350) => new Promise(r => {
    const т0 = performance.now();
    let таймер = мс ? setTimeout(() => { ждём = null; дальше.hidden = true; r(); }, мс) : null;
    дальше.hidden = !!мс;
    ждём = () => { if (performance.now() - т0 < мин) return; clearTimeout(таймер); ждём = null; дальше.hidden = true; r(); };
  });

  async function тьма() {
    ов.dataset.сцена = 'тьма';
    for (const т of П.тьма) { строка(т); await касание(2600); }
    строка('');
  }

  async function ролик() {
    ов.dataset.сцена = 'ролик';
    if (тихо) { // без движения — кадр и субтитры по касанию
      фото.style.backgroundImage = `url("${путьРесурса(П.кадрРолика)}")`;
      for (const с of П.субтитры) { строка(с.т); await касание(3200); }
      return;
    }
    видео.src = путьРесурса(П.ролик);
    видео.volume = 0.8 * громкость; видео.muted = громкость === 0;
    const идёт = видео.play().catch(() => { видео.muted = true; return видео.play(); }).catch(() => null);
    await идёт;
    await new Promise(r => {
      const тик = () => {
        if (конец) return r();
        const t = видео.currentTime, с = П.субтитры.find(x => t >= x.с && t < x.по);
        const нужно = с ? с.т : '';
        if (титры.textContent !== нужно) строка(нужно);
        if (видео.ended || t >= (видео.duration || 15) - 0.05) return r();
        requestAnimationFrame(тик);
      };
      ждём = () => { видео.currentTime = Math.max(видео.currentTime, (видео.duration || 15) - 0.3); }; // касание — к титру
      видео.onerror = () => r();
      тик();
    });
    ждём = null; строка('');
    await касание(1800, 0); // подержать титр «Порт Теней»
  }

  // Бросок: метка ходит туда-обратно, нажатие в середине — петля на тумбе. Проиграть нельзя.
  async function бросок() {
    ов.dataset.сцена = 'бросок';
    видео.hidden = true;
    фото.style.backgroundImage = `url("${путьРесурса(ВСТУПЛЕНИЕ.кадры.прибытие)}")`;
    строка(П.бросок.зов, 'он');
    await ждать(тихо ? 300 : 1100);
    if (конец) return;
    const метр = $('.пролог-метр'), метка = $('.пролог-метка');
    метр.hidden = false; строка(П.бросок.подсказка, 'подсказка');
    let x = 0, вперёд = true, т0 = performance.now(), идёт = true;
    const скорость = тихо ? 0.45 : 0.9; // ширин в секунду
    const ход = т => {
      if (!идёт || конец) return;
      const dt = (т - т0) / 1000; т0 = т;
      x += (вперёд ? 1 : -1) * скорость * dt;
      if (x >= 1) { x = 1; вперёд = false; } if (x <= 0) { x = 0; вперёд = true; }
      метка.style.left = (x * 100) + '%';
      requestAnimationFrame(ход);
    };
    requestAnimationFrame(ход);
    await new Promise(r => { ждём = () => { ждём = null; r(); }; });
    идёт = false;
    const удача = Math.abs(x - 0.5) <= 0.14;
    ов.dataset.бросок = удача ? 'удача' : 'мимо';
    метр.hidden = true;
    $('.пролог-бросок').classList.add('летит');
    звук('взмах');
    await ждать(тихо ? 200 : 750);
    звук(удача ? 'тумба' : 'всплеск');
    await ждать(тихо ? 0 : 150);
    строка(удача ? П.бросок.удача : П.бросок.мимо, 'рассказ');
    await касание(3200);
  }

  async function разговор() {
    ов.dataset.сцена = 'разговор';
    $('.пролог-бросок').classList.remove('летит');
    for (const р of П.разговор) {
      if (конец) return;
      строка(р.т, р.кто === 'он' ? 'он' : 'рассказ');
      if (р.пауза) ов.classList.add('тишина');
      await касание(р.пауза ? 4200 : 3000, 600);
    }
    ов.dataset.сцена = 'удар';
    строка('');
    await ждать(700);
    музыка('печаль');
    строка(П.удар, 'удар');
    await касание(3400, 900);
  }

  (async () => {
    for (const шаг of [тьма, ролик, бросок, разговор]) { if (конец) return; await шаг(); }
    закончить();
  })();
}
