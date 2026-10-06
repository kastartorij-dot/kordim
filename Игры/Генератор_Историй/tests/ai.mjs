import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../Index.html',import.meta.url),'utf8');
const core=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const modules=await Promise.all(['chronicles.js','ai-models.js','ai.js'].map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')));
const store=new Map(),nodes=new Map();
const node=()=>({value:'',checked:false,style:{},innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},contains(){return false},toggle(){}},setAttribute(){},addEventListener(){},appendChild(){},append(){},replaceChildren(){},close(){},showModal(){},focus(){},select(){},click(){}});
const document={body:{dataset:{}},addEventListener(){},querySelectorAll(){return []},getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},createElement:node};
const ctx=vm.createContext({document,console,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},window:{location:{protocol:'http:',origin:'http://localhost'},scrollTo(){},matchMedia:()=>({matches:false})},URL,Blob,AbortController,TextDecoder,TextEncoder,setTimeout,clearTimeout,crypto:{randomUUID:()=>Math.random().toString(16)},alert(){},confirm:()=>true});
vm.runInContext(core+'\n'+modules.join('\n'),ctx);
const run=s=>vm.runInContext(s,ctx),data=s=>JSON.parse(JSON.stringify(run(s)));
ctx.realSave=run('saveGame');
run('renderAIOverview=()=>{};updateTokenDisplay=()=>{};saveGame=()=>{};renderGameUI=()=>{};allModelsData=AI_CATALOG_SNAPSHOT.map(catalogRow);apiKey="mock-key";aiSettings.budget=3;aiSettings.requestBudget=0.25;');
let requests=[];
ctx.fetch=async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({choices:[{message:{content:'Ответ'},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:20,cost:0.01}})}};
await run('aiTextRequest([{role:"user",content:"Тест"}],"qwen/qwen3.8-flash",0.7,1000,null)');
assert.equal(requests[0].body.reasoning.enabled,false);assert.equal(requests[0].body.provider.sort,'price');assert.equal(run('aiLedger().total'),0.01);
await run('aiTextRequest([{role:"user",content:"Тест"}],"anthropic/claude-sonnet-5.5",0.7,1000,null)');
assert.equal(requests[1].body.reasoning.effort,'low');assert.equal(requests[1].body.reasoning.exclude,true);
const count=requests.length;run('aiSettings.requestBudget=0.00000001');await assert.rejects(run('aiTextRequest([{role:"user",content:"Тест"}],"qwen/qwen3.8-flash",0.7,1000,null)'),/лимита/);assert.equal(requests.length,count);run('aiSettings.requestBudget=0.25');
const stream='data: '+JSON.stringify({choices:[{delta:{content:'Сце'}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{content:'на'},finish_reason:'stop'}]})+'\n\ndata: '+JSON.stringify({usage:{prompt_tokens:100,completion_tokens:10,cost:0.002},choices:[]})+'\n\ndata: [DONE]\n';
ctx.fetch=async()=>({ok:true,body:{getReader(){let n=0;return {read:async()=>n++===0?{value:new TextEncoder().encode(stream.slice(0,35)),done:false}:n===2?{value:new TextEncoder().encode(stream.slice(35)),done:false}:{done:true}}}}});
ctx.chunks=[];const streamed=await run('aiTextRequest([{role:"user",content:"Тест"}],"qwen/qwen3.8-flash",0.7,1000,t=>chunks.push(t))');assert.equal(streamed.content,'Сцена');assert.equal(ctx.chunks.at(-1),'Сцена');assert.equal(run('aiLedger().calls.at(-1).cost'),0.002);
ctx.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:'Обрезано'},finish_reason:'length'}],usage:{prompt_tokens:3,completion_tokens:5,cost:0.003}})});
const before=run('aiLedger().total');await assert.rejects(run('aiTextRequest([{role:"user",content:"Тест"}],"qwen/qwen3.8-flash",0.7,1000,null)'),/обрезан/);assert.equal(run('aiLedger().total'),before+0.003);
run('gameState={money:40,day:1,location:"Порт",sessionLore:[],journal:[]};aiSettings.memory=true;summaryModel="qwen/qwen3.8-flash"');
ctx.reply='<текст>Лодочник согласился ждать утром.</текст><выборы>1. Спать</выборы><состояние>{"money":40}</состояние><лор>[]</лор>';
run('aiTextRequest=async()=>({content:JSON.stringify({summary:"Договорённость",events:[{what:"Ждать утром",day:1,who:["Лодочник"],weight:4}],lore:[{kind:"person",name:"Лодочник",description:"Ждёт утром",certainty:"факт"}]})})');const enriched=await run('enrichTurnMemory(reply,"Договориться",gameState)');assert.equal(enriched.status,'обновлена');ctx.enriched=enriched.reply;run('applyTurnJournal(enriched,1);applySessionLore(parseResponse(enriched).loreDelta,1)');assert.equal(run('gameState.journal[0].chapter'),1);assert.equal(run('gameState.sessionLore[0].name'),'Лодочник');
run('aiTextRequest=async()=>({content:"сломанный json"})');const bad=await run('enrichTurnMemory(reply,"Тест",gameState)');assert.equal(bad.reply,ctx.reply);assert.match(bad.status,/не обновлена/);
run('gameState.checkpoint={through:2,text:"Первые главы"};gameState.chapter=2');ctx.history=[{role:'user',content:'Старый ход'},{role:'assistant',chapter:1},{role:'user',content:'Ход2'},{role:'assistant',chapter:2},{role:'user',content:'ТЕКУЩЕЕ ДЕЙСТВИЕ'}];assert.deepEqual(data('historyForAI(history)'),[{role:'user',content:'ТЕКУЩЕЕ ДЕЙСТВИЕ'}]);
run('applyState({money:12,aiLedger:{total:0},checkpoint:{through:100},sessionLore:[],direction:"подмена"})');assert.equal(run('gameState.money'),12);assert.equal(run('gameState.checkpoint.through'),2);assert.ok(run('aiLedger().total')>0);
ctx.image='data:image/png;base64,aGVsbG8=';const plan=run('imagePlan("bytedance-seed/seedream-5-0-flash")');assert.equal(plan.cost,0.018);ctx.plan=plan;const body=data('buildImageRequest(plan,"Портрет",true,null)');assert.equal(body.aspect_ratio,'3:4');assert.equal(body.resolution,'1K');assert.equal(body.n,1);assert.equal(body.provider.allow_fallbacks,false);
const referenced=data('buildImageRequest(plan,"Сцена",false,image)');assert.equal(referenced.input_references[0].image_url.url,ctx.image);assert.equal(referenced.aspect_ratio,'16:9');assert.equal(run('validImageRecord({id:"1",sessionId:"s",data:image})'),true);assert.equal(run('validImageRecord({id:"1",sessionId:"s",data:"javascript:alert(1)"})'),false);assert.throws(()=>run('buildImageRequest(imagePlan("recraft/recraft-v4.1-flash"),"Сцена",false,image)'),/референса/);
run('showDetail=()=>{};aiSettings.mode="manual";aiBusy=false;');const manual=run('requestManualReply([{role:"user",content:"Тест"}])');nodes.get('manual-answer')||(document.getElementById('manual-answer'));nodes.get('manual-answer').value=ctx.reply;run('acceptManualReply()');assert.equal((await manual).content,ctx.reply);assert.equal(run('manualPending'),null);

