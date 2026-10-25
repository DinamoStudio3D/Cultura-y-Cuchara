/* Shared matching rules for the public directory. Unknown hours never imply open. */
(function(root){
 'use strict';
 const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const aliases={cafeteria:['cafe','cafeteria','coffee'],cafeterias:['cafe','cafeteria','coffee'],coffee:['cafe','cafeteria','coffee'],restaurante:['restaurante','hueca','urbana','asadero','cevicheria'],restaurantes:['restaurante','hueca','urbana','asadero','cevicheria'],hotel:['hotel','hostal','hospedaje','alojamiento'],hoteles:['hotel','hostal','hospedaje','alojamiento'],hospedaje:['hotel','hostal','hospedaje','alojamiento'],comida:['comida','hueca','urbana','restaurante','gastronomia'],food:['comida','hueca','urbana','restaurante','gastronomia']};
 const ignored=new Set(['de','en','un','una','para','con','que','quiero','busco','lugar','abierto','abierta','abiertos','ahora','open','now','cerca','near','mi','me','ubicacion','location','pasaporte','passport','sello','stamp']);
 Object.assign(aliases,{cafes:aliases.cafeteria,alojamiento:aliases.hotel,alojamientos:aliases.hotel,hostales:aliases.hotel,hospedajes:aliases.hotel,comer:aliases.comida,panaderias:['panaderia','pan'],helados:['heladeria','helado'],heladerias:['heladeria','helado'],bares:['bar','bares']});
 ['el','la','los','las','del','al','y','a','abiertas'].forEach(word=>ignored.add(word));
 const cantons=['loja','calvas','catamayo','celica','chaguarpamba','espindola','gonzanama','macara','olmedo','paltas','pindal','puyango','quilanga','saraguro','sozoranga','zapotillo'];
 const terms=query=>normalize(query).split(' ').filter(term=>term.length>1&&!ignored.has(term));
 const cantonPatterns=cantons.map(id=>[id,new RegExp('\\ben '+id+'\\b')]);
 const queryCanton=query=>{const value=normalize(query);return cantonPatterns.find(([,pattern])=>pattern.test(value))?.[0]||'';};
 const openQuery=query=>/\b(abiert[oa]s?|ahora|open|now)\b/.test(normalize(query));
 const published=p=>p&&p.active!==false&&(!p.publicationStatus||p.publicationStatus==='published')&&!['hidden','draft','archived','inactive','deleted'].includes(p.status);
 const text=p=>normalize([p.title,p.titleEn,p.tag,p.tagEn,p.desc,p.descEn,p.dish,p.dishEn,p.category,p.address,p.services,p.keywords,canton(p)].flat().join(' '));
 const canton=p=>normalize(p.cantonId||'loja');
 function knownHours(p){if(/\b24\s*(?:\/\s*7|horas?|hours?|h)\b/i.test([p.hours,p.hoursEn].join(' ')))return true;return ['openHour','closeHour'].every(k=>p[k]!==undefined&&p[k]!==null&&String(p[k]).trim()!==''&&Number.isFinite(Number(p[k]))&&Number(p[k])>=0&&Number(p[k])<=24);}
 function matches(p,{query='',category='all',cantonId='',openOnly=false,savedOnly=false,savedIds=[]}={},isOpen=()=>false){
  if(!published(p))return false;
  if(savedOnly&&(!Array.isArray(savedIds)||!savedIds.map(String).includes(String(p.id))))return false;
  const categories=(Array.isArray(p.category)?p.category:[p.category]).map(normalize);
  if(category!=='all'&&!categories.includes(category)&&!(category==='food'&&categories.some(c=>['hueca','cafe','urbana','heladeria','panaderia','bar','restaurante'].includes(c))))return false;
  if(cantonId&&canton(p)!==cantonId)return false;
  const requestedCanton=queryCanton(query);if(requestedCanton&&canton(p)!==requestedCanton)return false;
  const q=normalize(query);if((openOnly||/\b(abiert[oa]s?|ahora|open|now)\b/.test(q))&&(!knownHours(p)||!isOpen(p)))return false;
  const haystack=text(p);
  return terms(q).every(t=>(aliases[t]||[t]).some(word=>haystack.includes(word)));
 }
 function score(p,query){
  const title=normalize(p.title),alternate=normalize(p.titleEn),q=normalize(query),words=terms(query);
  if(!words.length)return 0;
  return (title===q||alternate===q?1000:0)+(title.startsWith(q)||alternate.startsWith(q)?200:0)+words.reduce((sum,word)=>sum+(title.includes(word)||alternate.includes(word)?30:0),0);
 }
 function oneEdit(a,b){
  if(a===b)return false;if(a.length<4||Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}
  return edits+(i<a.length||j<b.length?1:0)===1;
 }
 function suggestions(places,options={},isOpen=()=>false){
  const words=terms(options.query),requested=queryCanton(options.query),candidates=[];if(!words.length)return [];
  for(const place of places){
   if(!matches(place,{...options,query:'',cantonId:options.cantonId||requested,openOnly:options.openOnly||openQuery(options.query)},isOpen))continue;
   const categoryWords=(Array.isArray(place.category)?place.category:[place.category]).map(normalize),vocabulary=normalize([place.title,place.titleEn,categoryWords,canton(place),Object.keys(aliases).filter(key=>aliases[key].some(value=>categoryWords.includes(value)))].flat().join(' ')).split(' ');
   let corrected=false;const haystack=text(place);
   const possible=words.every(word=>{if((aliases[word]||[word]).some(value=>haystack.includes(value)))return true;if(vocabulary.some(value=>oneEdit(word,value))){corrected=true;return true;}return false;});
   if(possible&&corrected){const title=String(place.title||place.titleEn||'');candidates.push({id:place.id,title,query:title+(requested?' en '+requested:'')+(openQuery(options.query)?' abierto':''),score:score(place,options.query)});}
  }
  return candidates.filter(item=>item.title).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'es')).slice(0,3);
 }
 const api={normalize,canton,knownHours,matches,score,suggestions};if(typeof module==='object'&&module.exports)module.exports=api;root.VisitaLojaDiscovery=api;
})(typeof window==='object'?window:globalThis);
