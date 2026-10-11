import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fixture(overrides={}) {
 const nodes={postcardCanvas:{getContext:()=>({}),closest:()=>null},postcardUserMsg:{value:'Primera frase'}};
 const context={document:{getElementById:id=>nodes[id]||null,createElement:()=>({getContext:()=>({translate(){},rotate(){},scale(){},drawImage(){}})})},Image:class{constructor(){this.complete=false;this.naturalWidth=0}},customPostcardFrames:[],loadedCustomFrameImages:{},brandedPostcardFrames:[{id:'brand-nature',name:'Loja Natural',color:'#173d30'}],currentPostcardTheme:'brand-nature',postcardOutputFormat:'story',postcardSettings:{sampleImg:'photo.png'},currentLang:'es',currentUploadedImageObj:null,postcardSampleImageObj:null,postcardSampleImageUrl:'',postcardImageReady:false,postcardPhotoRotation:0,postcardPhotoMirrored:false,loadPostcardBrandLogo(){},setPostcardImageStatus(){},drawPostcardContent(){},showToast(){},...overrides};
 vm.createContext(context);
 for(const [name,next] of [['resetPostcardDesign','setPostcardPhotoFit'],['postcardPhotoPlacement','rotatePostcardPhoto'],['postcardTransformedPhoto','loadPostcardBrandLogo'],['availableBrandedPostcardFrames','renderPublicFrameButtons'],['renderPostcardPreview','drawPostcardContent'],['sharePostcardWhatsapp','sharePostcardLink']]) {
  const start=source.search(new RegExp(`        (?:async )?function ${name}\\(`));
  const end=source.indexOf(`        function ${next}(`,start);
  assert.ok(start>=0&&end>start);vm.runInContext(source.slice(start,end),context);
 }
 return {context,nodes};
}
test('landscape photo can remain complete or fill a portrait frame; positioning stays inside padding',()=>{
 const {context:c}=fixture();let p=c.postcardPhotoPlacement(1600,900,1080,1920,'contain',1,0,0);
 assert.equal(p.width,1080);assert.equal(p.height,607.5);assert.equal(p.y,656.25);
 p=c.postcardPhotoPlacement(1600,900,1080,1920,'cover',1,0,0);assert.equal(p.height,1920);assert.ok(p.x<0);
 p=c.postcardPhotoPlacement(1600,900,1080,1920,'contain',1,0,100);assert.equal(p.y+p.height,1920);
});
test('rotation preserves original photo and produces correct portrait/landscape dimensions',()=>{
 const {context:c}=fixture(),photo={width:800,height:1200};assert.equal(c.postcardTransformedPhoto(photo),photo);
 c.postcardPhotoRotation=90;let out=c.postcardTransformedPhoto(photo);assert.equal(out.width,1200);assert.equal(out.height,800);
 c.postcardPhotoRotation=180;out=c.postcardTransformedPhoto(photo);assert.equal(out.width,800);assert.equal(out.height,1200);assert.deepEqual(photo,{width:800,height:1200});
});
test('configured frames preserve defaults, respect visibility and reject injected colors',()=>{
 const {context:c}=fixture();assert.equal(c.availableBrandedPostcardFrames().length,1);
 c.postcardSettings={brandFrames:{'brand-nature':{enabled:false}}};assert.equal(c.availableBrandedPostcardFrames().length,0);
 c.postcardSettings={brandFrames:{'brand-nature':{name:'Mi recuerdo',color:'red;bad'}}};const frame=c.availableBrandedPostcardFrames()[0];assert.equal(frame.name,'Mi recuerdo');assert.equal(frame.color,'#173d30');
});
test('async sample completion uses latest message and does not permit early export',()=>{
 let created=0,draws=[];const {context:c,nodes}=fixture({Image:class{constructor(){created++;this.complete=false;this.naturalWidth=0}},drawPostcardContent:(...args)=>draws.push(args)});
 c.renderPostcardPreview();nodes.postcardUserMsg.value='Última frase';c.renderPostcardPreview();assert.equal(created,1);assert.equal(c.postcardImageReady,false);
 const image=c.postcardSampleImageObj;image.complete=true;image.naturalWidth=800;image.onload();assert.equal(draws.length,1);assert.equal(draws[0].at(-1),'Última frase');assert.equal(c.postcardImageReady,true);
});
test('branded formats export requested dimensions while custom PNG ratio stays intact',()=>{
 const {context:c,nodes}=fixture({currentUploadedImageObj:{complete:true,naturalWidth:800}});
 for(const [format,height] of [['story',1920],['portrait',1350],['square',1080]]){c.postcardOutputFormat=format;c.renderPostcardPreview();assert.equal(nodes.postcardCanvas.width,1080);assert.equal(nodes.postcardCanvas.height,height)}
 c.currentPostcardTheme='custom';c.customPostcardFrames=[{id:'custom'}];c.loadedCustomFrameImages.custom={naturalWidth:1600,naturalHeight:800};c.renderPostcardPreview();assert.equal(nodes.postcardCanvas.width,1920);assert.equal(nodes.postcardCanvas.height,960);
});
test('sharing sends a PNG, downloads on unsupported devices and does nothing extra after cancellation',async()=>{
 let shared=0,downloaded=0;const {context:c,nodes}=fixture({postcardImageReady:true,File:class{constructor(blobs,name,options){this.name=name;this.type=options.type}},navigator:{canShare:()=>true,share:async data=>{assert.equal(data.files[0].type,'image/png');shared++}},downloadPostcardImage:()=>downloaded++});
 nodes.postcardCanvas.toBlob=callback=>callback({type:'image/png'});await c.sharePostcardWhatsapp();assert.equal(shared,1);assert.equal(downloaded,0);
 c.navigator.canShare=()=>false;await c.sharePostcardWhatsapp();assert.equal(downloaded,1);
 c.navigator.canShare=()=>true;c.navigator.share=async()=>{const error=new Error();error.name='AbortError';throw error};await c.sharePostcardWhatsapp();assert.equal(downloaded,1);
 c.postcardImageReady=false;await c.sharePostcardWhatsapp();assert.equal(shared,1);assert.equal(downloaded,1);
});

test('resetting adjustments preserves the source photo, personal text and selected frame',()=>{
 const photo={complete:true,naturalWidth:800};let resets=0;
 const {context:c,nodes}=fixture({currentUploadedImageObj:photo,postcardPhotoRotation:90,postcardPhotoMirrored:true,postcardPhotoFit:'contain',postcardOutputFormat:'square',currentPostcardFilter:'sepia',resetPostcardPhotoAdjustment:()=>resets++});
 nodes.postcardUserName={value:'Ana'};nodes.postcardUserMsg.value='Mi recuerdo';
 c.resetPostcardDesign();assert.equal(c.currentUploadedImageObj,photo);assert.equal(nodes.postcardUserName.value,'Ana');assert.equal(nodes.postcardUserMsg.value,'Mi recuerdo');assert.equal(c.currentPostcardTheme,'brand-nature');assert.equal(c.postcardPhotoFit,'cover');assert.equal(c.postcardPhotoRotation,0);assert.equal(c.postcardPhotoMirrored,false);assert.equal(resets,1);
 c.currentPostcardTheme='custom';c.customPostcardFrames=[{id:'custom'}];c.resetPostcardDesign();assert.equal(c.currentPostcardSticker,'none');assert.equal(c.postcardShowTexts,false);assert.equal(c.currentPostcardTheme,'custom');
});
