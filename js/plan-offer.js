/* Shared commercial offer. No database writes: legacy settings are upgraded in memory. */
(function(global){
'use strict';
const VERSION=1;
const specs={free:{name:'Plan Gratis',monthly:0,photos:3,products:0,months:0},impulse:{name:'Plan Emprendo',monthly:10,photos:10,products:0,months:1},featured:{name:'Plan Activo',monthly:30,photos:15,products:10,months:3},premium:{name:'Plan Premium',monthly:60,photos:20,products:20,months:12}};
const configured=new Map();
const aliases={gratis:'free',impulso:'impulse',emprendo:'impulse',destacado:'featured',pro:'featured',activo:'featured'};
function id(value){const key=String(value||'free').trim().toLowerCase();return aliases[key]||key;}
function spec(value){return specs[id(value)]||null;}
function upgrade(plan={}){
 const s=spec(plan.id);if(!s)return {...plan};
 const legacy=Number(plan.offerVersion||0)<VERSION,paid=s.monthly>0;
 const features=legacy?{...(plan.features||{}),maxGalleryImages:s.photos,maxFeaturedProducts:s.products,analyticsPeriodMonths:s.months,stats:paid,video:paid,menu:s.products>0,menuImageQr:paid,loyalty:true}:{...(plan.features||{})};
 const result={...plan,name:s.name,offerVersion:VERSION,features};
 if(legacy){result.monthly=s.monthly;result.annual=s.monthly*10;}
 result.benefits=benefits(result);
 return result;
}
function benefits(plan){
 const s=spec(plan.id);if(!s)return Array.isArray(plan.benefits)?plan.benefits:[];
 const f=plan.features||{},paid=s.monthly>0,photos=Number(f.maxGalleryImages??s.photos),products=Number(f.maxFeaturedProducts??s.products),months=Number(f.analyticsPeriodMonths??s.months);
 const list=['Ficha en la guía y ubicación en el mapa',`Hasta ${photos} fotografías en la galería (logo aparte)`,'Tarjeta de fidelidad incluida, sin costo adicional','Horarios y datos de contacto'];
 if(!paid)return [...list,'QR para el Pasaporte de Paradas','Sin estadísticas'];
 list.push('QR con carta completa en imagen','Logo del negocio en el mapa');
 if(products>0)list.push(`Hasta ${products} productos destacados con foto, descripción y precio`);
 if(id(plan.id)==='impulse')list.push('Un vídeo proporcionado por el cliente, sujeto a lineamientos y revisión');
 if(id(plan.id)==='featured')list.push('Producción audiovisual por VisitaLoja, con alcance acordado previamente','Prioridad en recomendaciones y rutas','Una promoción destacada y pieza gráfica mensual');
 if(id(plan.id)==='premium')list.push('Una jornada mensual de grabación y fotografía, coordinada con el cliente','Piezas finales y alcance acordados antes de la jornada','Presencia especial en portada y campañas estacionales');
 list.push(`Estadísticas: historial de ${months} ${months===1?'mes':'meses'}, con consulta mensual`);
 return list;
}
function configure(plans){configured.clear();(Array.isArray(plans)?plans:[]).forEach(p=>{const plan=upgrade(p);configured.set(id(plan.id),plan);});}
function productLimit(place){const key=id(place?.subscription?.plan);return Math.max(0,Math.min(100,Number(configured.get(key)?.features?.maxFeaturedProducts??spec(key)?.products??0)));}
function active(place,now=Date.now()){
 const s=place?.subscription||{};if(!s.plan||id(s.plan)==='free'||['paused','pending','expired','suspended'].includes(s.status))return false;
 const time=(v,end)=>{if(!v)return 0;if(v.toDate)return v.toDate().getTime();if(v.seconds!=null)return v.seconds*1000;return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(String(v))?v+(end?'T23:59:59-05:00':'T00:00:00-05:00'):v);};
 const start=time(s.startAt||s.startDate),end=time(s.endAt||s.endDate,true);return (!start||now>=start)&&(!end||now<=end);
}
function products(place){return active(place)&&place?.subscription?.benefits?.menu===true&&place?.menu?.active===true?(Array.isArray(place.menu.dishes)?place.menu.dishes:[]).filter(x=>x?.name&&x?.price).slice(0,productLimit(place)):[];}
function validateProductTransition(before,after,limit){if(after>limit&&after>before)throw new Error(`Este plan permite hasta ${limit} productos destacados. Conserva o reduce los existentes antes de añadir nuevos.`);}
global.VisitaLojaPlanOffer=Object.freeze({VERSION,spec,id,upgrade,benefits,configure,productLimit,products,active,validateProductTransition});
})(window);
