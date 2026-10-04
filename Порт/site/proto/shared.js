/* Общие данные и механики для прототипов. Факты — из мастер-канона 13.09. */

const PLACES = [
  {n:'Ошерск',   x:56.5, y:12,   t:'Речной город ~12 000. Подвал «Утопленника» в Приречье.'},
  {n:'Столица',  x:55,   y:27,   t:'Каналы, Совет, контора Сайдена в сером здании без вывески.'},
  {n:'Порт Теней',x:27.5,y:45,   t:'Чёрный рынок, поделённый тремя синдикатами.'},
  {n:'Смитгард', x:85.5, y:47.5, t:'Город-кузня, власть Коллегии.'},
  {n:'Врата',    x:64,   y:62.5, t:'Южный КПП, лучший рынок слухов за пределами Столицы.'},
  {n:'Ручейный', x:48.5, y:69,   t:'Лесная деревня. В двух часах пешком — Нора.'},
  {n:'Топь',     x:70,   y:87.5, t:'Дома на сваях. Ни гарнизона, ни конторы, ни Церкви.'},
  {n:'Морской',  x:37.5, y:11,   t:'Сорок человек — всё, что осталось от земель Астернов.'}
];

/* miles — длина; ground — грунт, осенью и зимой медленнее */
const ROUTES = [
  {n:'Речной тракт', e:'Ошерск — Столица', k:'water', miles:74, ground:false,
   p:[[56.5,12.6],[58,16.5],[57.6,20.5],[56.2,24],[55,27]],
   note:'Мосты Ошерска берут пошлину на обоих берегах.', winter:'Река встаёт на два месяца — баржи не ходят.',
   ev:['Мост берёт пошлину: два гроша с лошади.','Мимо идёт баржа Крайма, гружёная вином.','Ночлег у перевоза.']},
  {n:'Лесной тракт', e:'Столица — Порт Теней', k:'rough', miles:148, ground:true,
   p:[[55,27],[51.5,31.5],[48,37],[44.5,42.5],[39.5,45.8],[33.5,45.8],[27.5,45]],
   note:'Только группой от шести. Под словом Сайдена — пошлина Кессу, без него — всё.', winter:'Для обозов непроходим.',
   ev:['Сумерки в ельнике. Огонь лучше не разводить.','!Люди Кесса на тропе. Пошлина — две марки.','!Стрела из ельника ушла в дерево.','Опушка. Дым Порта Теней на горизонте.']},
  {n:'Южный тракт', e:'Столица — Врата', k:'road', miles:111, ground:false,
   p:[[55,27],[58,33],[61,41],[63.5,50],[64.8,56.5],[64,62.5]],
   note:'Армия содержит дорогу. Самый законный тракт — и самый плотный на проверки.',
   ev:['!Армейский разъезд проверяет бумаги.','Дорогу недавно чинили.','Общая комната, два гроша за ночь.']},
  {n:'Южный обход', e:'Врата — Порт Теней', k:'road', miles:166, ground:true,
   p:[[64,62.5],[58.5,66],[52.5,68.5],[48.5,69],[42,70.5],[35,66],[29.5,56],[27.5,45]],
   note:'Долго, но безопасно. Работает круглый год.',
   ev:['Ручейный молчит, как всегда.','Лавочник: «На юг не ходи».','Спокойный день.','Берег, чайки, Порт Теней.']},
  {n:'Восточный тракт', e:'Столица — Смитгард', k:'road', miles:185, ground:true,
   p:[[55,27],[62,29.5],[69.5,33.5],[76.5,39.5],[82,44.5],[85.5,47.5]],
   note:'Металл на запад, заказы на восток. Дом Рохт.',
   ev:['Обоз с рудой занял всю дорогу.','Дым кузен виден за день пути.','Смитгард.']}
];

const SPEED = {horse:37, foot:22, cart:15};
function daysFor(r, season, mode){
  let d = r.miles / SPEED[mode];
  if (r.ground && season !== 'summer') d *= season === 'winter' ? 2.2 : 1.6;
  return d;
}
function closedFor(r, season, mode){
  return season === 'winter' && (r.k === 'water' || (r.k === 'rough' && mode === 'cart'));
}

