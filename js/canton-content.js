(function(root){
 'use strict';
 const GUIDE_FIELDS=Object.freeze({history:'Historia',culture:'Cultura y tradiciones',gastronomy:'Gastronomía típica',climate:'Clima y qué llevar',festivals:'Festividades',arrival:'Cómo llegar'});
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function image(value){if(!String(value||'').trim())return '';try{const url=new URL(String(value||''),typeof location==='object'?location.origin:'https://www.visitaloja.com');return url.protocol==='https:'&&!String(value).startsWith('//')&&!url.username&&!url.password?url.href:'';}catch(_){return '';}}
 const text=(value,max)=>String(value||'').slice(0,max);
 const ids=(values,max)=>Array.isArray(values)?[...new Set(values.filter(value=>typeof value==='string'&&value.length>0&&value.length<=128&&!value.includes('/')))].slice(0,max):[];
 function clean(data={}){const result={tagline:text(data.tagline,120),description:text(data.description,4000),highlights:text(data.highlights,1500),cover:image(data.cover),coverCredit:text(data.coverCredit,180),version:Number(data.version)||0,seoTitle:text(data.seoTitle,70),seoDescription:text(data.seoDescription,170),seoImage:image(data.seoImage),featuredIds:ids(data.featuredIds,16),routes:Array.isArray(data.routes)?data.routes.slice(0,8).map((route,index)=>({id:'route-'+index,title:text(route.title,100),duration:text(route.duration,80),notes:text(route.notes,1000),placeIds:ids(route.placeIds,12)})).filter(route=>route.title):[]};for(const key of Object.keys(GUIDE_FIELDS))result[key]=text(data[key],2500);return result;}
 function guideHTML(data){return Object.entries(GUIDE_FIELDS).filter(([key])=>data[key]).map(([key,title])=>`<article class="canton-guide-block"><h3>${title}</h3><p>${esc(data[key])}</p></article>`).join('');}
 function coordinates(place){return typeof place.lat==='number'&&typeof place.lng==='number'&&Number.isFinite(place.lat)&&Number.isFinite(place.lng)&&Math.abs(place.lat)<=90&&Math.abs(place.lng)<=180;}
 // Existing city listings predate canton assignments. Explicit assignments always win.
 function cantonId(place){return place.cantonId==null||place.cantonId===''||(typeof place.cantonId==='string'&&!place.cantonId.trim())?'loja':place.cantonId;}
 function publicPlace(place,expectedCanton){return cantonId(place)===expectedCanton&&place.active!==false&&(!place.publicationStatus||place.publicationStatus==='published')&&!/motel/i.test([place.category,place.tag,place.title,place.type].join(' '));}
 const api={image,clean,GUIDE_FIELDS,guideHTML,coordinates,cantonId,publicPlace};root.VisitaLojaCantonContent=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
