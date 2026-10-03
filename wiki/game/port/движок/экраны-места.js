// Экран места (сейчас — «Синий час»): вёрстка старой игры — фон, тинт по часам, полоска часов, портрет,
// реплика, «КАК СКАЗАТЬ», «ЧТО ТЫ ЗНАЕШЬ», план дома, откат. Единственный файл места, что трогает DOM.
// Что показывать и что нажимать — решает движок/разговор.js (видСцены, действияСцены).
import { видСцены, видПлана, действияСцены, выбратьПодход, показатьТему, назад, вернутьсяВГород, догрузитьСцену, описаниеМеста, данныеМеста } from './разговор.js';

const $ = id => document.getElementById(id);
const экр = т => String(т).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Путь разный у копии на сайте и у оригинала — тот же приём, что в старой игре.
const БАЗА = new URL('../assets/', import.meta.url).href;

// Картинок может не быть — тогда остаются заглушки; как только файл положат в wiki/img/, он подхватится сам.
const проверено = {};
function естьФайл(путь, ок, нет) {
  if (проверено[путь] !== undefined) { (проверено[путь] ? ок : (нет || (() => {})))(); return; }
  const i = new Image();
  i.onload = () => { проверено[путь] = true; ок(); };
  i.onerror = () => { проверено[путь] = false; if (нет) нет(); };
  i.src = путь;
}
// Перебирает пути по порядку и отдаёт первый существующий: переезд картинок по папкам ничего не ломает.
function перваяКартинка(пути, ок) {
  const шаг = i => {
    if (i >= пути.length) return;
    естьФайл(пути[i].путь, () => ок(пути[i]), () => шаг(i + 1));
  };
  шаг(0);
}

// Служебные пометки верности темы в панели «ЧТО ТЫ ЗНАЕШЬ».
const МЕТКИ = { слышал: ' (слух)', опровергнуто: ' (враньё)' };

const читатьСцену = id => fetch(`./сцены/близость/${id}.md`).then(р => (р.ok ? р.text() : null));

function убратьОверлеи() {
  document.querySelectorAll('.ов.мест').forEach(o => o.remove());
}

