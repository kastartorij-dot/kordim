// Одноразовая подготовка редакторских Markdown к формату графа. Ошибки не пропускаются.
import fs from 'node:fs';
import vm from 'node:vm';
const dir=new URL('../Документы/Разработка/Шаг_10_Жители_и_разговоры/Диалоги_НПС/',import.meta.url);
const out={};const errors=[];
const clean=s=>s.trim().replace(/\s*⟦пр⟧/g,'').replace(/^«|»$/g,'');
const obj=s=>vm.runInNewContext('('+s+')',Object.create(null),{timeout:100});
function condition(s){s=s.trim().replace(/^`|`$/g,'');if(s.startsWith('{'))return obj(s);const result={};for(const m of s.matchAll(/(нетФакта|факт|нетФлага|флаг|тема|голос|начало)\s+([^,\s\]]+)|(сыт|цел|тепло|отдых|хмель|напряжение)\s*\[([\d, ]+)\]|(доверие|доверияДо)\s+(-?\d+)/g))if(m[1])result[m[1]]=m[2];else if(m[3])result[m[3]]=m[4].split(',').map(Number);else result[m[5]]=Number(m[6]);if(!Object.keys(result).length)throw Error('condition '+s);return result;}
for(const file of fs.readdirSync(dir).filter(f=>/^\d\d_/.test(f)&&!f.startsWith('00'))){
 const text=fs.readFileSync(new URL(file,dir),'utf8'),lines=text.split(/\r?\n/);const ident=text.match(/\n`([^`]+)`/);if(!ident){errors.push('header '+file);continue;}const id=ident[1];
 const g={человек:id,имя:lines[0].replace(/^# \d+\. /,'').replace(/ — v\d+$/,''),хаб:[],ветки:{},источник:file};
 let branch=null,node=null,isView=false;const metadata={};
 for(const line of lines){
  try{
   const row=line.match(/^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+)/);if(row){metadata[row[1]]={ярлык:row[2].trim(),условие:row[3].trim(),ходы:Number(row[4].replace(/\*/g,'')),окно:row[5].trim()};continue;}
   const bh=line.match(/^### (?:Ветка )?`([^`]+)`/);if(bh){branch=bh[1];isView=false;node=null;g.ветки[branch]={ярлык:branch,ходы:['вход','выход'].includes(branch)?0:1,узлы:{}};if(!['вход','выход'].includes(branch))g.хаб.push(branch);continue;}
   if(/^## /.test(line)){branch=null;node=null;continue;}
   if(!branch){const intro=line.match(/^- `(вступление|снова|отговорка)`: (.+)/);if(intro)g[intro[1]]=clean(intro[2]);continue;}
   const nh=line.match(/^\*\*(?:Узел )?`([^`]+)`\*\*/);if(nh){isView=nh[1]==='видят';if(isView){g.видят=[];node=null;}else {node={текст:[],варианты:[]};g.ветки[branch].узлы[nh[1]]=node;}continue;}
   if(isView){const v=line.match(/^- `([^`]+)`: (.+)/);if(v)g.видят.push({если:condition(v[1]),т:clean(v[2])});continue;}
   const enter=line.match(/^Вход: (.+?)(?: · |$)/);if(enter)g.ветки[branch].реплика=clean(enter[1]);
   const already=line.match(/^Уже: (.+)/);if(already)g.ветки[branch].уже=[...already[1].matchAll(/«([^»]+)»/g)].map(m=>m[1]);
   if(!node)continue;
   const t=line.match(/^- Т(?: `\[(.+)\]`)?[: ]+(.+)/);if(t){if(t[2]==='`видят`')node.текст.push({видят:true});else node.текст.push(t[1]?{если:condition(t[1]),т:clean(t[2])}:clean(t[2]));continue;}
   const effect=line.match(/^- при: `(.+?)`/);if(effect){node.при=obj(effect[1]);continue;}
   const voice=line.match(/^- Голос (\S+) `\[ид ([^;\]]+)(?:; если (.+))?\]`: (.+)/);if(voice){(node.голоса??=[]).push({ид:voice[2],голос:voice[1],...(voice[3]?{если:condition(voice[3])}:{}),т:voice[4]});continue;}
   if(line.startsWith('- Выбор ')){
    const m=line.match(/^- Выбор `([^`]+)`( \(закреплён\))? — (.+?) → (.+)$/);if(!m)throw Error('choice syntax '+line);
    const v={ид:m[1],текст:clean(m[3].split(/ · | эфф:/)[0]),закреплён:!!m[2]};const spec=m[3];
    const c=spec.match(/если `(.+?)`/);if(c)v.если=condition(c[1]);const e=spec.match(/эфф: `(.+?)`/);if(e)v.эффект=obj(e[1]);
    const cost=spec.match(/стоит (\d+)/);if(cost)v.стоит=Number(cost[1]);
    const check=spec.match(/проверка: `(.+?)`/);if(check){v.проверка=obj(check[1]);const targets=m[4].match(/^`([^`]+)`, провал → `([^`]+)`/);if(!targets)throw Error('check targets');v.успех={дальше:targets[1]};v.провал={дальше:targets[2]};}
    else {const dest=m[4].match(/^(ветка )?`([^`]+)`|^(хаб|закрыть|назад)/);if(!dest)throw Error('destination '+m[4]);v.дальше=dest[1]?{ветка:dest[2]}:dest[2]??dest[3];}
    const outcome=m[4].match(/исход `([^`]+)`/);if(outcome)v.исход=outcome[1]==='false'?false:outcome[1];node.варианты.push(v);
   }
  }catch(e){errors.push(file+': '+e.message);}
 }
 for(const [b,v] of Object.entries(g.ветки)){
  const meta=metadata[b];if(meta){v.ярлык=meta.ярлык;if(Number.isFinite(meta.ходы))v.ходы=meta.ходы;const cs=[...meta.условие.matchAll(/`(\{.+?\})`/g)].map(m=>obj(m[1]));if(cs.length)v.если=cs.length>1?{любое:cs}:cs[0];v.первая=!meta.окно.includes('2-го');}
  else v.первая=true;
  if(['вход','выход'].includes(b)){v.засчитывать=false;v.внеХаба=true;}
  if(!v.уже?.length)v.уже=['— Об этом мы уже говорили.'];
  for(const [n,u]of Object.entries(v.узлы)){if(!u.варианты.length)errors.push(`${file}: empty ${b}.${n}`);for(const c of u.варианты){for(const target of [c.дальше,c.успех?.дальше,c.провал?.дальше])if(typeof target==='string'&&!['хаб','закрыть','назад'].includes(target)&&!v.узлы[target])errors.push(`${file}: missing ${b}.${target}`);}}
 }
 out[id]=g;
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
fs.writeFileSync(new URL('../Данные/Диалоги/жители-основа.js',import.meta.url),'// Подготовленные графы из архивных Markdown. Редакторские исправления: жители.js.\nexport const ОСНОВА = '+JSON.stringify(out,null,2)+';\n');
console.log(Object.keys(out).length+' people; '+Object.values(out).reduce((n,g)=>n+Object.keys(g.ветки).length,0)+' branches; '+errors.length+' errors');
