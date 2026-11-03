// Страница песочницы: список игр, навык героя, вариант, звук, крупный исход и «Ещё раз».
// Игры подключаются по одной (import при выборе), чтобы ошибка в одной не роняла остальные.
// Вариант: если модуль игры экспортирует варианты = [{ id, имя }], над полем появляется выбор,
// и выбранный id уходит в запустить(контейнер, { навык, тихо, сигнал, вариант }). Без выбора — первый.
import { НАВЫКИ, звук } from './общее.js';
import { ЗАДУМКИ, заголовокРаздела } from './задумки.js';

const ИГРЫ = [
  { id: 'мотив', имя: 'Песня Норы', где: 'вечер в таверне · подпевать в такт' },
  { id: 'игла', имя: 'Игла', где: 'наколка на заказ · ведение линии' },
  { id: 'вес', имя: 'Вес', где: 'весы в доках · поймать покой' },
  { id: 'торг', имя: 'Торг', где: 'у Пина · доводы и внимание' },
  { id: 'кости', имя: 'Кости', где: 'с моряком · поймай подмену' },
  { id: 'комната', имя: 'Чтение комнаты', где: 'зал в полутьме · приметы и связка' },
  { id: 'счёт', имя: 'Счёт', где: 'накладная · найти неверную цифру' },
];
ИГРЫ.push(...ЗАДУМКИ);

const хранилище = {
  взять(к) { try { return localStorage.getItem('песочница:' + к); } catch { return null; } },
  положить(к, v) { try { localStorage.setItem('песочница:' + к, v); } catch { /* без памяти */ } },
};

const адрес = new URLSearchParams(location.search);
const сост = {
  игра: адрес.get('игра') || хранилище.взять('игра') || ИГРЫ[0].id,
  навык: Number(адрес.get('навык') ?? хранилище.взять('навык') ?? 0) || 0,
  тихо: адрес.has('звук') ? адрес.get('звук') === '0' : хранилище.взять('тихо') === '1',
  вариант: адрес.get('вариант'),
};
if (!ИГРЫ.some(и => и.id === сост.игра)) сост.игра = ИГРЫ[0].id;

const список = document.querySelector('.пс-список');
const сегменты = document.querySelector('.пс-сегменты');
const кнТихо = document.querySelector('.пс-кн-тихо');
const выборВарианта = document.createElement('label');
выборВарианта.className = 'пс-варианты';
выборВарианта.hidden = true;
выборВарианта.innerHTML = '<span class="пс-метка">вариант</span><select aria-label="Вариант игры"></select>';
сегменты.parentElement.after(выборВарианта);
const списокВариантов = выборВарианта.querySelector('select');
списокВариантов.addEventListener('change', () => {
  сост.вариант = списокВариантов.value;
  хранилище.положить('вариант:' + сост.игра, сост.вариант);
  пуск(сост.игра, { вариант: сост.вариант });
});
const место = document.querySelector('#игра');
const итог = document.querySelector('.пс-итог');

for (const и of ИГРЫ) {
  if (и === ЗАДУМКИ[0]) список.append(заголовокРаздела());
  const b = document.createElement('button');
  b.className = 'пс-пункт';
  b.dataset.id = и.id;
  b.innerHTML = `<b>${и.имя}</b><small>${и.где}</small>`;
  b.addEventListener('click', () => пуск(и.id));
  список.append(b);
}
НАВЫКИ.forEach((н, i) => {
  const b = document.createElement('button');
  b.textContent = н;
  b.addEventListener('click', () => {
    сост.навык = i;
    хранилище.положить('навык', String(i));
    отметить();
    пуск(сост.игра);
  });
  сегменты.append(b);
});
кнТихо.addEventListener('click', () => {
  сост.тихо = !сост.тихо;
  хранилище.положить('тихо', сост.тихо ? '1' : '0');
  звук.тихо = сост.тихо;
  отметить();
});

function отметить() {
  for (const b of список.children) b.setAttribute('aria-current', String(b.dataset.id === сост.игра));
  [...сегменты.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === сост.навык)));
  кнТихо.setAttribute('aria-pressed', String(сост.тихо));
  кнТихо.textContent = сост.тихо ? 'без звука' : 'звук: тихо';
}