/* линии трактов + бегущий поток поверх */
function drawRoutes(svg, onPick){
  const NS = 'http://www.w3.org/2000/svg';
  ROUTES.forEach((r, i) => {
    const pts = r.p.map(q => q.join(',')).join(' ');
    const a = document.createElementNS(NS, 'polyline');
    a.setAttribute('points', pts); a.setAttribute('class', 'route ' + r.k);
    a.addEventListener('click', () => onPick(i));
    const f = document.createElementNS(NS, 'polyline');
    f.setAttribute('points', pts); f.setAttribute('class', 'flow');
    svg.append(a, f);
  });
}
function markRoute(svg, i, season, mode){
  const lines = svg.querySelectorAll('.route'), flows = svg.querySelectorAll('.flow');
  ROUTES.forEach((r, k) => {
    const c = closedFor(r, season || 'summer', mode || 'horse');
    lines[k].classList.toggle('sel', k === i);
    lines[k].classList.toggle('closed', c);
    flows[k].classList.toggle('sel', k === i && !c);
  });
}
function drawPins(map, onPick){
  PLACES.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'pin'; b.style.left = p.x + '%'; b.style.top = p.y + '%'; b.dataset.i = i;
    b.innerHTML = '<i></i><span>' + p.n + '</span>';
    if (onPick) b.addEventListener('click', () => onPick(i));
    map.appendChild(b);
  });
}

/* путешествие по тракту: токен идёт по линии, дни и события сыплются в журнал */
function travel(r, {token, days, onDay, onEvent, onDone, speed = 90}){
  const pts = [];
  for (let s = 0; s < r.p.length - 1; s++)
    for (let t = 0; t < 12; t++){
      const a = r.p[s], b = r.p[s + 1];
      pts.push([a[0] + (b[0] - a[0]) * t / 12, a[1] + (b[1] - a[1]) * t / 12]);
    }
  pts.push(r.p[r.p.length - 1]);
  const total = Math.max(1, Math.round(days)), every = Math.floor(pts.length / r.ev.length);
  let k = 0, lastDay = 0;
  token.hidden = false;
  const id = setInterval(() => {
    const [x, y] = pts[k];
    token.style.left = x + '%'; token.style.top = y + '%';
    const day = Math.min(total, Math.floor(k / pts.length * total) + 1);
    if (day !== lastDay){ lastDay = day; onDay && onDay(day, total); }
    if (k % every === 0){
      const e = r.ev[k / every];
      if (e) onEvent && onEvent(e.replace(/^!/, ''), day, e.startsWith('!'));
    }
    if (++k >= pts.length){ clearInterval(id); onDone && onDone(total); }
  }, speed);
  return () => clearInterval(id);
}

/* пикселизация: size — ширина холста, levels — сколько уровней цвета на канал (0 = без огрубления) */
const _imgCache = {};
function pixelate(src, canvas, {size = 84, levels = 5, cover = true, focusY = .25} = {}){
  const draw = img => {
    const ratio = canvas.dataset.ratio ? +canvas.dataset.ratio : img.height / img.width;
    canvas.width = size; canvas.height = Math.round(size * ratio);
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = true;
    const cw = canvas.width, ch = canvas.height, ir = img.width / img.height, cr = cw / ch;
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    if (cover){ if (ir > cr){ sw = img.height * cr; sx = (img.width - sw) / 2 } else { sh = img.width / cr; sy = (img.height - sh) * focusY } }
    c.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    if (levels){
      const step = 255 / (levels - 1), d = c.getImageData(0, 0, cw, ch), a = d.data;
      for (let i = 0; i < a.length; i += 4) for (let q = 0; q < 3; q++) a[i + q] = Math.round(a[i + q] / step) * step;
      c.putImageData(d, 0, 0);
    }
  };
  if (_imgCache[src] && _imgCache[src].complete) return draw(_imgCache[src]);
  const img = _imgCache[src] = new Image(); img.onload = () => draw(img); img.src = src;
}

