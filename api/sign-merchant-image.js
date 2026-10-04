"use strict";
const {createMerchantImageSignature}=require("../functions/merchant-image-signing");
const PROJECT_ID="cultura-y-cuchara";
const WEB_API_KEY="AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE";
const DEFAULT_GALLERY_LIMIT=6;
function fieldString(f){return f&&typeof f.stringValue==="string"?f.stringValue:""}
function fieldBool(f){return !!(f&&f.booleanValue===true)}
function fieldInt(f,fallback){const n=Number(f&&(f.integerValue??f.doubleValue));return Number.isFinite(n)?Math.max(0,Math.min(100,Math.trunc(n))):fallback}
function fieldArray(f){return f?.arrayValue?.values||[]}
function fieldMap(f){return f?.mapValue?.fields||{}}
function firestoreUrl(path){return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`}
async function readDocument(fetchImpl,path,token){const r=await fetchImpl(firestoreUrl(path),{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)return null;return (await r.json()).fields||{}}
function localePlanId(fields){const subscription=fieldMap(fields.subscription);return fieldString(subscription.plan)||fieldString(subscription.planId)||fieldString(subscription.id)}
function configuredGalleryLimit(settingsFields,planId){if(!planId)return DEFAULT_GALLERY_LIMIT;for(const value of fieldArray(settingsFields.plans)){const plan=fieldMap(value),candidates=[fieldString(plan.id),fieldString(plan.key),fieldString(plan.slug),fieldString(plan.code),fieldString(plan.name)].map(x=>x.trim().toLowerCase()).filter(Boolean);if(candidates.includes(planId.trim().toLowerCase())){const features=fieldMap(plan.features);return fieldInt(features.maxGalleryImages,fieldInt(plan.maxGalleryImages,DEFAULT_GALLERY_LIMIT));}}return DEFAULT_GALLERY_LIMIT}
async function resolveGalleryLimit(fetchImpl,token,placeId,localeFields){const entitlement=await readDocument(fetchImpl,`businessEntitlements/${encodeURIComponent(placeId)}`,token);if(entitlement&&fieldBool(entitlement.active)!==false&&entitlement.maxGalleryImages)return fieldInt(entitlement.maxGalleryImages,DEFAULT_GALLERY_LIMIT);const settings=await readDocument(fetchImpl,"settings/subscriptions",token);return configuredGalleryLimit(settings||{},localePlanId(localeFields||{}))}
function createHandler({fetchImpl=fetch,env=process.env,now=Date.now}={}){return async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Método no permitido."});
 const token=/^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization||"")?.[1];
 if(!token)return res.status(401).json({error:"Debes iniciar sesión."});
 const {placeId,purpose}=req.body||{};
 if(typeof placeId!=="string"||typeof purpose!=="string"||!/^[A-Za-z0-9_-]{1,180}$/.test(placeId)||!/^(logo|hero|gallery)$/.test(purpose))return res.status(400).json({error:"Destino de imagen inválido."});
 const credentials={cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,apiSecret:env.CLOUDINARY_API_SECRET,uploadPreset:env.CLOUDINARY_UPLOAD_PRESET};
 if(Object.values(credentials).some(v=>!v))return res.status(503).json({error:"Cloudinary aún no está configurado."});
 try{
  const identity=await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token})});
  if(!identity.ok)return res.status(401).json({error:"La sesión ha caducado."});
  const user=(await identity.json()).users?.[0]; if(!user?.localId||user.disabled)return res.status(401).json({error:"La sesión no es válida."});
  const accessId=`${user.localId}_${placeId}`;
  const accessFields=await readDocument(fetchImpl,`businessAccess/${encodeURIComponent(accessId)}`,token);
  let authorized=!!accessFields&&fieldBool(accessFields.active)&&fieldString(accessFields.role)==="owner"&&fieldString(accessFields.placeId)===placeId&&fieldString(accessFields.uid)===user.localId;
  if(!authorized){
   // Compatibilidad temporal con propietarios ya existentes durante la migración.
   const legacy=await readDocument(fetchImpl,`missionRewardMerchants/${encodeURIComponent(user.localId)}`,token);
   if(legacy){const ids=fieldArray(legacy.placeIds).map(v=>fieldString(v));authorized=fieldBool(legacy.active)&&ids.includes(placeId);}
  }
  if(!authorized)return res.status(403).json({error:"Solo el propietario autorizado puede modificar imágenes de esta parada."});
  if(purpose==="gallery"){
   const locale=await readDocument(fetchImpl,`locales/${encodeURIComponent(placeId)}`,token);
   if(!locale)return res.status(404).json({error:"No se encontró la parada."});
   const limit=await resolveGalleryLimit(fetchImpl,token,placeId,locale);
   const currentCount=fieldArray(locale.gallery).length;
   if(currentCount>=limit)return res.status(409).json({error:`Tu plan permite máximo ${limit} fotos en la galería.`,code:"gallery-plan-limit-reached",limit,currentCount});
  }
  return res.status(200).json(createMerchantImageSignature({placeId,purpose,credentials,timestamp:Math.floor(now()/1000)}));
 }catch(e){console.error("sign-merchant-image",e);return res.status(503).json({error:"No se pudo autorizar la imagen."});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
