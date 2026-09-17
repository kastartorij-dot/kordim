/* Кнопка «обновить»: подтянуть свежую версию сайта, не закрывая приложение.
   Сайт статический (Cloudflare отдаёт файлы из git как есть), номера версии у него нет,
   поэтому «версия» — это ETag / Last-Modified / длина каждого нашего файла (js, css, json).
   При старте запоминаем их, при возврате в приложение и раз в несколько минут переспрашиваем
   лёгкими HEAD-запросами; что-то поменялось — на кнопке загорается точка.
   Нажатие перекачивает все файлы мимо кэша браузера и перезагружает страницу. */
import { $ } from './ui.js';

const CHECK_EVERY = 5 * 60 * 1000;
const EXTRA = ['../game/Index.html'];   // iframe игры грузится своим документом, в список ресурсов не попадает

const btn = $('#updBtn');
const seen = new Map();   // url → подпись файла при первой проверке
let checking = false;

/* все свои текстовые файлы, которые страница уже загрузила: модули, данные, стили */
function ownFiles() {
  const urls = performance.getEntriesByType('resource')
    .map(e => e.name.split('#')[0])
    .filter(u => u.startsWith(location.origin) && /\.(js|mjs|css|json|html)(\?|$)/.test(u));
  urls.push(new URL('index.html', location.href).href, ...EXTRA.map(u => new URL(u, location.href).href));
  return [...new Set(urls)];
}

async function signature(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const h = r.headers;
    return h.get('etag') || h.get('last-modified') || h.get('content-length') || null;
  } catch { return null; }   // нет сети — молчим, не выдумываем обновление
}

async function check() {
  if (checking || btn.classList.contains('has-update') || document.hidden || !navigator.onLine) return;
  checking = true;
  try {
    const files = ownFiles();
    const sigs = await Promise.all(files.map(signature));
    let changed = false;
    files.forEach((u, i) => {
      if (sigs[i] == null) return;
      if (!seen.has(u)) seen.set(u, sigs[i]);        // файл подгрузился позже старта — просто запомнить
      else if (seen.get(u) !== sigs[i]) changed = true;
    });
    if (changed) {
      btn.classList.add('has-update');
      btn.title = 'Есть новая версия — нажми, чтобы загрузить';
    }
  } finally { checking = false; }
}

btn.onclick = async () => {
  if (btn.classList.contains('busy')) return;
  btn.classList.add('busy');
  btn.setAttribute('aria-busy', 'true');
  /* перекачать всё в обход кэша, чтобы после перезагрузки браузер не достал старый модуль */
  await Promise.all(ownFiles().map(u => fetch(u, { cache: 'reload', signal: AbortSignal.timeout(15000) }).catch(() => {})));
  location.reload();
};

/* первая подпись — когда страница успокоилась, а не в гонке со стартовой загрузкой */
setTimeout(check, 4000);
setInterval(check, CHECK_EVERY);
document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
addEventListener('online', check);
