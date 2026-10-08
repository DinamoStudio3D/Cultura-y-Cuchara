"use strict";
const PROJECT_ID="cultura-y-cuchara";
const BASE="https://www.visitaloja.com";
const CATEGORY_PATHS={"hoteles-en-loja":["hotel","hoteles","hostal","hostales","hospedaje","alojamiento","alojamientos"],"restaurantes-en-loja":["restaurante","restaurantes","restaurant","comida tipica","gastronomia","picanteria","hueca","asadero","cevicheria"],"cafeterias-en-loja":["cafeteria","cafeterias","cafe","coffee shop"],"que-hacer-en-loja":["turismo","atractivo turistico","atractivos turisticos","experiencia turistica","experiencias turisticas","lugar turistico","sitio turistico","atractivo","naturaleza","cultura","aventura","destino turistico"]};
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const STATIC_PATHS=["/","/aliados.html","/mesa-turistica.html","/planes.html","/sumar-negocio.html"];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
const slug=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function value(v){if(!v)return"";if("stringValue"in v)return v.stringValue;if("booleanValue"in v)return v.booleanValue;if("integerValue"in v)return Number(v.integerValue);if("timestampValue"in v)return v.timestampValue;return""}
async function locales(fetchImpl){
 const out=[];let token="";
 do{
  const u=new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/locales`);
  u.searchParams.set("pageSize","300");if(token)u.searchParams.set("pageToken",token);
  const r=await fetchImpl(u);if(!r.ok)throw new Error(`Firestore ${r.status}`);
  const j=await r.json();for(const d of j.documents||[]){const f=d.fields||{},status=String(value(f.publicationStatus)||value(f.status)||"").toLowerCase();if(status&& !["published","active"].includes(status))continue;const id=decodeURIComponent(d.name.split("/").pop()),s=slug(value(f.slug)||value(f.title)||id);if(s)out.push({slug:s,updated:value(f.updatedAt)||value(f.publishedAt)||"",category:[value(f.category),value(f.categoria),value(f.type),value(f.tipo)].map(normalize)})}token=j.nextPageToken||"";
 }while(token);return out
}
module.exports=async function handler(req,res){
 try{
  const places=await locales(fetch);const seen=new Set(),urls=[];
  const add=(path,lastmod,priority)=>{const loc=BASE+path;if(seen.has(loc))return;seen.add(loc);urls.push(`  <url><loc>${esc(loc)}</loc>${lastmod?`<lastmod>${esc(String(lastmod).slice(0,10))}</lastmod>`:""}<priority>${priority}</priority></url>`)};
  STATIC_PATHS.forEach((p,i)=>add(p,"",i===0?"1.0":"0.6"));places.forEach(p=>add("/parada/"+encodeURIComponent(p.slug),p.updated,"0.8"));Object.entries(CATEGORY_PATHS).forEach(([path,values])=>{if(places.some(p=>p.category.some(c=>values.includes(c))))add("/"+path,"","0.7")});
  res.setHeader("Content-Type","application/xml; charset=utf-8");res.setHeader("Cache-Control","public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.join("\n")+'\n</urlset>');
 }catch(e){console.error("sitemap",e);res.status(500).send("No se pudo generar el sitemap.");}
};
module.exports._test={slug};
