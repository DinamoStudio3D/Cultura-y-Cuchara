import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const images=require('../js/cloudinary-image-uploader.js');
const compressor=require('../js/image-compressor.js');
const auth={cloudName:'fixture',apiKey:'123',signature:'a'.repeat(40),params:{folder:'visitaloja/time/images',timestamp:1700000000,upload_preset:'images'}};
const payload={secure_url:'https://res.cloudinary.com/fixture/image/upload/v1/visitaloja/time/images/test.webp',public_id:'visitaloja/time/images/test',resource_type:'image',width:100,height:100};
test('image formats, empty files and byte limits are enforced before decoding',()=>{
 for (const type of ['image/jpeg','image/png','image/webp']) assert.doesNotThrow(()=>compressor.validateImageFile({type,size:20*1024*1024}));
 for (const file of [{type:'image/svg+xml',size:1},{type:'image/gif',size:1},{type:'image/jpeg',size:0},{type:'image/png',size:20*1024*1024+1}]) assert.throws(()=>compressor.validateImageFile(file));
 assert.deepEqual(compressor.calculateDimensions(4000,2000,1600,1600),{width:1600,height:800});
});
test('image uploader rejects foreign hosts, cloud accounts and folders; HTTP errors retain provider detail', async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>({ok:true,json:async()=>payload});
  assert.equal((await images.uploadSignedImage(new Blob(['photo']),auth)).url,payload.secure_url);
  for(const change of [{secure_url:'https://example.com/fake.webp'},{secure_url:payload.secure_url.replace('/fixture/','/other/')},{public_id:'visitaloja/events/test'},{resource_type:'video'},{secure_url:'https://user:pw@res.cloudinary.com/fixture/image/upload/a'}]){
   globalThis.fetch=async()=>({ok:true,json:async()=>({...payload,...change})});
   await assert.rejects(images.uploadSignedImage(new Blob(['photo']),auth));
  }
  globalThis.fetch=async()=>({ok:false,status:413,json:async()=>({error:{message:'File too large'}})});
  await assert.rejects(images.uploadSignedImage(new Blob(['photo']),auth),/File too large/);
 }finally{globalThis.fetch=original;}
});
test('image uploader cancels before sending and times out without hanging',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async(_url,{signal})=>{calls++;signal.throwIfAborted();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('abort'),{name:'AbortError'}))));};
  const controller=new AbortController();controller.abort();
  await assert.rejects(images.uploadSignedImage(new Blob(['photo']),auth,{signal:controller.signal}),{name:'AbortError'});
  await assert.rejects(images.uploadSignedImage(new Blob(['photo']),auth,{timeoutMs:5}),/dos minutos/);
  assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
test('one form keeps Save blocked until both image and audio finish and rejects programmatic submit',()=>{
 let handler;const button={disabled:false};const form={addEventListener(_name,fn){handler=fn},querySelectorAll(){return[button]}};
 const window={};vm.runInNewContext(readFileSync(new URL('../js/admin-media-guard.js',import.meta.url),'utf8'),{window,document:{getElementById:()=>form}});
 const guard=window.VisitaLojaMediaGuard;guard.begin('timeForm','image');guard.begin('timeForm','audio');guard.end('timeForm','audio');assert(button.disabled);
 let blocked=false;handler({preventDefault(){blocked=true},stopImmediatePropagation(){}});assert(blocked);
 guard.end('timeForm','image');assert(!button.disabled);assert(!guard.pending('timeForm'));
 button.disabled=true;guard.begin('timeForm','new');guard.end('timeForm','new');assert(button.disabled);
});
const deletion=require('../api/delete-merchant-image.js');
async function deleteFixture({url,linked=false,savedUrl=url,readOk=true,role='owner',anonymous=false}={}){
 let code,body,destroy=0;
 const env={CLOUDINARY_CLOUD_NAME:'fixture',CLOUDINARY_API_KEY:'123',CLOUDINARY_API_SECRET:'fixture-secret'};
 const fetchImpl=async endpoint=>{
  if(endpoint.includes('identitytoolkit'))return{ok:true,json:async()=>({users:[{localId:'user'}]})};
  if(endpoint.includes('businessAccess'))return{ok:true,json:async()=>({fields:{active:{booleanValue:true},role:{stringValue:role},placeId:{stringValue:'place'},uid:{stringValue:'user'}}})};
  if(endpoint.includes('missionRewardMerchants'))return{ok:false};
  if(endpoint.includes('/locales/'))return{ok:readOk,json:async()=>({fields:linked?{gallery:{arrayValue:{values:[{mapValue:{fields:{img:{stringValue:savedUrl}}}}]}}}: {}})};
  if(endpoint.endsWith('/image/destroy')){destroy++;return{ok:true,json:async()=>({result:'ok'})};}
  throw Error('Unexpected endpoint '+endpoint);
 };
 await deletion.createHandler({env,fetchImpl})({method:'POST',headers:{authorization:anonymous?'':'Bearer fixture'},body:{placeId:'place',purpose:'gallery',url}}, {setHeader(){},status(n){code=n;return this},json(v){body=v;return this}});
 return {code,body,destroy};
}
test('deletion is restricted to authorized place and purpose; a saved or unreadable reference is preserved',async()=>{
 const url='https://res.cloudinary.com/fixture/image/upload/v1/visitaloja/places/place/gallery/old.webp';
 assert.equal((await deleteFixture({url})).destroy,1);
 for(const foreign of [url.replace('/place/','/other/'),url.replace('/gallery/','/logo/'),url.replace('/fixture/','/other/'),'https://example.com/a.webp']) assert.equal((await deleteFixture({url:foreign})).destroy,0);
 const linked=await deleteFixture({url,linked:true});assert.equal(linked.code,409);assert.equal(linked.destroy,0);
 const transformed=await deleteFixture({url,linked:true,savedUrl:url.replace('/upload/v1/','/upload/c_fill,w_200/v1/')});assert.equal(transformed.code,409);assert.equal(transformed.destroy,0);
 const missing=await deleteFixture({url,readOk:false});assert.equal(missing.code,503);assert.equal(missing.destroy,0);
 assert.equal((await deleteFixture({url,anonymous:true})).code,401);
 assert.equal((await deleteFixture({url,role:'staff'})).code,403);
 for(const invalid of ['https://user:pw@res.cloudinary.com/fixture/image/upload/a.webp','https://res.cloudinary.com/fixture/image/upload/%E0%A4%A']) assert.equal(deletion.publicIdFromCloudinaryUrl(invalid,'fixture'),null);
});
test('historical photo signing fixes its own folder and keeps existing image preset',async()=>{
 const {createHandler}=require('../api/sign-time-image.js');let code,body;
 await createHandler({folder:'override',env:{CLOUDINARY_CLOUD_NAME:'fixture',CLOUDINARY_API_KEY:'123',CLOUDINARY_API_SECRET:'secret',CLOUDINARY_UPLOAD_PRESET:'images'},fetchImpl:async()=>({ok:true,json:async()=>({users:[{localId:'test',email:'sukogames1996@gmail.com'}]})})})({method:'POST',headers:{authorization:'Bearer test'},body:{folder:'override'}},{setHeader(){},status(n){code=n;return this},json(v){body=v}});
 assert.equal(code,200);assert.equal(body.params.folder,'visitaloja/time/images');assert.equal(body.params.upload_preset,'images');assert(!JSON.stringify(body).includes('secret'));
});
