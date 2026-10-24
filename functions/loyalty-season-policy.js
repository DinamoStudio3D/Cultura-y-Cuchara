/* Shared policy for seasonal cards inside existing loyaltyPrograms/loyaltyCounters. */
(function(root){
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 function integer(value,min,max,label){const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Revisa '+label+'.');return n;}
 function normalize(items=[]){
  if(!Array.isArray(items)||items.length>24)throw Error('Configura hasta 24 temporadas por parada.');
  const ids=new Set(),seasons=items.map(raw=>{
   const id=String(raw.id||'');if(!/^[A-Za-z0-9_-]{1,60}$/.test(id)||ids.has(id))throw Error('Cada temporada necesita un identificador único.');ids.add(id);
   const startAt=String(raw.startAt||''),endAt=String(raw.endAt||'');
   if(!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(startAt)||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(endAt)||!Number.isFinite(Date.parse(startAt))||!Number.isFinite(Date.parse(endAt))||Date.parse(endAt)<=Date.parse(startAt))throw Error('Cada temporada necesita un inicio y fin válidos, en hora de Loja.');
   const title=String(raw.title||'').trim().slice(0,100),rewardTitle=String(raw.rewardTitle||'').trim().slice(0,100);
   if(!title||!rewardTitle)throw Error('Completa el nombre de temporada y su beneficio.');
   const rewardType=raw.rewardType||'product';if(!['product','discount','surprise'].includes(rewardType))throw Error('Tipo de beneficio inválido.');
   return{id,title,active:raw.active===true,startAt,endAt,targetVisits:integer(raw.targetVisits??10,10,30,'los sellos de temporada'),maxVisitsPerDay:integer(raw.maxVisitsPerDay??1,1,3,'el límite diario'),rewardTitle,rewardDescription:String(raw.rewardDescription||'').trim().slice(0,400),rewardType,rewardValidityDays:integer(raw.rewardValidityDays??30,1,365,'el plazo de canje'),stock:raw.stock===null||raw.stock===''||raw.stock===undefined?null:integer(raw.stock,0,1000000,'los cupos')};
  });
  const enabled=seasons.filter(s=>s.active).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
  for(let i=1;i<enabled.length;i++)if(Date.parse(enabled[i].startAt)<Date.parse(enabled[i-1].endAt))throw Error('Las temporadas activas de una parada no pueden coincidir.');
  return seasons;
 }
 function select(program={},counter={},now=Date.now()){
  const season=program.active===false?null:normalize(program.seasons||[]).find(s=>s.active&&Date.parse(s.startAt)<=now&&now<Date.parse(s.endAt));
  if(!season)return{id:'permanent',seasonal:false,program,counter};
  const progress=counter.seasonalCards?.[season.id]||{},policy=progress.policy||season;
  return{id:season.id,seasonal:true,policy:clone(policy),program:{...program,...clone(policy),stock:season.stock,claimedCount:Number(program.seasonClaimedCounts?.[season.id]||0)},counter:{...counter,...progress,visitCount:Number(progress.visitCount||0),rewardCycles:Number(progress.rewardCycles||0),lastVisitDay:counter.lastVisitDay,dailyVisitCount:counter.dailyVisitCount}};
 }
 function progressPatch(selection,base,count,cycles){
  if(!selection.seasonal)return{visitCount:count,...(cycles===undefined?{}:{rewardCycles:cycles})};
  return{seasonalCards:{...(base.seasonalCards||{}),[selection.id]:{...(base.seasonalCards?.[selection.id]||{}),visitCount:count,rewardCycles:cycles??Number(selection.counter.rewardCycles||0),policy:clone(selection.policy)}}};
 }
 function restorePatch(visit,counter){
  if(!visit.seasonId)return{visitCount:Math.max(0,Number(visit.previousVisitCount||0)),...(visit.previousRewardCycles===undefined?{}:{rewardCycles:Math.max(0,Number(visit.previousRewardCycles||0))})};
  const seasons={...(counter.seasonalCards||{})};
  if(visit.previousSeasonCard)seasons[visit.seasonId]=clone(visit.previousSeasonCard);else delete seasons[visit.seasonId];
  return{seasonalCards:seasons};
 }
 const api={normalize,select,progressPatch,restorePatch};root.VisitaLojaLoyaltySeasonPolicy=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
