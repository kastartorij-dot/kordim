// Задник: картинка района или места на весь экран под интерфейсом. Смена кадра — плавная,
// поверх — час суток, тинт места, туман и дождь. Решений о мире не принимает.
const БАЗА = new URL('../Ресурсы/', import.meta.url).href;

const загружено = new Map(); // url → Promise

function загрузить(url) {
  if (!загружено.has(url)) загружено.set(url, new Promise(ок => { const i = new Image(); i.onload = () => ок(true); i.onerror = () => ок(false); i.src = url; }));
  return загружено.get(url);
}

let ключ = null;
// опции: позиция (CSS background-position), размер (CSS background-size), время, погода, тинт, глубина ('мягко'|'темно')
export function задник(url, о = {}) {
  const з = document.getElementById('задник');
  if (!з) return;
  з.dataset.время = о.время ?? '';
  з.dataset.погода = о.погода ?? '';
  з.dataset.глубина = о.глубина ?? '';
  з.querySelector('.з-тинт').style.background = о.тинт ?? '';
  const новый = (url ?? '') + '|' + (о.позиция ?? '') + '|' + (о.размер ?? '');
  if (новый === ключ) return;
  ключ = новый;
  const показать = () => {
    if (ключ !== новый) return; // пока грузилась, просили другую
    const кадр = document.createElement('div');
    кадр.className = 'з-кадр';
    if (url) кадр.style.backgroundImage = `url("${url}")`;
    if (о.позиция) кадр.style.backgroundPosition = о.позиция;
    if (о.размер) кадр.style.backgroundSize = о.размер;
    з.querySelector('.з-кадры').appendChild(кадр);
    requestAnimationFrame(() => requestAnimationFrame(() => кадр.classList.add('видно')));
    setTimeout(() => { for (const к of [...з.querySelectorAll('.з-кадр')]) if (к !== кадр && к.classList.contains('видно')) к.remove(); }, 900);
  };
  if (!url) return показать();
  загрузить(url).then(показать);
}

export const путьРесурса = п => БАЗА + п;
// Для района без рисунка — его кусок общей карты, приближенный к центру района.
export function кадрКарты(x, y, масштаб = 3.2) {
  return { url: БАЗА + 'карта.webp', позиция: `${x}% ${y}%`, размер: `${масштаб * 100}% auto` };
}

