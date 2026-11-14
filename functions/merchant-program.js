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

async function merchantBirthday({db,user,input,stamp,now=Date.now()}){
 if(!user?.uid)fail(401,'Inicia sesión.');
 const place=String(input.placeId||''),visitId=String(input.visitId||'');if(!/^[A-Za-z0-9_-]{1,180}$/.test(place)||!/^[A-Za-z0-9_-]{1,180}$/.test(visitId))fail(400,'Visita inválida.');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
 const year=String(parts.year),today=Date.UTC(Number(year),Number(parts.month)-1,Number(parts.day));
 return db.runTransaction(async tx=>{
  const [merchant,visit,offer]=await Promise.all([tx.get(db.collection('missionRewardMerchants').doc(user.uid)),tx.get(db.collection('visitCodes').doc(visitId)),tx.get(db.collection('birthdayOffers').doc(place))]);
  const m=merchant.data()||{},v=visit.data()||{},o=offer.data()||{};
  if(m.active!==true||!Array.isArray(m.placeIds)||!m.placeIds.includes(place))fail(403,'No tienes acceso activo a esta parada.');
  if(!visit.exists||v.placeId!==place||v.status!=='confirmed'||typeof v.userId!=='string'||!v.userId||v.userId.includes('/'))fail(412,'Consulta y confirma primero la visita del cliente.');
  const md=String(v.birthMonthDay||'');if(!/^\d{2}-\d{2}$/.test(md)||!offer.exists||o.active!==true)return{available:false};
  const [month,day]=md.split('-').map(Number);if(month<1||month>12||day<1||day>31||new Date(Date.UTC(2000,month-1,day)).getUTCMonth()!==month-1)return{available:false};
  let birthday=Date.UTC(Number(year),month-1,day),distance=Math.round((birthday-today)/86400000);if(distance< -30){birthday=Date.UTC(Number(year)+1,month-1,day);distance=Math.round((birthday-today)/86400000);}
  const before=Number(o.daysBefore??7),after=Number(o.daysAfter??2),minimum=Number(o.minimumSpend||0);
  if(!Number.isFinite(before)||!Number.isFinite(after)||!Number.isFinite(minimum)||minimum<0||distance>before||distance< -after)return{available:false};
  const ref=db.collection('birthdayRedemptions').doc(v.userId+'_'+place+'_'+year),used=await tx.get(ref);
  const view={available:true,used:used.exists,title:String(o.title||'Beneficio de cumpleaños').slice(0,120),description:String(o.description||'').slice(0,500),minimumSpend:minimum,version:millis(o.updatedAt)};
  if(input.action==='birthday-load')return view;
  if(input.action!=='birthday-redeem')fail(400,'Acción inválida.');
  if(input.confirmed!==true)fail(400,'Confirma presencia y fecha de cumpleaños del visitante.');
  if(used.exists)fail(409,'El beneficio ya se entregó este año.');
  if(input.version!==view.version)fail(409,'La oferta cambió. Consulta de nuevo antes de entregar.');
  if(typeof input.purchaseAmount!=='number'||!Number.isFinite(input.purchaseAmount)||input.purchaseAmount<minimum||input.purchaseAmount>100000||typeof input.receiptRef!=='string'||input.receiptRef.length>80)fail(400,'Revisa el consumo mínimo y el comprobante.');
  tx.create(ref,{userId:v.userId,userName:String(v.userName||'Visitante').slice(0,100),placeId:place,placeName:String(v.placeName||place).slice(0,180),offerTitle:view.title,year,purchaseAmount:input.purchaseAmount,receiptRef:input.receiptRef,redeemedAt:stamp,redeemedBy:user.uid});
  return{...view,used:true,saved:true};
 });
}
module.exports.merchantBirthday=merchantBirthday;
