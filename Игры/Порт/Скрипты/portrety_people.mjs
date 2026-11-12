const root=process.argv[2];
const {МЕСТА}=await import(root+'/Данные/места.js');
const out=[];
for(const p of МЕСТА){const L=p.модуль?.ЛЮДИ||{};
  for(const [id,h] of Object.entries(L)) out.push({id,имя:h.имя,портрет:h.портрет||'',место:p.имя,вст:(h.вступление||'').replace(/\s+/g,' ').slice(0,220),она:!!h.она});}
console.log(JSON.stringify(out));
