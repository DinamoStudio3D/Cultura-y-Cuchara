/* Shared matching rules for the public directory. Unknown hours never imply open. */
(function(root){
 'use strict';
 const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const aliases={cafeteria:['cafe','cafeteria','coffee'],cafeterias:['cafe','cafeteria','coffee'],coffee:['cafe','cafeteria','coffee'],restaurante:['restaurante','hueca','urbana','asadero','cevicheria'],restaurantes:['restaurante','hueca','urbana','asadero','cevicheria'],hotel:['hotel','hostal','hospedaje','alojamiento'],hoteles:['hotel','hostal','hospedaje','alojamiento'],hospedaje:['hotel','hostal','hospedaje','alojamiento'],comida:['comida','hueca','urbana','restaurante','gastronomia'],food:['comida','hueca','urbana','restaurante','gastronomia']};
 const ignored=new Set(['de','en','un','una','para','con','que','quiero','busco','lugar','abierto','abierta','abiertos','ahora','open','now','cerca','near','mi','me','ubicacion','location','pasaporte','passport','sello','stamp']);
 const canton=p=>normalize(p.cantonId||'loja');
 function knownHours(p){if(/\b24\s*(?:\/\s*7|horas?|hours?|h)\b/i.test([p.hours,p.hoursEn].join(' ')))return true;return ['openHour','closeHour'].every(k=>p[k]!==undefined&&p[k]!==null&&String(p[k]).trim()!==''&&Number.isFinite(Number(p[k]))&&Number(p[k])>=0&&Number(p[k])<=24);}
 function matches(p,{query='',category='all',cantonId='',openOnly=false,savedOnly=false,savedIds=[]}={},isOpen=()=>false){
  if(savedOnly&&(!Array.isArray(savedIds)||!savedIds.map(String).includes(String(p.id))))return false;
  const categories=(Array.isArray(p.category)?p.category:[p.category]).map(normalize);
  if(category!=='all'&&!categories.includes(category)&&!(category==='food'&&categories.some(c=>['hueca','cafe','urbana','heladeria','panaderia','bar','restaurante'].includes(c))))return false;
  if(cantonId&&canton(p)!==cantonId)return false;
  const q=normalize(query);if((openOnly||/\b(abiert[oa]s?|ahora|open|now)\b/.test(q))&&(!knownHours(p)||!isOpen(p)))return false;
  const haystack=normalize([p.title,p.titleEn,p.tag,p.tagEn,p.desc,p.descEn,p.dish,p.dishEn,p.category,p.address,p.services,p.keywords,canton(p)].flat().join(' '));
  return q.split(' ').filter(t=>t.length>1&&!ignored.has(t)).every(t=>(aliases[t]||[t]).some(word=>haystack.includes(word)));
 }
 const api={normalize,canton,knownHours,matches};if(typeof module==='object'&&module.exports)module.exports=api;root.VisitaLojaDiscovery=api;
})(typeof window==='object'?window:globalThis);
