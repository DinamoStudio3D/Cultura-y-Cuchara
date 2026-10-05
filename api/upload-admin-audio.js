"use strict";
const PROJECT_ID="cultura-y-cuchara";
const WEB_API_KEY="AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE";
const REPO="DinamoStudio3D/Cultura-y-Cuchara";
const BRANCH="feature/admin-audio-upload";
const MAX_AUDIO_BYTES=20*1024*1024;
function fieldString(f){return f&&typeof f.stringValue==="string"?f.stringValue:""}
function fieldBool(f){return !!(f&&f.booleanValue===true)}
function firestoreUrl(path){return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`}
async function readDocument(fetchImpl,path,token){const r=await fetchImpl(firestoreUrl(path),{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)return null;return (await r.json()).fields||{}}
function clean(value,fallback){const v=String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"");return v||fallback}
function createHandler({fetchImpl=fetch,env=process.env,now=Date.now}={}){return async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Método no permitido."});
 const token=/^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization||"")?.[1];if(!token)return res.status(401).json({error:"Debes iniciar sesión."});
 const {placeId,language,fileName,content}=req.body||{};if(typeof placeId!=="string"||!/^[A-Za-z0-9_-]{1,120}$/.test(placeId)||!/^(es|en)$/.test(language||"")||typeof content!=="string"||!content)return res.status(400).json({error:"Archivo de audio inválido."});
 const bytes=Math.floor(content.length*3/4);if(bytes>MAX_AUDIO_BYTES)return res.status(413).json({error:"El audio supera el límite de 20 MB."});
 const githubToken=env.GITHUB_AUDIO_TOKEN;if(!githubToken)return res.status(503).json({error:"La subida a GitHub aún no está configurada."});
 try{
  const identity=await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token})});if(!identity.ok)return res.status(401).json({error:"La sesión ha caducado."});
  const user=(await identity.json()).users?.[0];if(!user?.localId||user.disabled)return res.status(401).json({error:"La sesión no es válida."});
  let authorized=user.email==="sukogames1996@gmail.com";if(!authorized){const profile=await readDocument(fetchImpl,`adminUsers/${encodeURIComponent(user.localId)}`,token);authorized=!!profile&&fieldBool(profile.active)&&["admin","owner"].includes(fieldString(profile.role));}if(!authorized)return res.status(403).json({error:"Solo un administrador puede subir audioguías."});
  const original=clean(fileName,`audio-${language}.mp3`),ext=(original.match(/\.[A-Za-z0-9]{2,5}$/)||[".mp3"])[0].toLowerCase(),base=clean(original.replace(/\.[^.]+$/,"") ,"audio").slice(0,70),stamp=new Date(now()).toISOString().replace(/[-:.TZ]/g,"").slice(0,14),path=`audios/${clean(placeId,"parada")}-${language}-${stamp}-${base}${ext}`;
  const api=`https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g,"/")}`;
  const gh=await fetchImpl(api,{method:"PUT",headers:{"Accept":"application/vnd.github+json","Authorization":`Bearer ${githubToken}`,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},body:JSON.stringify({message:`content: add ${language} audioguide for ${placeId}`,content,branch:BRANCH})});
  let data=null;try{data=await gh.json();}catch(_){}if(!gh.ok){console.error("github audio upload",gh.status,data?.message);return res.status(502).json({error:"GitHub no pudo guardar el audio."});}
  return res.status(200).json({path:`/${path}`,repositoryPath:path,branch:BRANCH,commit:data?.commit?.sha||null});
 }catch(e){console.error("upload-admin-audio",e);return res.status(503).json({error:"No se pudo procesar la subida del audio."});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