export function рендерМесто(S, onШаг) {
  убратьОверлеи();
  const в = видСцены(S);
  const Э = описаниеМеста(S), сл = Э.подпись, д = данныеМеста(S);
  const поле = $('экран');
  поле.classList.add('в-месте');

  let пипсы = '';
  for (let i = 0; i < в.пипсы.всего; i++) {
    const c = i < в.пипсы.прошло ? 'pip on' : i === в.пипсы.прошло ? 'pip now' : 'pip';
    пипсы += `<span class="${c}"></span>`;
  }
  поле.innerHTML = `
    <div id="место">
      <div id="полоса">
        <div class="meter"><span class="lbl">${сл.вечер}</span><div class="pips">${пипсы}</div></div>
        ${в.дом === null ? '' : `<div class="meter"><span class="lbl">${сл.дом}</span><span class="mono" id="дом" style="font-size:12px;color:#9fb4dd">${экр(в.дом)}</span></div>
        <span class="mono" id="долг" style="font-size:12px;color:var(--krov)">${S.мир.места[S.сцена.место].долг ? '(долг ' + S.мир.места[S.сцена.место].долг + ')' : ''}</span>`}
        <button class="b" id="назад" ${в.можноНазад ? '' : 'disabled'} style="margin-left:auto;padding:8px 12px;font-size:14px;line-height:1" title="${сл.назад}" aria-label="${сл.назад}">&#8592;</button>
        ${в.план ? `<button class="b px" id="карта" style="font-size:9px;padding:9px 12px">${сл.карта}</button>` : ''}
      </div>
      <div id="scene">
        <div id="bg"></div><div id="tint"></div><div id="scan"></div><div id="bgtag"></div>
        <div id="temy"></div><div id="portrait"></div>
      </div>
      <div id="plate">
        <div id="who"></div><p id="say"></p><div id="tone"></div><div id="acts"></div>
      </div>
    </div>`;

  // фон и тинт
  $('bg').style.background = в.фон.градиент;
  $('bgtag').textContent = в.фон.подпись;
  const эта = S.сцена.комната;
  const пути = [];
  д.КАРТИНКИ.папкиФонов.forEach(п => ['.jpg', '.webp', '.png'].forEach(р => пути.push({ путь: БАЗА + п + эта + р })));
  перваяКартинка(пути, найден => {
    if (!S.сцена || S.сцена.комната !== эта || !$('bg')) return; // комнату успели сменить
    // 40% по высоте: низ кадра всё равно перекрыт плашкой, а главное обычно выше середины
    $('bg').style.background = 'url(' + найден.путь + ') center 40%/cover no-repeat, ' + в.фон.градиент;
    $('bgtag').textContent = '';
  });
  $('tint').style.background = в.тинт;

  // Панель тем: у слуха — «(слух)», у опровергнутого — «(враньё)» и приглушённо; нажал — текст темы в поле реплики.
  $('temy').innerHTML = в.темы.length ? `<div class="h">${сл.знаешь}</div>` : '';
  for (const т of в.темы) {
    const d = document.createElement(т.можно ? 'button' : 'div');
    d.className = 't' + (т.верность === 'опровергнуто' ? ' враньё' : '') + (т.можно ? ' жми' : '');
    d.textContent = т.ярлык + (МЕТКИ[т.верность] ?? '');
    if (т.можно) d.onclick = () => { if (показатьТему(S, т.id)) onШаг(S); };
    $('temy').appendChild(d);
  }

  // портрет
  const п = $('portrait');
  if (в.портрет) {
    п.style.display = 'flex';
    п.innerHTML = сл.портрет + '<br>' + экр(в.портрет.файл);
    п.className = '';
    п.style.padding = '0 8px 14px';
    const этот = S.сцена.собеседник;
    // Вырезанный по фону (.webp, .png) — во весь рост без рамы; обычное фото (.jpg) — в пиксельной раме.
    const пп = [];
    ['.webp', '.png'].forEach(р => {
      const имя = в.портрет.файл.replace(/\.jpg$/, р);
      д.КАРТИНКИ.папкиЛиц.forEach(папка => пп.push({ путь: БАЗА + папка + имя, спрайт: true }));
    });
    д.КАРТИНКИ.папкиЛиц.forEach(папка => пп.push({ путь: БАЗА + папка + в.портрет.файл, спрайт: false }));
    перваяКартинка(пп, найден => {
      if (!S.сцена || S.сцена.собеседник !== этот || !п) return; // собеседника успели сменить
      п.style.padding = '0';
      п.className = найден.спрайт ? 'sprite' : '';
      п.innerHTML = '<img src="' + найден.путь + '" alt="' + экр(в.портрет.имя) + '"' +
        (найден.спрайт ? '>' : ' style="display:block;width:100%;height:100%;object-fit:cover;object-position:50% 18%">');
    });
  }

  $('who').innerHTML = `<b>${экр(в.заголовок.имя)}</b><span>${экр(в.заголовок.справа)}</span>`;
  // Диалог-граф (Сиб): лента вместо одной реплики. Новые записи приходят снизу; лента сама докручивается.
  if (в.диалог) рисоватьЛенту($('say'), в.диалог.лента);
  else { $('say').classList.remove('лента'); $('say').innerHTML = (в.моя ? '<span class="my">— ' + экр(в.моя) + '</span>\n\n' : '') + экр(в.реплика); }

  if (в.подходы) {
    const т = $('tone');
    т.innerHTML = `<span class="lbl">${сл.какСказать}</span>`;
    for (const ход of в.подходы) {
      const b = document.createElement('button');
      b.className = 'b' + (ход.активен ? ' on' : '');
      b.textContent = ход.id;
      if (ход.можно) b.onclick = () => { выбратьПодход(S, ход.id); onШаг(S); };
      else { b.disabled = true; b.title = ход.почему; }
      т.appendChild(b);
      if (!ход.можно) {
        const п = document.createElement('span');
        п.className = 'lbl';
        п.textContent = ход.почему;
        т.appendChild(п);
      }
    }
    if (в.любит) {
      const s = document.createElement('span');
      s.className = 'lbl';
      s.style.marginLeft = '6px';
      s.textContent = в.любит;
      т.appendChild(s);
    }
  }

  const acts = $('acts');
  let номер = 0;
  клавишиВариантов = new Map();
  for (const а of действияСцены(S)) {
    const b = document.createElement('button');
    const вариант = а.вид === 'вариант';
    b.className = 'b' + (вариант ? ' вар' + (а.красная ? ' красная' : '') + (а.закреплён ? ' закреплён' : '') : '');
    b.disabled = !а.можно;
    if (!а.можно && а.почему) b.title = а.почему;
    // Вариант диалога: номер, чип проверки «ГОЛОС · порог · шанс%» (нажать — разбор модификатора), цена в грошах.
    const чип = вариант && а.карточка ? `<span class="чип ${а.красная ? 'кр' : ''}" data-ч="1" title="${экр(разборЧипа(а.карточка))}">${экр(а.метка)}${а.ещёРаз ? ' · ещё раз' : ''}</span>` : '';
    const ном = вариант && !а.закреплён ? `<span class="ном">${++номер}.</span>` : '';
    b.innerHTML = '<span class="row"><span>' + ном + экр(а.текст) + '</span>' + чип +
      (а.подпись ? '<span class="cost' + (а.подпись.includes('гр') ? ' gr' : '') + '">' + экр(а.подпись) + '</span>' : '') + '</span>';
    if (!а.можно && а.почему && вариант) b.insertAdjacentHTML('beforeend', `<span class="почему">${экр(а.почему)}</span>`);
    if (а.можно) b.onclick = ев => {
      if (ев.target.closest?.('[data-ч]') && ev_разбор(ев)) return; // нажатие на чип — только разбор, без выбора варианта
      а.выполнить(S); onШаг(S);
    };
    acts.appendChild(b);
    if (вариант && !а.закреплён && номер <= 9) клавишиВариантов.set(String(номер), b);
  }

  $('назад').onclick = () => { if (назад(S)) onШаг(S); };
  if (в.план) $('карта').onclick = () => показатьПлан(S);

  if (в.итог) показатьИтог(S, в.итог, onШаг);

  // текст сцены близости лежит файлом: подгружаем и рисуем заново
  if (S.сцена.нужнаСцена) догрузитьСцену(S, читатьСцену).then(ок => { if (ок) onШаг(S); });
}

