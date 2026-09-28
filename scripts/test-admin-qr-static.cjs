/* node scripts/test-admin-qr-static.cjs (requiere sharp para rasterizar SVG).
 * Contrasta el QR real de la vista previa, el PNG y el SVG con un decodificador independiente. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'sharp') : 'sharp');
const jsQR=require('../js/vendor/jsQR.js');
const project=path.resolve(__dirname,'..');
const url='https://www.visitaloja.com/';
const document={createElement:()=>{throw new Error('Canvas no preparado')}};
const qrcode=require(project+'/js/vendor/qrcode-generator.js');
const source=fs.readFileSync(project+'/js/admin-qr-static.js','utf8');
const head=source.slice(source.indexOf('(() => {'),source.indexOf("  const module = $('qrModule');"));
const stub={document,qrcode,URL,jsQR};
const api=vm.runInNewContext(head+'return {validatedUrl,qrMatrix,svgMarkup,pngCanvas,assertQrDestination};})();',stub);
function makeCanvas(logoImage){
 const c={width:0,height:0,pixels:null,getContext(){return ctx}};
 const ctx={fillStyle:'#000000',getImageData(){return {data:new Uint8ClampedArray(c.pixels)}},fillRect(x,y,w,h){
   if(!c.pixels)c.pixels=Buffer.alloc(c.width*c.height*4);
   const hex=this.fillStyle;const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
   for(let py=Math.max(0,Math.floor(y));py<Math.min(c.height,Math.ceil(y+h));py++)for(let px=Math.max(0,Math.floor(x));px<Math.min(c.width,Math.ceil(x+w));px++){
    const off=(py*c.width+px)*4;c.pixels[off]=rgb[0];c.pixels[off+1]=rgb[1];c.pixels[off+2]=rgb[2];c.pixels[off+3]=255;
   }
 },drawImage(image,x,y,w,h){
   assert(image===logoImage);for(let py=Math.max(0,Math.floor(y));py<Math.min(c.height,Math.ceil(y+h));py++)for(let px=Math.max(0,Math.floor(x));px<Math.min(c.width,Math.ceil(x+w));px++){
    const sx=Math.min(511,Math.max(0,Math.floor((px-x)*512/w))),sy=Math.min(511,Math.max(0,Math.floor((py-y)*512/h)));
    const src=(sy*512+sx)*4,dst=(py*c.width+px)*4,a=image.pixels[src+3]/255;
    for(let j=0;j<3;j++)c.pixels[dst+j]=Math.round(image.pixels[src+j]*a+c.pixels[dst+j]*(1-a));
    c.pixels[dst+3]=255;
   }
 }};return c;
}
async function scan(pixels,size,label){const result=jsQR(new Uint8ClampedArray(pixels),size,size,{inversionAttempts:'dontInvert'});console.log(label,result?.data||'SIN LECTURA');return result?.data}
async function run(logo,size){
 const matrix=api.qrMatrix(url,'H');
 const logoBuffer=logo?fs.readFileSync(project+'/visita-loja-icon-512.png'):null;
 const img=logo?await sharp(logoBuffer).ensureAlpha().resize(512,512).raw().toBuffer({resolveWithObject:true}):null;
 const logoImage=logo?{pixels:img.data}:null;
 const data={url,matrix,size,margin:4,dark:'#101820',light:'#ffffff',logo:logo?{image:logoImage,data:'data:image/png;base64,'+logoBuffer.toString('base64')}:null};
 const svg=api.svgMarkup(data);
 const raster=await sharp(Buffer.from(svg)).resize(size,size).ensureAlpha().raw().toBuffer();
 const canvas=makeCanvas(logoImage);
 document.createElement=()=>canvas;
 const pngCanvas=api.pngCanvas(data);
 const png=await sharp(pngCanvas.pixels,{raw:{width:size,height:size,channels:4}}).png().toBuffer();
 const svgValue=await scan(raster,size,logo?'SVG logo':'SVG sin logo');
 const pngValue=await scan(await sharp(png).raw().toBuffer(),size,logo?'PNG logo':'PNG sin logo');
 assert.strictEqual(svgValue,url);assert.strictEqual(pngValue,url);
 api.assertQrDestination(pngCanvas,url);
 const wrong={...data,matrix:api.qrMatrix('https://.www.visitaloja.com/','H'),logo:null};
 const badCanvas=makeCanvas(null);document.createElement=()=>badCanvas;
 assert.throws(()=>api.assertQrDestination(api.pngCanvas(wrong),url),/destino distinto/);
}
(async()=>{for(const size of [512,1024]){await run(false,size);await run(true,size)}console.log('QR sin logo, con logo, PNG, SVG y rechazo del destino incorrecto: OK')})()
 .catch(error=>{console.error(error);process.exitCode=1});
