/* Preserve existing writes while guarding duplicate submissions and stale feedback. */
(function(root){
 'use strict';
 function controller(deps){
  let busy=false;
  async function run(status,prepare,write){
   if(busy)return false;
   const session=deps.session();
   if(!session.uid||!deps.current(session)){deps.say(status,'Vuelve a iniciar sesión con una cuenta administrativa autorizada.');return false;}
   let data;try{data=prepare();}catch(error){deps.say(status,error.message);return false;}
   const controls=deps.controls(),states=controls.map(node=>node.disabled);busy=true;controls.forEach(node=>node.disabled=true);deps.say(status,'Guardando…');
   try{
    if(!deps.current(session))return false;
    await write(data,session);
    if(!deps.current(session))return false;
    deps.say(status,'Cambios guardados correctamente.');
    await deps.refresh();return true;
   }catch(error){if(deps.current(session))deps.say(status,deps.error(error));return false;}
   finally{controls.forEach((node,i)=>node.disabled=states[i]);busy=false;}
  }
  return {
   assign(uid){return run('merchantAssignmentStatus',()=>{
    if(!deps.merchants().some(item=>item.id===uid))throw Error('La cuenta seleccionada ya no está en la lista. Actualiza antes de guardar.');
    const ids=[...new Set(deps.assignment(uid))];
    if(ids.some(id=>!deps.places().some(place=>place.id===id)))throw Error('Una parada seleccionada ya no está disponible. Actualiza antes de guardar.');
    return {uid,placeIds:ids};
   },data=>deps.saveAssignment(data));},
   program(){return run('programMsg',()=>{
    const data=deps.programData();
    if(!deps.validForm())throw Error('Revisa los campos del programa antes de guardar.');
    const place=deps.places().find(item=>item.id===data.placeId);
    if(!place)throw Error('Selecciona una parada disponible.');
    if(!Number.isFinite(Number(data.minimumSpend??0))||Number(data.minimumSpend??0)<0||Number(data.minimumSpend??0)>100000||Math.abs(Number(data.minimumSpend??0)*100-Math.round(Number(data.minimumSpend??0)*100))>0.000001)throw Error('Revisa el consumo mínimo: entre $0 y $100.000, con máximo dos decimales.');
    const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
    if(!integer(data.targetVisits,10,30)||!integer(data.maxVisitsPerDay,1,3)||!integer(data.rewardValidityDays,1,365)||!(data.stock===null||integer(data.stock,0,Number.MAX_SAFE_INTEGER)))throw Error('Revisa las visitas, el límite diario, la validez y el stock.');
    if(!data.rewardTitle||data.rewardTitle.length>100||data.rewardDescription.length>400||!['product','discount','surprise'].includes(data.rewardType))throw Error('Completa el nombre, tipo y condiciones del premio.');
    return {...data,placeName:place.title||place.id};
   },(data,session)=>deps.saveProgram(data,session));}
  };
 }
 root.VisitaLojaFidelityAdminSaveController=controller;
 if(!root.document?.getElementById('programForm'))return;
 const get=id=>document.getElementById(id);
 root.VisitaLojaFidelityAdminSaves=controller({
  session:()=>({uid:adminSessionUid,generation:adminAccessGeneration,email:auth.currentUser?.email}),
  current:session=>Boolean(session.uid&&adminSessionUid===session.uid&&auth.currentUser?.uid===session.uid&&adminAccessGeneration===session.generation),
  controls:()=>[...document.querySelectorAll('#programForm input,#programForm select,#programForm textarea,#programForm button,#merchantList select,#merchantList button,#reload,#resetProgram')],
  say:(id,text)=>get(id).textContent=text,error:error=>root.VisitaLojaServiceErrors.message(error),refresh:()=>loadAll(),
  merchants:()=>merchants,places:()=>places,assignment:uid=>[...document.querySelector('[data-merchant="'+CSS.escape(uid)+'"]').selectedOptions].map(option=>option.value),
  validForm:()=>get('programForm').reportValidity(),
  programData:()=>({placeId:get('programPlace').value,active:get('programActive').checked,targetVisits:Number(get('programTarget').value),maxVisitsPerDay:Number(get('programDaily').value),minimumSpend:Number(get('programMinimum').value),rewardTitle:get('programReward').value.trim(),rewardDescription:get('programDescription').value.trim(),rewardType:get('programType').value,rewardValidityDays:Number(get('programValidity').value),stock:get('programStock').value===''?null:Number(get('programStock').value)}),
  saveAssignment:({uid,placeIds})=>db.collection('missionRewardMerchants').doc(uid).update({placeIds,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}),
  saveProgram:(data,session)=>db.collection('loyaltyPrograms').doc(data.placeId).set({...data,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:session.email},{merge:true})
 });
})(window);
