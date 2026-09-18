// Экран места (сейчас — «Синий час»): вёрстка старой игры — фон, тинт по часам, полоска часов, портрет,
// реплика, «КАК СКАЗАТЬ», «ЧТО ТЫ ЗНАЕШЬ», план дома, откат. Единственный файл места, что трогает DOM.
// Что показывать и что нажимать — решает движок/разговор.js (видСцены, действияСцены).
import { видСцены, видПлана, действияСцены, выбратьПодход, назад, вернутьсяВГород, догрузитьСцену, описаниеМеста, данныеМеста } from './разговор.js';

const $ = id => document.getElementById(id);
const экр = т => String(т).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Путь разный у копии на сайте и у оригинала — тот же приём, что в старой игре.
const БАЗА = location.pathname.includes('/game/') ? '../../img/' : '../../wiki/img/';

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

const читатьСцену = id => fetch(`./сцены/близость/${id}.md`).then(р => (р.ok ? р.text() : null));

function убратьОверлеи() {
  document.querySelectorAll('.ov.мест').forEach(o => o.remove());
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
        <div class="meter"><span class="lbl">${сл.дом}</span><span class="mono" id="дом" style="font-size:12px;color:#9fb4dd">${экр(в.дом)}</span></div>
        <span class="mono" id="долг" style="font-size:12px;color:var(--krov)">${S.мир.места[S.сцена.место].долг ? '(долг ' + S.мир.места[S.сцена.место].долг + ')' : ''}</span>
        <button class="b" id="назад" ${в.можноНазад ? '' : 'disabled'} style="margin-left:auto;padding:8px 12px;font-size:14px;line-height:1" title="${сл.назад}" aria-label="${сл.назад}">&#8592;</button>
        <button class="b px" id="карта" style="font-size:9px;padding:9px 12px">${сл.карта}</button>
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

  $('temy').innerHTML = в.темы.length
    ? `<div class="h">${сл.знаешь}</div>` + в.темы.map(т => `<div class="t">${экр(т)}</div>`).join('') : '';

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
  $('say').innerHTML = (в.моя ? '<span class="my">— ' + экр(в.моя) + '</span>\n\n' : '') + экр(в.реплика);

  if (в.подходы) {
    const т = $('tone');
    т.innerHTML = `<span class="lbl">${сл.какСказать}</span>`;
    for (const ход of в.подходы) {
      const b = document.createElement('button');
      b.className = 'b' + (ход.активен ? ' on' : '');
      b.textContent = ход.id;
      b.onclick = () => { выбратьПодход(S, ход.id); onШаг(S); };
      т.appendChild(b);
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
  for (const а of действияСцены(S)) {
    const b = document.createElement('button');
    b.className = 'b';
    b.disabled = !а.можно;
    if (!а.можно && а.почему) b.title = а.почему;
    b.innerHTML = '<span class="row"><span>' + экр(а.текст) + '</span>' +
      (а.подпись ? '<span class="cost' + (а.подпись.includes('гр') ? ' gr' : '') + '">' + экр(а.подпись) + '</span>' : '') + '</span>';
    if (а.можно) b.onclick = () => { а.выполнить(S); onШаг(S); };
    acts.appendChild(b);
  }

  $('назад').onclick = () => { if (назад(S)) onШаг(S); };
  $('карта').onclick = () => показатьПлан(S);

  if (в.итог) показатьИтог(S, в.итог, onШаг);

  // текст сцены близости лежит файлом: подгружаем и рисуем заново
  if (S.сцена.нужнаСцена) догрузитьСцену(S, читатьСцену).then(ок => { if (ок) onШаг(S); });
}

function показатьИтог(S, итог, onШаг) {
  const Э = описаниеМеста(S), Ч = данныеМеста(S).СЧЁТ, сл = Э.подпись;
  const ov = document.createElement('div');
  ov.className = 'ov мест finov';
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
  ov.className = 'ov мест';
  ov.innerHTML = '<div class="ovbox"><h1>' + п.заг + '</h1>' +
    '<p style="color:#9aa3b5;font-size:14px">' + экр(п.вступление) + '</p>' +
    '<div id="mapgrid">' + п.клетки.map(к => '<div class="' + к.класс + '">' + экр(к.имя) + '<small>' + экр(к.подпись) + '</small></div>').join('') + '</div>' +
    '<p style="color:#7c8699;font-size:13px;margin-top:14px">' + экр(п.ключ) + '</p>' +
    '<button class="b" id="закрыть" style="margin-top:8px">' + п.закрыть + '</button></div>';
  document.body.appendChild(ov);
  ov.querySelector('#закрыть').onclick = () => ov.remove();
}
