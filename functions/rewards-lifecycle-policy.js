'use strict';
// Pure, side-effect-free state policy. Call only after server-side authorization.
// This does not write Firestore, mint codes or change passport stamps.
const STATUSES=Object.freeze(['draft','approved','published','paused','expired','archived']);
const TRANSITIONS=Object.freeze({
 draft:['approved','archived'],approved:['draft','published','archived'],
 published:['paused','expired'],paused:['published','expired','archived'],
 expired:['archived'],archived:[]
});
const CLAIM_STATUSES=Object.freeze(['locked','unlocked','claimed','redeemed','expired']);
const CLAIM_TRANSITIONS=Object.freeze({
 locked:['unlocked'],unlocked:['claimed','expired'],
 claimed:['redeemed','expired'],redeemed:[],expired:[]
});
function error(message){const e=new Error(message);e.status=409;throw e}
function validStatus(status,allowed){if(typeof status!=='string'||!allowed.includes(status))error('Estado no reconocido.');return status}
function nextRewardStatus(current,next,{role}={}){
 validStatus(current,STATUSES);validStatus(next,STATUSES);
 if(role!=='admin')error('Solo administración puede publicar recompensas del pasaporte.');
 if(!TRANSITIONS[current].includes(next))error('Transición de recompensa no permitida.');
 return next;
}
function nextClaimStatus(current,next,{authorizedRedeemer=false}={}){
 validStatus(current,CLAIM_STATUSES);validStatus(next,CLAIM_STATUSES);
 if(!CLAIM_TRANSITIONS[current].includes(next))error('Transición de canje no permitida.');
 if(next==='redeemed'&&!authorizedRedeemer)error('Entrega no autorizada.');
 return next;
}
function validateMilestoneReward(input){
 if(!input||typeof input!=='object'||Array.isArray(input))error('Datos inválidos.');
 const type=input.type;
 if(!['general','sponsored'].includes(type))error('Tipo de recompensa inválido.');
 const title=typeof input.title==='string'?input.title.trim():'';
 const terms=typeof input.terms==='string'?input.terms.trim():'';
 const sponsorId=typeof input.sponsorId==='string'?input.sponsorId.trim():'';
 const milestone=Number(input.milestone);
 const stock=input.stock==null||input.stock===''?null:Number(input.stock);
 if(!title||title.length>100||terms.length>400)error('Revisa el título o las condiciones.');
 if(!Number.isSafeInteger(milestone)||milestone<1||milestone>1000)error('Meta de sellos inválida.');
 if(stock!==null&&(!Number.isSafeInteger(stock)||stock<0))error('Cupos inválidos.');
 if(type==='sponsored'&&!/^[a-zA-Z0-9_-]{1,180}$/.test(sponsorId))error('Se requiere identificador de negocio patrocinador.');
 if(type==='general'&&sponsorId)error('Un premio general no debe tener patrocinador.');
 return Object.freeze({type,title,terms,milestone,stock,sponsorId:type==='sponsored'?sponsorId:null,consumesStamps:false,status:'draft'});
}
module.exports={STATUSES,CLAIM_STATUSES,nextRewardStatus,nextClaimStatus,validateMilestoneReward};
