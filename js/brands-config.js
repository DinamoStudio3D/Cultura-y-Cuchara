(function(root){'use strict';
const defaults={active:true,title:'Ellos hacen posible VisitaLoja',titleEn:'They make VisitaLoja possible',subtitle:'Conoce los negocios que apoyan este proyecto y nos ayudan a mostrar lo mejor de Loja.',subtitleEn:'Meet the businesses that support this project and help us showcase the best of Loja.',mode:'all',selectedIds:[],excludedIds:[],orderIds:[],size:'medium',duration:35,direction:'left',motion:true,pauseOnHover:true,showNames:false,clickable:true};
const ids=v=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&x.length<=180))].slice(0,1000):[];
function normalize(v={}){return {active:v.active!==false,title:typeof v.title==='string'&&v.title!=='Marcas que ya trabajan con nosotros'?v.title.trim().slice(0,120):defaults.title,titleEn:typeof v.titleEn==='string'&&v.titleEn!=='Brands already working with us'?v.titleEn.trim().slice(0,120):defaults.titleEn,subtitle:typeof v.subtitle==='string'?v.subtitle.trim().slice(0,300):defaults.subtitle,subtitleEn:typeof v.subtitleEn==='string'?v.subtitleEn.trim().slice(0,300):defaults.subtitleEn,mode:v.mode==='selected'?'selected':'all',selectedIds:ids(v.selectedIds),excludedIds:ids(v.excludedIds),orderIds:ids(v.orderIds),size:['small','medium','large'].includes(v.size)?v.size:'medium',duration:Math.max(20,Math.min(120,Number(v.duration)||35)),direction:v.direction==='right'?'right':'left',motion:v.motion!==false,pauseOnHover:v.pauseOnHover!==false,showNames:v.showNames===true,clickable:v.clickable!==false};}
function publicPlace(p){return p&&p.id&&p.title&&p.active!==false&&p.hidden!==true&&p.published!==false&&(!p.publicationStatus||p.publicationStatus==='published');}
function time(value,end=false){
 if(value==null||value==='')return null;
 if(typeof value.toMillis==='function')return value.toMillis();
 if(typeof value==='object'&&Number.isFinite(value.seconds))return value.seconds*1000;
 if(typeof value==='object')return NaN;
 const raw=String(value),iso=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+(end?'T23:59:59.999-05:00':'T00:00:00-05:00'):raw;
 return new Date(iso).getTime();
}
function paidActive(p,now=Date.now()){
 const s=p?.subscription||{},plan=String(s.plan||'').trim().toLowerCase(),status=String(s.status||'active').trim().toLowerCase();
 if(!plan||['free','gratis','gratuito'].includes(plan)||!['active','paid'].includes(status))return false;
 const start=time(s.startAt||s.startDate),end=time(s.endAt||s.endDate,true);
 return (start===null||Number.isFinite(start)&&now>=start)&&(end===null||Number.isFinite(end)&&now<=end);
}
function eligible(p,now=Date.now()){return publicPlace(p)&&paidActive(p,now);}
function select(items,config,now=Date.now()){const c=normalize(config),selected=new Set(c.selectedIds),excluded=new Set(c.excludedIds),seen=new Set(),rank=new Map(c.orderIds.map((id,i)=>[id,i]));return (Array.isArray(items)?items:[]).filter(p=>eligible(p,now)&&!seen.has(String(p.id))&&seen.add(String(p.id))&&(c.mode==='selected'?selected.has(String(p.id)):!excluded.has(String(p.id)))).map((p,i)=>({p,i})).sort((a,b)=>(rank.get(String(a.p.id))??100000+a.i)-(rank.get(String(b.p.id))??100000+b.i)).map(x=>x.p);}
root.VisitaLojaBrandsModel={defaults,normalize,publicPlace,paidActive,eligible,select};
})(typeof window==='object'?window:globalThis);