// Continuation must work without an API key in manual mode, not just the first scene.
const savedExecute=run('executeTurn');ctx.testTurns=0;run('executeTurn=()=>testTurns++;aiSettings.mode="manual";apiKey="";isTurnRunning=false;isDemo=false;applySettings=()=>{};chatHistory=[];makeGameTurn("Продолжить")');assert.equal(ctx.testTurns,1);assert.equal(run('chatHistory[0].content'),'Продолжить');ctx.savedExecute=savedExecute;run('executeTurn=savedExecute;apiKey="mock-key"');
// IndexedDB round trip, generation endpoint and export with real Blob, all in memory.
const imageStore=new Map();ctx.indexedDB={open(){const request={};queueMicrotask(()=>{const db={close(){},transaction(name,mode){const tx={objectStore(){return {put(r){imageStore.set(r.id,r);queueMicrotask(()=>tx.oncomplete?.());},getAll(){const r={};queueMicrotask(()=>{r.result=[...imageStore.values()];r.onsuccess?.();});return r;}}}};return tx;}};request.result=db;request.onsuccess?.();});return request;}};
run('aiSettings.mode="api";isTurnRunning=false;isDemo=false;applySettings=()=>{};sessionId="image-session";character={name:"Герой",age:25};chatHistory=[{role:"assistant",content:"<текст>Сцена</текст>",swipeIndex:0}];gameStarted=true;');
document.getElementById('image-prompt').value='Портрет героя';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=';
ctx.fetch=async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({data:[{b64_json:png,media_type:'image/png'}],usage:{cost:0.018}})}};
await run('generateGameImage("portrait")');assert.equal(requests.at(-1).url,'https://openrouter.ai/api/v1/images');assert.equal(requests.at(-1).body.aspect_ratio,'3:4');assert.equal(imageStore.size,1);assert.ok(run('character.portraitKey'));assert.equal(run('isTurnRunning'),false);
run('imageCache.clear()');await run('loadSessionImages(sessionId,false)');assert.equal(run('imageCache.size'),1);assert.match(run('portraitSource(character)'),/^data:image\/png/);
let exported;ctx.URL=class extends URL{static createObjectURL(blob){exported=blob;return 'blob:mock'}static revokeObjectURL(){}};
store.set('kordim_save_1',JSON.stringify({sessionId:'image-session',character:data('character'),gameState:data('gameState'),chatHistory:data('chatHistory'),aiLedger:data('aiLedger()')}));run('activeSlot=1');document.getElementById('export-with-key').checked=false;
await run('exportSave()');const bundle=JSON.parse(await exported.text());assert.equal(bundle.images.length,1);assert.equal(bundle.save.character.portraitKey,bundle.images[0].id);assert.equal(bundle.settings,undefined);assert.ok(!JSON.stringify(bundle).includes('mock-key'));


