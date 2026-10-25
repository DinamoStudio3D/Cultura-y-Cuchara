'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),names=['centro-loja-torre-reloj','jipiro-pagoda-laguna','jipiro-laguna','atardecer-loja','panoramica-loja-blanco-negro','hecho-en-loja-talento'];
const out=path.join(root,'assets/photos/responsive');fs.mkdirSync(out,{recursive:true});
const report=[];
for(const name of names){
 const original=path.join(root,'assets/photos',name+'.webp');
 for(const width of [640,1280]){
  const file=path.join(out,name+'-'+width+'.webp');
  const temporary=file+'.tmp.webp';
  execFileSync('convert',[original,'-resize',width+'x>','-quality','82','-define','webp:method=6',temporary]);
  const dimensions=execFileSync('identify',['-format','%w %h',temporary],{encoding:'utf8'}).trim().split(' ').map(Number);
  if(!fs.statSync(temporary).size||dimensions[0]!==width)throw Error('Invalid responsive image: '+temporary);
  fs.renameSync(temporary,file);
  report.push({original:'assets/photos/'+name+'.webp',file:'assets/photos/responsive/'+path.basename(file),width:dimensions[0],height:dimensions[1],bytes:fs.statSync(file).size,originalBytes:fs.statSync(original).size});
 }
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
for(const item of report)console.log(path.basename(item.file)+': '+Math.round(item.bytes/1024)+' KB (original '+Math.round(item.originalBytes/1024)+' KB)');
