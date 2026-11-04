'use strict';
// Pure policy helpers for the web rewards editor. No database writes or permissions granted.
const TYPES=new Set(['product','discount','surprise']);
function fail(message){throw new Error(message)}
function int(value,min,max,label){const n=typeof value==='number'?value:(typeof value==='string'&&value.trim()!==''?Number(value):NaN);if(!Number.isSafeInteger(n)||n<min||n>max)fail('Revisa '+label+'.');return n}
function str(value,max,label,required=false){if(typeof value!=='string')fail('Revisa '+label+'.');const v=value.trim();if((required&&!v)||v.length>max)fail('Revisa '+label+'.');return v}
function normalizeLoyalty(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Configuración inválida.');
 const placeId=str(input.placeId,180,'la parada',true);
 if(!/^[a-zA-Z0-9_-]+$/.test(placeId))fail('Identificador de parada inválido.');
 const rewardType=str(input.rewardType,30,'el tipo de premio',true);
 if(!TYPES.has(rewardType))fail('Tipo de premio no permitido.');
 const stock=input.stock==null||input.stock===''?null:int(input.stock,0,Number.MAX_SAFE_INTEGER,'el cupo');
 return {placeId,active:input.active===true,targetVisits:int(input.targetVisits,10,30,'la meta de sellos'),
 maxVisitsPerDay:int(input.maxVisitsPerDay,1,3,'el límite diario'),
 rewardTitle:str(input.rewardTitle,100,'el nombre del premio',true),
 rewardDescription:str(input.rewardDescription||'',400,'las condiciones'),
 rewardType,rewardValidityDays:int(input.rewardValidityDays,1,365,'la validez'),stock};
}
function assertAssigned({role,assignedPlaceIds,placeId}){
 if(role==='admin')return true;
 if(role!=='merchant'||!Array.isArray(assignedPlaceIds)||!assignedPlaceIds.includes(placeId))
  fail('No tienes autorización para configurar esta parada.');
 return true;
}
function assertSafeEdit(previous,next,{hasProgress=false,claimedCount=0}={}){
 if(!previous)return true;
 if(hasProgress){
  for(const key of ['targetVisits','maxVisitsPerDay','rewardTitle','rewardDescription','rewardType','rewardValidityDays']){
   if(previous[key]!==next[key])fail('La tarjeta ya tiene sellos. Conserva sus condiciones y crea una nueva versión.');
  }
 }
 const issued=int(claimedCount,0,Number.MAX_SAFE_INTEGER,'los premios emitidos');
 if(next.stock!==null&&next.stock<issued)fail('El cupo no puede ser menor que los premios emitidos.');
 return true;
}
module.exports={normalizeLoyalty,assertAssigned,assertSafeEdit};
