import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('css/public-brand-blue-v202.css');
function luminance(hex){hex=hex.slice(1);if(hex.length===3)hex=[...hex].map(x=>x+x).join('');return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0)}
test('solid brand surfaces retain readable primary, secondary and accent text',()=>{
 let checked=0;
 for(const block of css.matchAll(/\{([^{}]+)\}/g)){
  const bg=block[1].match(/background:\s*(#[\da-f]{6})(?![\da-f])/i);if(!bg)continue;
  for(const fg of block[1].matchAll(/--vl-(?:text|muted|accent):\s*(#[\da-f]{3,6});/gi)){
   const a=luminance(bg[1]),b=luminance(fg[1]);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${fg[1]} on ${bg[1]}`);checked++;
  }
 }
 assert(checked>=20);
});
test('all six core public pages load the shared palette after legacy color styles',()=>{
 for(const page of ['index.html','cantones.html','canton.html','negocio.html','tienda.html','fidelidad.html']){
  const head=read(page).split('</head>')[0],links=[...head.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)];const brand=links.findIndex(link=>link[0].includes('public-brand-blue-v202.css'));assert(brand>=0,page);for(const legacy of ['public-colors.css','place-detail-v103.css','site-spacing-v105.css']){const index=links.findIndex(link=>link[0].includes(legacy));if(index>=0)assert(brand>index,page+' '+legacy);}
 }
});
test('brand overrides preserve commerce and category accents and scope the main photograph tint',()=>{
 assert.doesNotMatch(css,/#previewWhatsapp|#previewOrderBtn|#festivalMapToggle|\.filter-btn/);
 assert.match(css,/#inicio \.vl-welcome-visual::after\s*\{[^}]*rgba\(10,57,99,\.58\),rgba\(7,34,63,\.78\)/);
});
test('small photograph labels remain readable across light and dark source images',()=>{
 const section=css.split('/* V208:')[1],rgba=section.match(/background:rgba\((\d+),(\d+),(\d+),([.\d]+)\)/),foreground=section.match(/color:(#[\da-f]+) !important/)[1];
 assert(rgba);const alpha=Number(rgba[4]),ink=luminance(foreground);
 for(let r=0;r<=255;r+=51)for(let g=0;g<=255;g+=51)for(let b=0;b<=255;b+=51){
  const blended='#'+[r,g,b].map((channel,i)=>Math.round(channel*(1-alpha)+Number(rgba[i+1])*alpha).toString(16).padStart(2,'0')).join('');const background=luminance(blended);
  assert((Math.max(background,ink)+.05)/(Math.min(background,ink)+.05)>=4.5,blended);
 }
});