/* ─── Элоуэн ─── */
const ELOWEN = {
  name:'Элоуэн', alias:'«Игла»', role:'полевой хирург', img:'../img/faces/elowen.jpg',
  stats:[ {k:'Ремесло', v:9}, {k:'Выдержка', v:7}, {k:'Доверие', v:3, tone:'warm'}, {k:'Риск', v:7, tone:'hot'} ],
  items:[
    {i:'🔪', n:'Скальпель', t:'Не боец, но в тёмном переулке вскроет сонную артерию на рефлексах.'},
    {i:'🔥', n:'Ожог Ложи', t:'Метка изгнания на левом запястье. Руки сломать не успели.'},
    {i:'🥖', n:'Мешок муки', t:'Подарок Крайма. «Она врач. Ей несут — она шьёт».'},
    {i:'🌺', n:'Болотный мак', t:'Основа её дешёвых аналогов микстур. За это и выгнали.'}
  ],
  debts:[
    {i:'🧪', n:'Микстура в долг', t:'Тридцать кордов. Взяла одолжением, которое держала три года.'}
  ],
  /* состояние по годам — для варианта с хроникой */
  years:{
    1019:{where:'Столица, Нижний город', place:1, stats:[6,8,7,2], text:'Начинает тайно лечить Нижний город. Берёт правило: никогда не врать о том, кто был у неё на столе.', mark:'правило'},
    1021:{where:'Столица → Ошерск', place:1, route:0, stats:[7,6,6,6], text:'Двор бывшей дубильни. Первая встреча с Никто: зовёт его посмотреть руку в среду. В среду двор пуст — пришла Ложа. Ожог, три недели в подполе у пивовара, баржа вниз.', mark:'ожог'},
    1023:{where:'Ошерск, Синий двор', place:0, stats:[8,7,4,7], text:'Никто приносит на спине раненого приказчика Крайма. «Ты». Микстура в долг, цена — плеть и желчь до весны. Впервые за четыре года врёт людям Крайма.', mark:'долг'},
    1026:{where:'Приречье, «Утопленник»', place:0, stats:[9,7,3,7], text:'Подвал «Утопленника». Нож Никто лежит на полке между дурманом и живицей. Срок долга давно вышел.', mark:'сейчас'}
  }
};

/* диалог: Ошерск, 1023. Короткое дерево с выборами */
const DIALOG = {
  start:{who:'Элоуэн', say:'Ремм. Клади на стол. Руки мыть — там.', opts:[['Я приходил в среду.','wed'],['Он выживет?','live']]},
  wed:{who:'Элоуэн', say:'…', note:'Ведёт нить и не отвечает. Потом, не поднимая глаз:', next:'you'},
  you:{who:'Элоуэн', say:'Ты.', opts:[['Сколько стоит микстура?','price']]},
  live:{who:'Элоуэн', say:'До полудня протянет. Без микстуры — нет.', opts:[['Сколько?','price']]},
  price:{who:'Элоуэн', say:'Тридцать кордов. У тебя девять с половиной.', opts:[['Возьми в долг.','debt'],['Найду.','find']]},
  find:{who:'Элоуэн', say:'До полудня не найдёшь.', opts:[['Возьми в долг.','debt']]},
  debt:{who:'Элоуэн', say:'В долг возьму я. А ты принесёшь серую плеть и волчью желчь. До весны.', opts:[['Идёт.','thing']], gain:'debt'},
  thing:{who:'Элоуэн', say:'Оставь вещь. Люди, которые ушли и не вернулись, вещей не оставляют.', opts:[['Оставить нож. «До весны, Эли».','end']]},
  end:{who:null, say:'Нож лёг на полку между дурманом и живицей. Так её не звал никто.', gain:'knife', final:true}
};
const GAINS = {
  debt:{i:'🌿', n:'Плеть и желчь', t:'Долг Никто: серая плеть и волчья желчь до весны 1024-го. Срок вышел.', debt:true},
  knife:{i:'🗡️', n:'Нож Никто', t:'На полке между дурманом и живицей. Она его не убрала.', debt:true}
};

/* чат: рисует реплики и кнопки выбора в контейнер; стили — на стороне страницы */
function mountChat(box, {onGain, typing = 26} = {}){
  box.innerHTML = '';
  const log = document.createElement('div'); log.className = 'chat-log';
  const opts = document.createElement('div'); opts.className = 'chat-opts';
  box.append(log, opts);
  const add = (cls, html) => { const d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = html; log.appendChild(d); log.scrollTop = 1e9; return d; };
  function step(key){
    const n = DIALOG[key]; opts.innerHTML = '';
    if (n.note) add('sys', n.note);
    const m = add(n.who ? 'them' : 'sys', n.who ? '<b>' + n.who + '</b><span></span>' : '<span></span>');
    const span = m.querySelector('span'); let k = 0;
    const id = setInterval(() => {
      span.textContent = n.say.slice(0, ++k); log.scrollTop = 1e9;
      if (k >= n.say.length){
        clearInterval(id);
        if (n.gain && onGain) onGain(GAINS[n.gain]);
        if (n.next) return setTimeout(() => step(n.next), 700);
        if (n.final){ const b = document.createElement('button'); b.textContent = '↺ Сначала'; b.onclick = () => mountChat(box, {onGain, typing}); opts.appendChild(b); return; }
        (n.opts || []).forEach(([label, to]) => {
          const b = document.createElement('button'); b.textContent = label;
          b.onclick = () => { add('me', label); step(to); };
          opts.appendChild(b);
        });
      }
    }, typing);
  }
  step('start');
}