// Цифровые клавиши выбирают видимые варианты; браузерные поля ввода их не перехватывают.
let клавишиВариантов = new Map();
document.addEventListener('keydown', ев => {
  if (ев.altKey || ев.ctrlKey || ев.metaKey || /INPUT|TEXTAREA|SELECT/.test(ев.target?.tagName ?? '') || ев.target?.isContentEditable) return;
  const кнопка = клавишиВариантов.get(ев.key);
  if (кнопка?.isConnected && !кнопка.disabled) { ев.preventDefault(); кнопка.click(); }
});

// ── лента диалога ───────────────────────────────────────────────────────
const ЗНАК = { нпс: 'нпс', нарратив: 'нар', герой: 'гер', видят: 'вид', врезка: 'гол', бросок: 'бр' };
function рисоватьЛенту(поле, лента) {
  поле.classList.add('лента');
  поле.innerHTML = лента.map(з => {
    if (з.вид === 'врезка') return `<div class="з гол" style="--г:${з.цвет}"><b>${экр(з.голос)}</b> ${экр(з.т)}</div>`;
    if (з.вид === 'бросок') return `<div class="з бр ${з.успех ? 'ок' : 'не'}" style="--г:${з.цвет ?? '#9aa3b5'}" title="${экр(разборБроска(з))}">${экр(з.т)}</div>`;
    if (з.вид === 'герой') return `<div class="з гер">— ${экр(з.т)}</div>`;
    return `<div class="з ${ЗНАК[з.вид] ?? 'нар'}">${экр(з.т)}</div>`;
  }).join('');
  // «всегда последнее вниз»: лента докручивается к новой записи
  поле.scrollTop = поле.scrollHeight;
}
const разборЧипа = к => `Порог ${к.порог}, шанс ${к.шанс}%. ` + (к.мод.части.length ? к.мод.части.map(ч => `${ч.д > 0 ? '+' : ''}${ч.д} ${ч.что}`).join('; ') : 'без модификаторов');
const разборБроска = з => `Попытка ${з.попытка}, шанс был ${з.шанс}%. ` + (з.части?.length ? з.части.map(ч => `${ч.д > 0 ? '+' : ''}${ч.д} ${ч.что}`).join('; ') : 'без модификаторов');
// Чип разбирается по нажатию: подпись-подсказка показывается внутри кнопки, вариант не выбирается.
function ev_разбор(ев) {
  const ч = ев.target.closest('[data-ч]');
  const кнопка = ч.closest('button');
  let р = кнопка.querySelector('.разбор');
  if (р) { р.remove(); return true; }
  кнопка.insertAdjacentHTML('beforeend', `<span class="разбор">${ч.title}</span>`);
  return true;
}

