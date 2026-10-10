/* Real admin DOM + isolated Firebase/Cloudinary. No real writes or credentials. */
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const output=process.env.VISITALOJA_QA_OUTPUT || '/tmp/visitaloja-v74-qa';
const executable=process.env.VISITALOJA_QA_BROWSER || chromium.executablePath();
const cssFile=process.env.VISITALOJA_QA_CSS || '/tmp/visitaloja-tailwind.css';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR0sAAAAASUVORK5CYII=','base64');
const photo={name:'loja.webp',mimeType:'image/webp',buffer:fs.readFileSync(path.join(root,'assets/photos/loja-puerta.webp'))};
function wave(){const b=Buffer.alloc(44+16000);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(16000,40);return b;}
const audio={name:'voice.wav',mimeType:'audio/wav',buffer:wave()};
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
 const report=[]; let lastPage;
 try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  const page=lastPage=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());requests.push(url.href);if(process.env.VISITALOJA_QA_DEBUG && (url.pathname.startsWith('/api/')||url.host==='api.cloudinary.com'))console.log('REQUEST',route.request().method(),url.href);
   if(url.host==='qa.test'){
    if(url.pathname.startsWith('/api/')){
     if(url.pathname==='/api/delete-merchant-image')return route.fulfill({json:{deleted:true}});
     const mode=await page.evaluate(()=>fixture.mode);
     if(mode==='sign-error')return route.fulfill({status:403,json:{error:'Permiso de prueba rechazado.'}});
     const folder=url.pathname.includes('merchant-image')?'visitaloja/places/'+route.request().postDataJSON().placeId+'/'+route.request().postDataJSON().purpose:url.pathname.includes('time-audio')?'visitaloja/time/audio':url.pathname.includes('time-image')?'visitaloja/time/images':url.pathname.includes('homepage')?'visitaloja/homepage':'visitaloja/events/posters';
     return route.fulfill({json:{cloudName:'fixture',apiKey:'123',signature:'a'.repeat(40),params:{folder,timestamp:1700000000,...(folder.endsWith('/audio')?{}:{upload_preset:'images'})}}});
    }
    const file=path.join(root,url.pathname==='/'?'admin.html':decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
    return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
   }
   if(url.host==='cdn.tailwindcss.com')return route.fulfill({body:'document.head.insertAdjacentHTML("beforeend",'+JSON.stringify('<style>'+fs.readFileSync(cssFile,'utf8')+'</style>')+');',contentType:'text/javascript'});
   if(url.host==='www.gstatic.com')return route.fulfill({body:url.pathname.includes('firebase-app-compat')?fs.readFileSync(path.join(root,'scripts/fixtures/firebase-multimedia.js')):'',contentType:'text/javascript'});
   if(url.host==='api.cloudinary.com'){
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'*'}});
    const mode=await page.evaluate(()=>fixture.mode);
    if(mode==='hold')return;
    if(mode==='upload-error')return route.fulfill({status:413,headers:{'Access-Control-Allow-Origin':'*'},json:{error:{message:'Archivo rechazado de prueba'}}});
    const post=route.request().postDataBuffer().toString();
    const folder=post.match(/name="folder"\r\n\r\n([^\r]+)/)?.[1];assert(folder);
    const audio=folder.endsWith('/audio'),type=audio?'video':'image',extension=audio?'wav':'webp';
    return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{secure_url:`https://res.cloudinary.com/fixture/${type}/upload/v1/${folder}/fixture.${extension}`,public_id:folder+'/fixture',resource_type:type,width:1,height:1}});
   }
   if(url.host==='res.cloudinary.com'||/\.(png|webp|jpg)(\?|$)/.test(url.href))return route.fulfill({body:url.pathname.endsWith('.wav')?wave():photo.buffer,contentType:url.pathname.endsWith('.wav')?'audio/wav':'image/webp'});
   // All remaining third-party libraries/assets are inert during isolated QA.
   return route.fulfill({body:'',contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript'});
  });
  await page.goto('https://qa.test/admin.html',{waitUntil:'load'});
  await page.evaluate(()=>{document.getElementById('loginView').classList.add('hidden');document.getElementById('adminView').classList.remove('hidden');showAdminModule('time');});
  assert.deepEqual(errors,[]);
  const old='https://res.cloudinary.com/fixture/image/upload/v1/visitaloja/time/images/old.webp';
  await page.locator('#timeImagePast').fill(old);
  await page.locator('#timePastFile').setInputFiles(photo);
  await page.locator('#timePastUpload').click();
  await page.waitForFunction(()=>document.getElementById('timePastStatus').textContent.includes('Fotografía subida.'));
  assert.match(await page.locator('#timeImagePast').inputValue(),/fixture.webp$/);
  // Concurrent image + audio; cancelling one does not unlock Save.
  await page.evaluate(()=>{fixture.mode='hold';document.getElementById('timeImagePast').value='https://res.cloudinary.com/fixture/image/upload/v1/visitaloja/time/images/old.webp';});
  await page.locator('#timePastFile').setInputFiles(photo);await page.locator('#timePastUpload').click();
  await page.locator('#timeAudioFileEs').setInputFiles(audio);await page.locator('#timeAudioUploadEs').click();
  await page.waitForFunction(()=>document.getElementById('timeAudioStatusEs').textContent.startsWith('Subiendo audio'));
  assert(await page.locator('#timeSaveBtn').isDisabled());
  if(width===390||width===1440)await page.locator('#timeForm').screenshot({path:path.join(output,`time-pending-${width}.png`)});
  await page.locator('#timeAudioCancelEs').click();
  await page.waitForFunction(()=>document.getElementById('timeAudioUploadEs').disabled===false);
  assert(await page.locator('#timeSaveBtn').isDisabled());
  await page.locator('#timePastCancel').click();
  await page.waitForFunction(()=>document.getElementById('timeSaveBtn').disabled===false);
  assert.equal(await page.locator('#timeImagePast').inputValue(),old);
  // Error and invalid input preserve existing image.
  await page.evaluate(()=>fixture.mode='upload-error');
  await page.locator('#timePastFile').setInputFiles(photo);await page.locator('#timePastUpload').click();
  await page.waitForFunction(()=>document.getElementById('timePastStatus').textContent.includes('Archivo rechazado'));
  assert.equal(await page.locator('#timeImagePast').inputValue(),old);
  await page.locator('#timePastFile').setInputFiles({name:'corrupt.png',mimeType:'image/png',buffer:Buffer.from('not an image')});await page.locator('#timePastUpload').click();
  await page.waitForFunction(()=>document.getElementById('timePastStatus').textContent.includes('No se pudo leer'));
  assert.equal(await page.locator('#timeImagePast').inputValue(),old);
  // Signed audio for both languages must be playable; it is not persisted yet.
  await page.evaluate(()=>fixture.mode='success');
  for(const language of ['Es','En']){
   await page.locator('#timeAudioFile'+language).setInputFiles(audio);await page.locator('#timeAudioUpload'+language).click();
   await page.waitForFunction(l=>document.getElementById('timeAudioStatus'+l).textContent.startsWith('Audio subido'),language);
   await page.waitForFunction(l=>document.getElementById('timeAudioPreview'+l).readyState>=1,language);
  }
  assert.equal(await page.evaluate(()=>fixture.writes.length),0);
  await page.locator('#timeImagePresent').fill(old);
  await page.locator('#timeTitle').fill('Punto de prueba aislado');await page.locator('#timeDesc').fill('Datos simulados');
  await page.locator('#timeLabelPast').fill('Ayer');await page.locator('#timeLabelPresent').fill('Hoy');
  await page.locator('#timeLat').fill('-3.99');await page.locator('#timeLng').fill('-79.2');
  await page.locator('#timeSaveBtn').click();
  await page.waitForFunction(()=>fixture.writes.some(w=>w.path.startsWith('/loja_tiempo/')));
  const saved=await page.evaluate(()=>fixture.writes.find(w=>w.path.startsWith('/loja_tiempo/')).data);
  assert.match(saved.audioUrl,/fixture.wav$/);assert.match(saved.audioUrlEn,/fixture.wav$/);
  // Visual screenshot of actual form, populated with isolated fixture only.
  await page.locator('#timeTitle').fill('Punto histórico · prueba aislada');
  await page.locator('#timeImagePast').fill(old);await page.locator('#timeImagePresent').fill(old);
  await page.locator('#timePastFile').setInputFiles(photo);
  await page.locator('#timeForm').scrollIntoViewIfNeeded();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(output,`time-${width}.png`),fullPage:true});
  if(width===390||width===1440)await page.locator('#timeForm').screenshot({path:path.join(output,`time-form-${width}.png`)});
  const overflow=await page.locator('#timeForm input:not([type="hidden"]), #timeForm button').evaluateAll(nodes=>nodes.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}).map(el=>el.id));
  assert.deepEqual(overflow,[]);
  // Event replacement cancelled by changing to another event.
  await page.evaluate(()=>{setAdminUnsavedChanges(false);showAdminModule('events');generalEvents=[{id:'second',title:'Otro evento',date:'2026-11-01',lat:-3.99,lng:-79.2,img:'https://res.cloudinary.com/fixture/image/upload/v1/visitaloja/events/posters/second.webp'}];fixture.mode='hold';});
  await page.locator('#generalEventImage').fill(old);await page.locator('#generalEventImageFile').setInputFiles(photo);await page.locator('#generalEventUploadBtn').click();
  await page.waitForFunction(()=>document.getElementById('generalEventUploadStatus').textContent.startsWith('Subiendo fotografía'));
  assert(await page.locator('#generalEventSaveBtn').isDisabled());
  await page.evaluate(()=>editGeneralEvent('second'));
  await page.waitForFunction(()=>!document.getElementById('generalEventUploadBtn').disabled);
  assert.match(await page.locator('#generalEventImage').inputValue(),/second.webp$/);
  await page.evaluate(()=>fixture.mode='sign-error');
  await page.locator('#generalEventImageFile').setInputFiles(photo);await page.locator('#generalEventUploadBtn').click();
  await page.waitForFunction(()=>document.getElementById('generalEventUploadStatus').textContent.includes('Permiso de prueba'));
  assert.match(await page.locator('#generalEventImage').inputValue(),/second.webp$/);
  await page.locator('#generalEventForm').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,`events-${width}.png`),fullPage:true});
  if(width===390||width===1440)await page.locator('#generalEventForm').screenshot({path:path.join(output,`event-form-${width}.png`)});
  // Homepage discard cancels pending photo, leaving published/default URL intact.
  await page.evaluate(()=>{setAdminUnsavedChanges(false);showAdminModule('settings');fixture.mode='hold';});
  await page.locator('#home-explore-file').evaluate(el=>el.closest('details').open=true);
  const originalHome=await page.locator('#home-explore-imageUrl').inputValue();
  await page.locator('#home-explore-file').setInputFiles(photo);
  await page.waitForFunction(()=>document.getElementById('home-explore-cancel').offsetParent!==null);
  await page.locator('#home-explore-cancel').click();
  await page.waitForFunction(()=>!document.getElementById('home-explore-file').disabled);
  assert.equal(await page.locator('#home-explore-imageUrl').inputValue(),originalHome);
  await page.locator('#home-explore-file').setInputFiles(photo);
  await page.waitForFunction(()=>document.getElementById('home-explore-cancel').offsetParent!==null);
  await page.locator('#home-content-discard').click();
  await page.waitForFunction(()=>!document.getElementById('home-explore-file').disabled);
  assert.equal(await page.locator('#home-explore-imageUrl').inputValue(),originalHome);
  await page.screenshot({path:path.join(output,`homepage-${width}.png`),fullPage:true});
  if(width===390||width===1440)await page.locator('#home-explore-file').locator('..').locator('..').screenshot({path:path.join(output,`homepage-photo-${width}.png`)});
  // Merchant portal: cancellation and failed save never trigger cleanup of the old file.
  await page.goto('https://qa.test/merchant-profile.html',{waitUntil:'load'});
  await page.evaluate(()=>{
   merchant={placeIds:['place']};places=[{id:'place',desc:'Datos de prueba',gallery:[],customLogoUrl:'https://res.cloudinary.com/fixture/image/upload/v1/visitaloja/places/place/logo/old.webp',heroImage:'',subscription:{plan:'free'}}];
   document.getElementById('place').innerHTML='<option value="place">Parada de prueba</option>';loadPlace();show('form');fixture.mode='hold';
  });
  await page.locator('#logoFile').setInputFiles(photo);await page.locator('#save').click();
  await page.waitForFunction(()=>document.getElementById('message').textContent.includes('logo a Cloudinary'));
  assert(await page.locator('#place').isDisabled());
  await page.locator('#cancelImageUpload').click();
  await page.waitForFunction(()=>!document.getElementById('save').disabled);
  assert.equal(await page.evaluate(()=>fixture.writes.length),0);
  assert.match(await page.locator('#logoUrl').inputValue(),/old.webp$/);
  await page.locator('#logoFile').setInputFiles([]);
  await page.locator('#logoUrl').fill('https://res.cloudinary.com/fixture/image/upload/v1/visitaloja/places/place/logo/new.webp');
  await page.evaluate(()=>{fixture.mode='success';fixture.failSave=true;});
  const beforeDelete=requests.filter(x=>x.includes('/api/delete-merchant-image')).length;
  await page.locator('#save').click();
  await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Guardado rechazado de prueba'));
  assert.equal(requests.filter(x=>x.includes('/api/delete-merchant-image')).length,beforeDelete);
  assert.equal(await page.evaluate(()=>places[0].customLogoUrl.endsWith('/old.webp')),true);
  await page.evaluate(()=>fixture.failSave=false);
  const cleaned=page.waitForResponse('**/api/delete-merchant-image');
  await page.locator('#save').click();await cleaned;
  assert.equal(await page.evaluate(()=>fixture.writes.length),1);
  assert.equal(await page.evaluate(()=>places[0].customLogoUrl.endsWith('/new.webp')),true);
  if(width===390||width===1440)await page.screenshot({path:path.join(output,`merchant-${width}.png`),fullPage:true});
  assert.deepEqual(errors,[]);
  assert(requests.every(url=>!url.includes('firestore.googleapis')&&!url.includes('identitytoolkit')));
  report.push({width,checks:'historical photo, concurrent photo/audio cancellation, failed/corrupt image, bilingual playable audio, isolated save payload, event switch/sign error, homepage cancel/discard, merchant cancellation and cleanup only after successful save',pageErrors:errors.length,realWrites:0});
  console.log('PASS',width);
  await context.close();
 }
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 }catch(error){
  if(lastPage){console.log(await lastPage.evaluate(()=>[...document.querySelectorAll('[role="status"]')].map(x=>({id:x.id,text:x.textContent})).filter(x=>x.text)));await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true});}
  throw error;
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
