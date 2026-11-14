'use strict';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const millis=value=>typeof value?.toMillis==='function'?value.toMillis():typeof value==='number'?value:0;
async function merchantProgram({db,user,input,stamp}){
 if(!user?.uid)fail(401,'Inicia sesión.');
 const placeId=String(input.placeId||'');if(!/^[A-Za-z0-9_-]{1,180}$/.test(placeId))fail(400,'Parada inválida.');
 const ref=db.collection('loyaltyPrograms').doc(placeId),ownerRef=db.collection('businessAccess').doc(user.uid+'_'+placeId),merchantRef=db.collection('missionRewardMerchants').doc(user.uid);
 return db.runTransaction(async tx=>{
  const [owner,merchant,program]=await Promise.all([tx.get(ownerRef),tx.get(merchantRef),tx.get(ref)]);
  const o=owner.data()||{},m=merchant.data()||{};
  const authorized=owner.exists?o.active===true&&o.uid===user.uid&&o.placeId===placeId&&o.role==='owner':m.active===true&&Array.isArray(m.placeIds)&&m.placeIds.includes(placeId);
  if(!authorized)fail(403,'Solo el propietario autorizado puede configurar este premio.');
  if(!program.exists)fail(412,'Administración debe crear primero el programa de fidelidad.');
  const raw=program.data();
  const seasonId=String(input.seasonId||'');
  const seasons=Array.isArray(raw.seasons)?raw.seasons:[];
  const index=seasonId?seasons.findIndex(s=>s?.id===seasonId):-1;if(seasonId&&index<0)fail(400,'Temporada no encontrada.');
  const selected=seasonId?seasons[index]:raw;
  const projection=()=>({version:millis(raw.updatedAt),rewardTitle:selected.rewardTitle||'',rewardDescription:selected.rewardDescription||'',rewardValidityDays:selected.rewardValidityDays||30,seasons:seasons.map(s=>({id:s.id,title:s.title||s.id}))});
  if(input.action==='load')return projection();
  if(input.action!=='save')fail(400,'Acción inválida.');
  if(input.version!==millis(raw.updatedAt))fail(409,'La configuración cambió. Actualiza antes de guardar.');
  const title=typeof input.rewardTitle==='string'?input.rewardTitle.trim():'',description=typeof input.rewardDescription==='string'?input.rewardDescription.trim():'';
  const days=input.rewardValidityDays;
  if(!title||title.length>100||description.length>400||!Number.isInteger(days)||days<1||days>365)fail(400,'Revisa el beneficio, condiciones y vigencia (1–365 días).');
  const fields={rewardTitle:title,rewardDescription:description,rewardValidityDays:days};
  const patch=seasonId?{seasons:seasons.map((s,i)=>i===index?{...s,...fields}:s)}:fields;
  tx.update(ref,{...patch,updatedAt:stamp,merchantUpdatedBy:user.uid});
  return {saved:true};
 });
}
module.exports={merchantProgram};
