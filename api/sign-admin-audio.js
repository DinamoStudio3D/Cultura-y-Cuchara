"use strict";
const {createAdminAudioSignature}=require("../functions/admin-audio-signing");
const PROJECT_ID="cultura-y-cuchara";
const WEB_API_KEY="AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE";
function fieldString(f){return f&&typeof f.stringValue==="string"?f.stringValue:""}
function fieldBool(f){return !!(f&&f.booleanValue===true)}
function firestoreUrl(path){return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`}
async function readDocument(fetchImpl,path,token){const r=await fetchImpl(firestoreUrl(path),{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)return null;return (await r.json()).fields||{}}
function createHandler({fetchImpl=fetch,env=process.env,now=Date.now}={}){return async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Método no permitido."});
 const token=/^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization||"")?.[1];
 if(!token)return res.status(401).json({error:"Debes iniciar sesión."});
 const {placeId,language}=req.body||{};
 if(typeof placeId!=="string"||!/^[A-Za-z0-9_-]{1,180}$/.test(placeId)||!/^(es|en)$/.test(language||""))return res.status(400).json({error:"Destino de audio inválido."});
 const credentials={cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,apiSecret:env.CLOUDINARY_API_SECRET,uploadPreset:env.CLOUDINARY_UPLOAD_PRESET};
 if(Object.values(credentials).some(v=>!v))return res.status(503).json({error:"Cloudinary aún no está configurado."});
 try{
  const identity=await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token})});
  if(!identity.ok)return res.status(401).json({error:"La sesión ha caducado."});
  const user=(await identity.json()).users?.[0];if(!user?.localId||user.disabled)return res.status(401).json({error:"La sesión no es válida."});
  let authorized=user.email==="sukogames1996@gmail.com";
  if(!authorized){const profile=await readDocument(fetchImpl,`adminUsers/${encodeURIComponent(user.localId)}`,token);authorized=!!profile&&fieldBool(profile.active)&&["admin","owner"].includes(fieldString(profile.role));}
  if(!authorized)return res.status(403).json({error:"Solo un administrador puede subir audioguías."});
  return res.status(200).json(createAdminAudioSignature({placeId,language,credentials,timestamp:Math.floor(now()/1000)}));
 }catch(e){console.error("sign-admin-audio",e);return res.status(503).json({error:"No se pudo autorizar el audio."});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