function показатьИтог(S, итог, onШаг) {
  const Э = описаниеМеста(S), Ч = данныеМеста(S).СЧЁТ, сл = Э.подпись;
  const ov = document.createElement('div');
  ov.className = 'ов мест finov';
  ov.innerHTML = '<div class="ovbox"><h1>' + экр(итог.заг) + '</h1><p style="white-space:pre-wrap">' + экр(итог.текст) + '</p>' +
    '<h2>' + Ч.заг + '</h2><div class="fin">' +
    итог.строки.map(с => '<div class="ln"><span>' + экр(с[0]) + '</span><span>' + экр(с[1]) + '</span></div>').join('') + '</div>' +
    (итог.утечки.length ? '<h2>' + Ч.загУтечки + '</h2>' + итог.утечки.map(у => '<p style="color:#c6cddb;font-size:15px">— ' + экр(у) + '</p>').join('') : '') +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">' +
    (S.история.length ? '<button class="b" id="откат">&#8592; ' + сл.назад + '</button>' : '') +
    '<button class="b" id="выйти">' + сл.выйти + '</button></div></div>';
  document.body.appendChild(ov);
  ov.querySelector('#выйти').onclick = () => { ov.remove(); $('экран').classList.remove('в-месте'); вернутьсяВГород(S); onШаг(S); };
  const u = ov.querySelector('#откат');
  if (u) u.onclick = () => { if (назад(S)) onШаг(S); };
}

function показатьПлан(S) {
  const п = видПлана(S);
  const ov = document.createElement('div');
  ov.className = 'ов мест';
  ov.innerHTML = '<div class="ovbox"><h1>' + п.заг + '</h1>' +
    '<p style="color:#9aa3b5;font-size:14px">' + экр(п.вступление) + '</p>' +
    '<div id="mapgrid">' + п.клетки.map(к => '<div class="' + к.класс + '">' + экр(к.имя) + '<small>' + экр(к.подпись) + '</small></div>').join('') + '</div>' +
    '<p style="color:#7c8699;font-size:13px;margin-top:14px">' + экр(п.ключ) + '</p>' +
    '<button class="b" id="закрыть" style="margin-top:8px">' + п.закрыть + '</button></div>';
  document.body.appendChild(ov);
  ov.querySelector('#закрыть').onclick = () => ov.remove();
}