run('gameStarted=false;selectedHero={name:"Выбранный герой",age:35,trade:"Столяр"};saveGame=realSave;isTurnRunning=false;');await run('generateGameImage("selected-portrait")');const draft=JSON.parse(store.get('kordim_save_1'));assert.equal(draft.draft,true);assert.equal(draft.character.name,'Выбранный герой');assert.ok(draft.character.portraitKey);assert.ok(imageStore.has(draft.character.portraitKey));

// Regression cases from the paid five-turn playtest.
assert.deepEqual(data('parseResponse("<выборы>1. Осмотреть дверь</выборы><выборы>2. Спросить цену</выборы><выборы>3. Уйти</выборы><выборы>4. Подождать</выборы>").choicesArr'),['Осмотреть дверь','Спросить цену','Уйти','Подождать']);
assert.deepEqual(data('parseResponse("<выборы>1. Осмотреть 2) Спросить 3. Уйти 4) Подождать</выборы>").choicesArr'),['Осмотреть','Спросить','Уйти','Подождать']);
const scalarJournal=data('normalizeJournal({events:[{who:"Грегор",what:"Заплатил Дарену",keys:"ставень"}]},3)');assert.deepEqual(scalarJournal.events[0].who,['Грегор']);assert.deepEqual(scalarJournal.events[0].keys,['ставень']);
document.getElementById('model-main').value='deepseek/deepseek-v4-pro';document.getElementById('model-summary').value='qwen/qwen3.8-flash';run('isTurnRunning=false;aiBusy=false;isDemo=false;gameStarted=true;apiKey="";');
ctx.origApply=run('applySettings');run('applySettings=()=>{currentModel=document.getElementById("model-main").value;summaryModel=document.getElementById("model-summary").value;};saveAISettings()');
assert.equal(JSON.parse(store.get('kordim_save_1')).summaryModel,'qwen/qwen3.8-flash');assert.equal(JSON.parse(store.get('kordim_save_1')).currentModel,'deepseek/deepseek-v4-pro');
const settingsBefore=store.get('kordim_save_1');run('isTurnRunning=true;currentModel="blocked";saveAISettings()');assert.equal(store.get('kordim_save_1'),settingsBefore);run('isTurnRunning=false;applySettings=origApply');

// Updating defaults must migrate old Flash settings once, without touching custom choices or story data.
store.delete('or_defaults_revision');store.set('or_model','deepseek/deepseek-v4-flash');store.set('or_model_sum','deepseek/deepseek-v4-flash');store.set('kordim_save_2',JSON.stringify({currentModel:'deepseek/deepseek-v4-flash',summaryModel:'deepseek/deepseek-v4-flash',gameState:{money:47,chapter:5}}));store.set('kordim_save_3',JSON.stringify({currentModel:'custom/model',summaryModel:'custom/memory'}));run('migrateAIDefaults()');assert.equal(store.get('or_model'),'deepseek/deepseek-v4-pro');assert.equal(store.get('or_model_sum'),'qwen/qwen3.8-flash');assert.equal(JSON.parse(store.get('kordim_save_2')).gameState.money,47);assert.equal(JSON.parse(store.get('kordim_save_2')).currentModel,'deepseek/deepseek-v4-pro');assert.equal(JSON.parse(store.get('kordim_save_3')).currentModel,'custom/model');store.set('or_model','deepseek/deepseek-v4-flash');run('migrateAIDefaults()');assert.equal(store.get('or_model'),'deepseek/deepseek-v4-flash');
// Late image loading must not pull a user out of the settings screen.
ctx.savedRender=run('renderGameUI');ctx.redrawCount=0;run('renderGameUI=()=>redrawCount++;gameStarted=true;sessionId="image-session";document.body.dataset.screen="screen-setup";');await run('loadSessionImages(sessionId)');assert.equal(ctx.redrawCount,0);run('document.body.dataset.screen="screen-game"');await run('loadSessionImages(sessionId)');assert.equal(ctx.redrawCount,1);run('renderGameUI=savedRender');

console.log('PASS: roles/pricing, reasoning options, budgets, split SSE usage, billed truncation, journal extraction/fallback, checkpoint current action, protected state fields, image request/reference validation, manual reply, image generation/storage/export. No paid requests.');
