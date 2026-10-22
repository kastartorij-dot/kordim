/* Единый ключ блока: одинаковые ссылки из поиска, карточек и вкладки «Канон». */
import { CANON } from '../Данные/canon.js';
import { SOURCES } from '../Данные/sources.js';

export const canonKey = (group, item) => group + '-' + String(item.id || item.title).toLowerCase().replace(/\s+/g, '-');

export function sourcesOf(kind, id){
  return (SOURCES[kind]?.[id] || []).map(([group, key]) => {
    const item = (CANON[group] || []).find(x => String(x.id ?? x.title) === String(key));
    return item ? {title:item.title, status:item.статус, href:'#/canon/' + encodeURIComponent(canonKey(group, item))} : null;
  }).filter(Boolean);
}
