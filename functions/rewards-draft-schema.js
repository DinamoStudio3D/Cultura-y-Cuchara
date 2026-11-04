'use strict';
// Pure validation for the isolated rewardProgramDrafts collection.
// This module does not perform Firestore writes or publish rewards.
const TYPES=new Set(['product','discount','surprise']);
function normalizeRewardDraft(input,placeId,authorUid,now){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid draft');
 if(typeof placeId!=='string'||!placeId||placeId.includes('/')||typeof authorUid!=='string'||!authorUid||authorUid.includes('/'))throw Error('Invalid owner or place');
 const title=typeof input.title==='string'?input.title.trim():'';
 const description=typeof input.description==='string'?input.description.trim():'';
 const targetVisits=Number(input.targetVisits),validityDays=Number(input.validityDays);
 const stock=input.stock===''||input.stock==null?0:Number(input.stock);
 if(title.length<3||title.length>100||description.length>1000||!Number.isInteger(targetVisits)||targetVisits<10||targetVisits>30||!Number.isInteger(validityDays)||validityDays<1||validityDays>365||!Number.isSafeInteger(stock)||stock<0||stock>1000000||!TYPES.has(input.rewardType))throw Error('Invalid reward draft fields');
 if(!now)throw Error('Server timestamp required');
 return {placeId,authorUid,status:'draft',title,description,targetVisits,validityDays,stock,rewardType:input.rewardType,createdAt:now,updatedAt:now};
}
module.exports={normalizeRewardDraft};
