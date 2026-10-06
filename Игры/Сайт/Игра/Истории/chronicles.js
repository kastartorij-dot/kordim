/* Интерфейс и память конкретной партии. Канон и статичный лорбук не изменяются. */
let isTurnRunning = false;
let isDemo = false;
let selectedHero = null;
let loreFilter = 'all';
const LORE_KINDS = { person: 'Люди', place: 'Места', item: 'Предметы', fact: 'Факты' };
const HERO_SKETCHES = [
 {name:'Дарен',gender:'мужской',age:'42',trade:'Мастер по дереву',origin:'Чинит двери, ставни и лодочные скамьи. Приехал в Порт Теней искать постоянную работу.',flaw:'Обещал вернуться домой до холодов, но пока не накопил на дорогу.',portrait:'craftsman.jpg'},
 {name:'Вера',gender:'женский',age:'58',trade:'Хозяйка комнат',origin:'Много лет сдавала жильё путникам. Теперь хочет открыть небольшой дом для постояльцев.',flaw:'Слишком охотно верит людям, которые напоминают ей о семье.',portrait:'hostess.jpg'}
];
const safeText = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cloneData = value => JSON.parse(JSON.stringify(value));
const shortText = (v,n=600) => typeof v === 'string' ? v.trim().slice(0,n) : '';
function safePortrait(value) { return ['craftsman.jpg','hostess.jpg'].includes(value) ? 'assets/'+value : ''; }
function normalizeLore(rows) {
 if (!Array.isArray(rows)) return [];
 return rows.slice(0,300).filter(x=>x&&typeof x==='object'&&Object.hasOwn(LORE_KINDS,x.kind)&&shortText(x.name,100)&&shortText(x.description)).map(x=>({
  kind:x.kind,name:shortText(x.name,100),description:shortText(x.description),certainty:['факт','слух','предположение'].includes(x.certainty)?x.certainty:'предположение',
  firstChapter:Math.max(1,Number(x.firstChapter)||1),lastChapter:Math.max(1,Number(x.lastChapter)||1),day:Math.max(1,Number(x.day)||1)
 }));
}
function loreKey(entry) { return entry.kind+':'+entry.name.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ').trim(); }
function getSessionLore() { return Array.isArray(gameState.sessionLore) ? gameState.sessionLore : []; }
function applySessionLore(delta,chapter) {
 const all = normalizeLore(getSessionLore());
 const added = [];
 normalizeLore(delta).slice(0,12).forEach(entry=>{
  const old = all.find(x=>loreKey(x)===loreKey(entry));
  entry.lastChapter=chapter; entry.day=gameState.day || 1;
  if(old) { entry.firstChapter=old.firstChapter; Object.assign(old,entry); }
  else { entry.firstChapter=chapter;all.push(entry);added.push(loreKey(entry)); }
 });
 gameState.sessionLore=all;
 return added;
}
function sessionLoreContext(history) {
 const recent=history.slice(-4).map(m=>m.content).join(' ').toLocaleLowerCase('ru');
 const rows=getSessionLore().slice().sort((a,b)=>b.lastChapter-a.lastChapter);
 const chosen=rows.filter((e,i)=>i<8||recent.includes(e.name.toLocaleLowerCase('ru'))||gameState.location?.includes(e.name));
 let result='';
 for(const e of chosen){const line=e.kind+' | '+e.name+' | '+e.certainty+' | '+e.description+'\n';if(result.length+line.length<=4000)result+=line;}
 return result ? 'ПАМЯТЬ ЭТОЙ СЕССИИ (факт — установлен, слух — лишь услышан, предположение — не подтверждено):\n'+result : '';
}
function beginNewStory() {
 if(isTurnRunning) return;
 const empty=[1,2,3].find(n=>!lsGet('kordim_save_'+n));
 if(empty) startNewGameProcess(empty);
 else { switchScreen('screen-setup');alert('Все три истории заняты. Экспортируй нужную и выбери кнопку начала заново у её слота.'); }
}
function portraitMarkup(hero,cls='hero-portrait') {
 const src=portraitSource(hero);
 return '<div class="'+cls+'">'+(src?'<img src="'+src+'" alt="Портрет героя">':'<span class="hero-monogram">'+safeText((hero.name||'?').slice(0,1))+'</span>')+'</div>';
}
function renderHeroOptions(container,heroes) {
 container.replaceChildren();
 heroes.forEach(hero=>{
  const card=document.createElement('button');card.className='hero-card';
  card.innerHTML=portraitMarkup(hero)+'<div class="hero-copy"><span class="eyebrow">'+safeText(hero.trade)+'</span><h3>'+safeText(hero.name)+'</h3><p>'+safeText(hero.origin)+'</p><p>'+safeText(hero.flaw)+'</p><div class="hero-footer">'+safeText(hero.age)+' '+plural(Number(hero.age),'год','года','лет')+' · Выбрать героя ↗</div></div>';
  card.addEventListener('click',()=>reviewHero(hero));container.appendChild(card);
 });
}
function renderStarterHeroes() {
 const sketches=HERO_SKETCHES.map(cloneData);
 for(let n=1;n<=3;n++){try{const c=JSON.parse(lsGet('kordim_save_'+n)||'null')?.character;if(c?.name){const pos=sketches.findIndex(h=>h.name===c.name);if(pos<0)sketches.push(c);else if(c.portraitKey)sketches[pos]=c;}}catch{}}
 renderHeroOptions(document.getElementById('starter-heroes'),sketches);
}
function chooseCustomHero() {
 const name=document.getElementById('new-name').value.trim();
 if(!name){document.getElementById('new-name').focus();return;}
 reviewHero({name,trade:document.getElementById('new-trade').value.trim()||'Без постоянного ремесла',origin:document.getElementById('new-origin').value.trim(),flaw:document.getElementById('new-flaw').value.trim(),gender:document.getElementById('char-gender').value,age:document.getElementById('char-age').value||'25'});
}
function showDetail(markup) {
 if(aiBusy||(manualPending&&!markup.includes('manual-packet')))return;
 document.getElementById('dialog-body').innerHTML=markup;
 const dialog=document.getElementById('detail-dialog');if(!dialog.open)dialog.showModal();
}
function closeDetail(){if(manualPending){cancelManual();return;}if(aiBusy)return;document.getElementById('detail-dialog').close();}
function reviewHero(hero) {
 selectedHero=cloneData(hero);
 showDetail('<span class="eyebrow">ПЕРЕД НАЧАЛОМ ИСТОРИИ</span><h2 id="dialog-title">'+safeText(hero.name)+'</h2><div class="portrait-dialog">'+portraitMarkup(hero,'sidebar-portrait')+'<div><p>'+safeText(hero.trade)+' · '+safeText(hero.age)+' лет</p><p>'+safeText(hero.origin)+'</p><p>'+safeText(hero.flaw)+'</p></div></div><label for="start-goal">С чего начнём?</label><textarea id="start-goal" rows="3" maxlength="1200" placeholder="Твоё намерение или пожелание к первой сцене…"></textarea><div class="dialog-actions"><button onclick="confirmHero()">Начать историю →</button><button class="btn-gray" onclick="openImageStudio(\'selected-portrait\')">Сгенерировать портрет</button><button class="btn-gray" onclick="closeDetail()">Вернуться к выбору</button></div>');
}
function confirmHero() {
 if(!selectedHero||isTurnRunning)return;
 applySettings();
 if(!apiKey&&aiSettings.mode!=='manual'){closeDetail();switchScreen('screen-setup');document.getElementById('connection-settings').open=true;document.getElementById('api-key').focus();alert('Для начала истории введи ключ OpenRouter в настройках рассказчика. Выбранный герой остаётся доступен на экране персонажей.');return;}
 character=cloneData(selectedHero);isDemo=false;document.body.dataset.demo='false';
 const chosen=document.getElementById('char-location').value;
 gameState.location=chosen||START_LOCATIONS[Math.floor(Math.random()*START_LOCATIONS.length)];
 gameState.scenario=null;gameState.direction=document.getElementById('start-goal').value.trim();
 gameState.money=40;closeDetail();
 startGame([character.name,character.origin,character.trade,character.flaw].join(' | '));
}
function showHeroCard() {
 if(!character.name)return;
 showDetail('<span class="eyebrow">ГЕРОЙ ЭТОЙ ХРОНИКИ</span><h2 id="dialog-title">'+safeText(character.name)+'</h2><div class="portrait-dialog">'+portraitMarkup(character,'sidebar-portrait')+'<div><p>'+safeText(character.trade)+' · '+safeText(character.age)+' лет</p><p>'+safeText(character.origin)+'</p><p>'+safeText(character.flaw)+'</p></div></div><p>Сейчас: '+safeText(gameState.location)+'</p><p>При себе: '+safeText(formatMoney(gameState.money))+'</p><p>Раны: '+safeText((gameState.wounds||[]).join(', ')||'нет')+'</p><div class="dialog-actions"><button class="btn-gray" onclick="openImageStudio(\'portrait\')">Сгенерировать портрет</button><button class="btn-gray" onclick="closeDetail();openCharacterScreen()" '+(isTurnRunning?'disabled':'')+'>Изменить сведения</button></div>');
}
function openInventory() {
 showDetail('<span class="eyebrow">ПРИ СЕБЕ</span><h2 id="dialog-title">Вещи и снаряжение</h2><p class="muted">'+safeText(formatMoney(gameState.money))+'</p>'+((gameState.inventory||[]).map(x=>'<div class="journal-entry">'+safeText(x)+'</div>').join('')||'<p class="muted">Пока нет записанных вещей.</p>'));
}
function openDirection() {
 showDetail('<span class="eyebrow">СТИЛЬ И ТЕМП ИСТОРИИ</span><h2 id="dialog-title">Указание рассказчику</h2><p class="muted">Сохраняется для следующих ходов. Можно попросить больше диалогов или спокойную повседневную сцену.</p><textarea id="direction-input" rows="6" maxlength="2000">'+safeText(gameState.direction||'')+'</textarea><button onclick="saveDirection()" '+(isTurnRunning?'disabled':'')+'>Сохранить</button>');
}
function saveDirection() {if(isTurnRunning)return;gameState.direction=document.getElementById('direction-input').value.trim();saveGame();closeDetail();}
function allStoryMessages() { return storyArchive.concat(chatHistory); }
function updateChronicleUI() {
 const put=(id,text)=>{document.getElementById(id).textContent=text;};
 put('sidebar-name',character.name||'Твой герой');put('sidebar-trade',character.trade||'');
 document.getElementById('sidebar-portrait').innerHTML=portraitMarkup(character,'sidebar-portrait');
 put('sidebar-location',gameState.location||'Начало пути');put('story-place',gameState.location||'Кордим');
 put('sidebar-money',formatMoney(gameState.money));put('sidebar-health',(gameState.wounds||[]).join(', ')||'Ран нет');
 put('lore-count',getSessionLore().length+' '+plural(getSessionLore().length,'запись','записи','записей'));
 document.getElementById('demo-notice').hidden=!isDemo;document.body.dataset.demo=String(isDemo);
 const list=document.getElementById('chapter-list');list.replaceChildren();
 allStoryMessages().forEach((msg,index)=>{if(msg.role!=='assistant')return;const b=document.createElement('button');b.textContent='Глава '+(msg.chapter||Math.floor(index/2)+1);b.onclick=()=>document.getElementById('chapter-'+index)?.scrollIntoView({behavior:'smooth',block:'start'});list.appendChild(b);});
}
function renderNarrative(target,text,lore=getSessionLore()) {
 target.replaceChildren();
 const entities=lore.filter(e=>e.kind!=='fact'&&e.name.length>=3).sort((a,b)=>b.name.length-a.name.length);
 if(!entities.length){target.textContent=text;return;}
 const pattern=new RegExp('('+entities.map(e=>escapeRegExp(e.name)).join('|')+')','giu');
 let last=0;for(const match of text.matchAll(pattern)){
  const before=text[match.index-1]||'';const after=text[match.index+match[0].length]||'';
  if(/[\p{L}\p{N}]/u.test(before)||/[\p{L}\p{N}]/u.test(after))continue;
  target.appendChild(document.createTextNode(text.slice(last,match.index)));
  const entry=entities.find(e=>e.name.toLocaleLowerCase('ru')===match[0].toLocaleLowerCase('ru'));
  const b=document.createElement('button');b.className='entity-link entity-'+entry.kind;b.textContent=match[0];b.onclick=()=>showLoreEntry(loreKey(entry));target.appendChild(b);last=match.index+match[0].length;
 }target.appendChild(document.createTextNode(text.slice(last)));
}
function appendDiscoveries(body,msg) {
 const entries=parseResponse(msg.content).loreDelta||[];if(!entries.length)return;
 const wrap=document.createElement('div');wrap.className='lore-discovery';
 const copy=document.createElement('div');const title=document.createElement('b');title.textContent=entries.length+' '+plural(entries.length,'запись','записи','записей')+' в памяти истории';
 const names=document.createElement('small');names.textContent=entries.map(x=>x.name).join(' · ');copy.append(title,names);
 const btn=document.createElement('button');btn.textContent='Открыть ↗';btn.onclick=()=>openSessionLore();wrap.append(copy,btn);body.appendChild(wrap);
}
function openSessionLore() {
 if(!gameStarted&&!chatHistory.length){showDetail('<h2 id="dialog-title">Энциклопедия сессии</h2><p class="muted">Здесь появятся люди, места и факты твоей истории. Начни хронику или открой пример из меню.</p>');return;}
 loreFilter='all';document.getElementById('lore-search').value='';switchScreen('screen-lore');renderLoreTabs();renderLoreCards();window.scrollTo(0,0);
}
function renderLoreTabs() {
 const box=document.getElementById('lore-tabs');box.replaceChildren();
 Object.entries({all:'Все',...LORE_KINDS}).forEach(([kind,label])=>{const b=document.createElement('button');const count=getSessionLore().filter(e=>kind==='all'||e.kind===kind).length;b.textContent=label+' · '+count;b.setAttribute('aria-pressed',String(loreFilter===kind));b.onclick=()=>{loreFilter=kind;renderLoreTabs();renderLoreCards();};box.appendChild(b);});
}
function renderLoreCards() {
 const box=document.getElementById('lore-cards');box.replaceChildren();const q=document.getElementById('lore-search').value.toLocaleLowerCase('ru');
 const rows=getSessionLore().filter(e=>(loreFilter==='all'||e.kind===loreFilter)&&[e.name,e.description].join(' ').toLocaleLowerCase('ru').includes(q)).sort((a,b)=>b.lastChapter-a.lastChapter);
 rows.forEach(e=>{const card=document.createElement('button');card.className='lore-card';card.innerHTML='<div class="eyebrow">'+LORE_KINDS[e.kind]+' · '+safeText(e.certainty)+'</div><h3>'+safeText(e.name)+'</h3><p>'+safeText(e.description)+'</p><small>Впервые: глава '+e.firstChapter+' · Обновлено: '+e.lastChapter+'</small>';card.onclick=()=>showLoreEntry(loreKey(e));box.appendChild(card);});
 if(!rows.length){box.innerHTML='<div class="empty-panel">'+(q?'Записей по этому запросу нет.':'Здесь пока нет записей. Они появятся после встреч и открытий в истории.')+'</div>';}
}
function showLoreEntry(key) {
 const e=getSessionLore().find(x=>loreKey(x)===key);if(!e)return;
 showDetail('<span class="eyebrow">'+LORE_KINDS[e.kind]+' · '+safeText(e.certainty)+'</span><h2 id="dialog-title">'+safeText(e.name)+'</h2><p>'+safeText(e.description)+'</p><p class="muted">Впервые в главе '+e.firstChapter+'. Последнее обновление: глава '+e.lastChapter+'.</p><details><summary>Исправить запись</summary><textarea id="lore-edit" rows="5" maxlength="600">'+safeText(e.description)+'</textarea><label for="lore-certainty">Статус</label><select id="lore-certainty"><option>факт</option><option>слух</option><option>предположение</option></select><button id="lore-save" '+(isTurnRunning?'disabled':'')+'>Сохранить</button></details>');
 document.getElementById('lore-certainty').value=e.certainty;
 document.getElementById('lore-save').onclick=()=>{if(isTurnRunning)return;e.description=document.getElementById('lore-edit').value.trim()||e.description;e.certainty=document.getElementById('lore-certainty').value;saveGame();renderLoreCards();closeDetail();};
}
function openJournal() {
 switchScreen('screen-journal');const box=document.getElementById('journal-entries');box.replaceChildren();
 events.concat(gameState.journal||[]).forEach(e=>{const row=document.createElement('article');row.className='journal-entry';row.innerHTML='<span class="eyebrow">ХРОНИКА · ДЕНЬ '+safeText(e.day)+'</span><p class="muted">'+safeText([...(Array.isArray(e.who)?e.who:typeof e.who==='string'?[e.who]:[]),e.where].filter(Boolean).join(' · '))+'</p><p>'+safeText(e.what)+'</p>';box.appendChild(row);});
 allStoryMessages().forEach((msg,i)=>{if(msg.role!=='assistant')return;const row=document.createElement('article');row.className='journal-entry';const parsed=parseResponse(msg.content);const after=msg.stateAfter;row.innerHTML='<span class="eyebrow">ГЛАВА '+(msg.chapter||Math.floor(i/2)+1)+'</span><h3>'+safeText(after?.location||parsed.stateDelta.location||'История продолжается')+'</h3><p>'+safeText(parsed.text.slice(0,400))+(parsed.text.length>400?'…':'')+'</p>'+((parsed.loreDelta||[]).map(e=>'<p><b>'+safeText(e.name)+':</b> '+safeText(e.description)+'</p>').join(''))+(after?'<div class="snapshot">'+safeText(after.date)+' · '+safeText(formatMoney(after.money))+'<br>Вещи: '+safeText((after.inventory||[]).join(', ')||'нет')+'<br>Раны: '+safeText((after.wounds||[]).join(', ')||'нет')+'</div>':'');box.appendChild(row);});
 if(!box.childElementCount)box.innerHTML='<div class="empty-panel">Пока нет событий.</div>';window.scrollTo(0,0);
}
function startDemo() {
 if(isTurnRunning)return;
 isDemo=true;sessionId='example';gameStarted=true;activeSlot=0;archivedTurns=0;events=[];storyArchive=[];
 character=cloneData(HERO_SKETCHES[0]);
 gameState={location:'Порт Теней · ремесленные дворы',money:40,wounds:[],inventory:['Дорожный плащ','Столярный нож','Холщовая сумка'],date:'Ранняя осень, 1026 год',day:1,chapter:1,sessionLore:[]};
 const lore=[{kind:'person',name:'Хозяйка мастерской',description:'Ищет человека, который починит ставни до осенних дождей. Предложила показать работу утром.',certainty:'факт'},{kind:'place',name:'Ремесленный двор',description:'Небольшой двор в Порту Теней. Здесь работают столяр и канатчик; вечером у ворот зажигают фонарь.',certainty:'факт'},{kind:'fact',name:'Работа на утро',description:'Дарен договорился осмотреть ставни на следующий день. Оплата ещё не обсуждалась.',certainty:'факт'}];
 const text='К вечеру Порт Теней пахнет смолой и остывающим камнем. Ты останавливаешься у открытой калитки: за ней слышно, как убирают инструмент, и из окна тянется тёплый свет.\n\nРемесленный двор невелик. У стены сохнут доски, над дверью висит пучок верёвок. Хозяйка мастерской выходит на порог и смотрит на твою сумку.\n\n— По дереву умеешь? — спрашивает она. — Ставни разбухли, не закрываются. Приходи утром, посмотришь.\n\nТы соглашаешься осмотреть работу. Она кивает, придерживая калитку. До темноты ещё есть время найти ночлег или расспросить о квартале.';
 applySessionLore(lore,1);
 const content='<текст>'+text+'</текст><выборы>1. Расспросить о работе\n2. Найти ночлег\n3. Осмотреть двор\n4. Пройтись по улице</выборы><состояние>{}</состояние><лор>'+JSON.stringify(lore)+'</лор>';
 chatHistory=[{role:'user',content:'Начало истории',display:'Дарен приезжает в Порт Теней в поисках работы.'},{role:'assistant',content,swipes:[content],swipeIndex:0,chapter:1,stateAfter:cloneData(gameState)}];
 renderGameUI();document.getElementById('choices-container').replaceChildren();document.getElementById('custom-action').disabled=true;document.getElementById('btn-custom-action').disabled=true;window.scrollTo(0,0);
}
document.addEventListener('DOMContentLoaded',()=>{document.body.dataset.screen='screen-setup';renderStarterHeroes();document.querySelector('[data-nav="screen-setup"]').setAttribute('aria-current','page');document.getElementById('detail-dialog').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDetail();}});});
