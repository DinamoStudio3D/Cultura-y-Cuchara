// Snapshot the shared web editor schema for the native administrator; no DOM/network access.
const fs=require('node:fs');const path=require('node:path');
require('../js/homepage-content.js');require('../js/brands-config.js');
const native=new Set(['welcomePassport','welcomeMissions','shopGateway','provinceGateway','placesIntro','postcardsIntro','timeIntro','podcastIntro','welcomeSearch','welcomeActions']);
const blocks=globalThis.VisitaLojaHomepage.blocks.filter(b=>!/^lojaGallery[0-9]+$/.test(b.id)).map(b=>({id:b.id,name:b.name,native:native.has(b.id),fields:b.fields.map(([key,label,,es,en])=>({key,label,es:es||'',en:en||''})),links:(b.links||[]).map(([key,label,,url])=>({key,label,url})),image:!!b.image,imageUrl:b.imageUrl||'',imageAlt:b.imageAlt||'',noVisibility:!!b.noVisibility,optionalHttpsLinks:!!b.optionalHttpsLinks}));
const content=JSON.stringify({version:1,blocks,supporters:globalThis.VisitaLojaBrandsModel.defaults},null,2)+'\n';
const file=path.resolve(__dirname,'../android/native/app/src/main/assets/admin-home-catalog.json');
if(process.argv.includes('--check')) {if(fs.readFileSync(file,'utf8')!==content)throw Error('Regenera el catálogo Android con node scripts/export-android-home-catalog.cjs');}
else fs.writeFileSync(file,content);
