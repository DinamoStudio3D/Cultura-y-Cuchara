"use strict";
const PROJECT_ID="cultura-y-cuchara";
const BASE="https://www.visitaloja.com";
const CATEGORY_PATHS=Object.fromEntries(Object.entries(require("./categoria-seo.js")._test.CONFIG).map(([path,config])=>[path,config.categories]));
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const STATIC_PATHS=["/","/aliados.html","/mesa-turistica.html","/planes.html","/sumar-negocio.html","/cantones.html"];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
const slug=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function value(v){if(!v)return"";if("stringValue"in v)return v.stringValue;if("booleanValue"in v)return v.booleanValue;if("integerValue"in v)return Number(v.integerValue);if("timestampValue"in v)return v.timestampValue;if("arrayValue"in v)return(v.arrayValue.values||[]).map(value);return""}
async function locales(fetchImpl){
 const out=[];let token="";
 do{
  const u=new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/locales`);
  u.searchParams.set("pageSize","300");if(token)u.searchParams.set("pageToken",token);
  const r=await fetchImpl(u);if(!r.ok)throw new Error(`Firestore ${r.status}`);
  const j=await r.json();for(const d of j.documents||[]){const f=d.fields||{},statuses=[value(f.publicationStatus),value(f.status)].filter(v=>v!==undefined&&v!==null&&String(v).trim()!=="").map(v=>String(v).toLowerCase());if(statuses.some(v=>!["published","active"].includes(v)))continue;const data=Object.fromEntries(Object.entries(f).map(([k,v])=>[k,value(v)]));if(!require("./categoria-seo.js")._test.published(data))continue;const id=decodeURIComponent(d.name.split("/").pop()),s=slug(value(f.slug)||value(f.title)||id);if(s)out.push({slug:s,cantonId:require("../js/canton-content.js").cantonId({cantonId:value(f.cantonId)}),cantonPublic:require("../js/canton-content.js").publicPlace({cantonId:value(f.cantonId),active:value(f.active),publicationStatus:value(f.publicationStatus),category:value(f.category),tag:value(f.tag),title:value(f.title),type:value(f.type)},require("../js/canton-content.js").cantonId({cantonId:value(f.cantonId)})),updated:value(f.updatedAt)||value(f.publishedAt)||"",category:[value(f.category),value(f.categoria),value(f.type),value(f.tipo)].flat().map(normalize)})}token=j.nextPageToken||"";
 }while(token);return out
}
module.exports=async function handler(req,res){
 try{
  const places=await locales(fetch);const cantonResponse=await fetch("https://firestore.googleapis.com/v1/projects/"+PROJECT_ID+"/databases/(default)/documents:runQuery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({structuredQuery:{from:[{collectionId:"siteContent"}],where:{compositeFilter:{op:"AND",filters:[{fieldFilter:{field:{fieldPath:"__name__"},op:"GREATER_THAN_OR_EQUAL",value:{referenceValue:"projects/"+PROJECT_ID+"/databases/(default)/documents/siteContent/canton_"}}},{fieldFilter:{field:{fieldPath:"__name__"},op:"LESS_THAN",value:{referenceValue:"projects/"+PROJECT_ID+"/databases/(default)/documents/siteContent/canton_\uf8ff"}}}]}}}}),signal:AbortSignal.timeout(8000)});if(!cantonResponse.ok)throw Error("Cantons unavailable");const cantonRows=await cantonResponse.json();const seen=new Set(),urls=[];
  const add=(path,lastmod,priority)=>{const loc=BASE+path;if(seen.has(loc))return;seen.add(loc);urls.push(`  <url><loc>${esc(loc)}</loc>${lastmod?`<lastmod>${esc(String(lastmod).slice(0,10))}</lastmod>`:""}<priority>${priority}</priority></url>`)};
  STATIC_PATHS.forEach((p,i)=>add(p,"",i===0?"1.0":"0.6"));const catalog=require("../js/chabaquito-place-config.js").CANTONS;places.filter(p=>p.cantonPublic&&catalog.some(c=>c.id===p.cantonId)).forEach(p=>add("/canton/"+p.cantonId,"","0.7"));cantonRows.filter(row=>row.document).forEach(row=>{const doc=row.document,key=doc.name.split("/").pop().replace(/^canton_/,"");if(catalog.some(c=>c.id===key)&&(value(doc.fields?.description)||["history","culture","gastronomy","climate","festivals","arrival"].some(key=>value(doc.fields?.[key]))))add("/canton/"+key,"","0.7")});places.forEach(p=>add("/parada/"+encodeURIComponent(p.slug),p.updated,"0.8"));Object.entries(CATEGORY_PATHS).forEach(([path,values])=>{if(places.some(p=>p.category.some(c=>values.includes(c))))add("/"+path,"","0.7")});
  res.setHeader("Content-Type","application/xml; charset=utf-8");res.setHeader("Cache-Control","public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.join("\n")+'\n</urlset>');
 }catch(e){console.error("sitemap",e);res.status(500).send("No se pudo generar el sitemap.");}
};
module.exports._test={slug};