let текущий = null;
// Варианты игры: показать выбор и вернуть id для запуска (выбранный, запомненный или первый).
function вариантДля(модуль, id, просили) {
  const в = Array.isArray(модуль.варианты) ? модуль.варианты : [];
  выборВарианта.hidden = !в.length;
  if (!в.length) return undefined;
  списокВариантов.replaceChildren(...в.map(x => new Option(x.имя, x.id)));
  const есть = v => v && в.some(x => x.id === v);
  const выбран = [просили, хранилище.взять('вариант:' + id)].find(есть) ?? в[0].id;
  списокВариантов.value = выбран;
  хранилище.положить('вариант:' + id, выбран);
  return выбран;
}

async function пуск(id, { вариант = null } = {}) {
  текущий?.abort();
  const мой = new AbortController();
  текущий = мой;
  const другаяИгра = id !== сост.игра;
  сост.игра = id;
  хранилище.положить('игра', id);
  const п = new URLSearchParams(location.search);
  п.set('игра', id);
  if (другаяИгра) п.delete('вариант');
  history.replaceState(null, '', '?' + п);
  отметить();
  итог.hidden = true;
  document.body.dataset.исход = '';
  звук.тихо = сост.тихо;
  try {
    const модуль = await import(`./${id}.js`);
    if (мой !== текущий) return;
    сост.вариант = вариантДля(модуль, id, вариант ?? (другаяИгра ? null : сост.вариант));
    if (сост.вариант) п.set('вариант', сост.вариант); else п.delete('вариант');
    history.replaceState(null, '', '?' + п);
    const р = await модуль.запустить(место, { навык: сост.навык, тихо: сост.тихо, сигнал: мой.signal, вариант: сост.вариант });
    if (мой !== текущий) return;
    показатьИтог(модуль, р, id);
  } catch (e) {
    if (e?.name === 'AbortError') return;
    console.error(e);
    место.textContent = 'Игра не запустилась: ' + (e?.message || e);
  }
}

function показатьИтог(модуль, р, id) {
  document.body.dataset.исход = `${id}:${р.уровень}:${р.очки}`;
  const слово = { плохо: 'Плохо', нормально: 'Нормально', отлично: 'Отлично' }[р.уровень];
  const вариант = модуль.варианты?.find(x => x.id === сост.вариант);
  const iв = вариант ? модуль.варианты.indexOf(вариант) : -1;
  const следВариант = iв >= 0 && модуль.варианты.length > 1 ? модуль.варианты[(iв + 1) % модуль.варианты.length] : null;
  итог.innerHTML = `<div class="пс-итог-панель">
    <div class="пс-итог-слово" data-у="${р.уровень}">${слово}</div>
    <p class="пс-итог-смысл">${модуль.СМЫСЛ?.[р.уровень] ?? ''}</p>
    <p class="пс-итог-очки">очки ${Math.round(р.очки * 100)} из 100 · навык: ${НАВЫКИ[сост.навык]}${вариант ? ` · ${вариант.имя}` : ''}</p>
    <div class="пс-кнопки"><button class="пс-кн" data-д="ещё">Ещё раз <small>Enter</small></button>${следВариант ? `<button class="пс-кн" data-д="вариант">Другой вариант <small>${следВариант.имя}</small></button>` : ''}<button class="пс-кн" data-д="дальше">Следующая игра</button></div>
  </div>`;
  итог.hidden = false;
  итог.querySelector('[data-д="ещё"]').addEventListener('click', () => пуск(id));
  итог.querySelector('[data-д="вариант"]')?.addEventListener('click', () => пуск(id, { вариант: следВариант.id }));
  итог.querySelector('[data-д="дальше"]').addEventListener('click', () => {
    const i = ИГРЫ.findIndex(и => и.id === id);
    пуск(ИГРЫ[(i + 1) % ИГРЫ.length].id);
  });
  итог.querySelector('[data-д="ещё"]').focus({ preventScroll: true });
}

window.песочница = { пуск, сост };
отметить();
пуск(сост.игра);
