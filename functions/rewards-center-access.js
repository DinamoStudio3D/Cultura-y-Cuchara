'use strict';
// Server-side role resolution for the future rewards write API.
// This module performs no writes. Do not trust role or place IDs from request bodies.
const deny=(message='No tienes permiso para gestionar esta recompensa.')=>Object.assign(new Error(message),{status:403});
async function resolveRewardsActor({db,user,placeId}){
 if(!db||!user?.uid||typeof placeId!=='string'||!placeId||placeId.includes('/'))throw deny();
 const uid=user.uid;
 const [adminSnap,merchantSnap,ownerSnap]=await Promise.all([
  db.collection('adminUsers').doc(uid).get(),
  db.collection('missionRewardMerchants').doc(uid).get(),
  db.collection('businessAccess').doc(uid+'_'+placeId).get()
 ]);
 const admin=adminSnap.exists&&adminSnap.data().active===true&&adminSnap.data().role==='admin';
 if(admin||user.admin===true||user.role==='admin')return {uid,role:'admin',placeId};
 const merchant=merchantSnap.exists?merchantSnap.data():null;
 const owner=ownerSnap.exists?ownerSnap.data():null;
 const merchantAssigned=merchant?.active===true&&Array.isArray(merchant.placeIds)&&merchant.placeIds.includes(placeId);
 const ownerAssigned=owner?.active===true&&owner.uid===uid&&owner.placeId===placeId&&owner.role==='owner';
 if(!merchantAssigned&&!ownerAssigned)throw deny();
 return {uid,role:'merchant',placeId};
}
async function assertPassportEditor({db,user}){
 if(!db||!user?.uid)throw deny();
 const snap=await db.collection('adminUsers').doc(user.uid).get();
 if((snap.exists&&snap.data().active===true&&snap.data().role==='admin')||user.admin===true||user.role==='admin')return true;
 throw deny('Solo administración puede configurar recompensas del pasaporte.');
}
module.exports={resolveRewardsActor,assertPassportEditor};
