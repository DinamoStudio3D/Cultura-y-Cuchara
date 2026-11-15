const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.VIDEO_QA_OUTPUT||'/tmp/visitaloja-video-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VISITALOJA_QA_BROWSER||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const [width,height] of [[320,740],[390,844],[1440,900],[844,390]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('https://qa.test/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body><button id="open">Abrir</button></body></html>'}));
  await page.route('https://media.test/**',r=>r.fulfill({contentType:'video/mp4',body:fs.readFileSync(r.request().url().endsWith('portrait.mp4')?process.env.VIDEO_PORTRAIT_FIXTURE:path.join(root,'tests/fixtures/video-gallery-test.mp4'))}));
  await page.route('https://www.youtube-nocookie.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Official player frame fixture</body></html>'}));
  await page.goto('https://qa.test/');await page.addStyleTag({path:path.join(root,'css/place-video.css')});await page.addScriptTag({path:path.join(root,'js/place-video.js')});
  await page.evaluate(()=>{window.place={id:'qa',title:'Video de prueba',publicationStatus:'published',subscription:{plan:'premium',status:'active',benefits:{video:true}}};window.openVideo=url=>{place.youtubeUrl=url;VisitaLojaPlaceVideo.open(place,null,'es')};});
  for(const [name,ratio] of [['portrait',320/568],['horizontal',640/360]]){
   await page.evaluate(name=>openVideo('https://media.test/'+name+'.mp4'),name);
   await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);
   await page.waitForFunction(r=>Math.abs(Number(document.querySelector('dialog').style.getPropertyValue('--vl-video-ratio'))-r)<.001,ratio);
   await page.screenshot({path:path.join(out,`${width}-${height}-${name}.png`)});
   const frame=await page.locator('.vl-video-player').boundingBox(),dialog=await page.locator('dialog').boundingBox();
   assert(Math.abs(frame.width/frame.height-ratio)<.015,JSON.stringify({frame,ratio}));
   assert(dialog.width<=width&&dialog.height<=height&&dialog.y>=0,JSON.stringify(dialog));
   assert(frame.y+frame.height<=height,JSON.stringify(frame));
   assert.equal(await page.locator('video').evaluate(v=>v.controls&&!v.autoplay),true);
   await page.screenshot({path:path.join(out,`${width}-${height}-${name}.png`)});
   await page.getByRole('button',{name:'Cerrar vídeo'}).click();await page.locator('video').waitFor({state:'detached'});
  }
  await page.evaluate(()=>openVideo('https://youtube.com/shorts/M7lc1UVf-VE'));
  assert.equal(await page.locator('dialog').evaluate(e=>e.classList.contains('vl-video-portrait')),true);
  await page.getByRole('button',{name:'Ver horizontal'}).click();
  assert.equal(await page.locator('dialog').evaluate(e=>e.classList.contains('vl-video-portrait')),false);
  await page.getByRole('button',{name:'Ver vertical'}).click();
  const frame=await page.locator('iframe').boundingBox();assert(frame.height>frame.width);
  await page.keyboard.press('Escape');await page.locator('iframe').waitFor({state:'detached'});
  console.log(`PASS ${width}x${height}: decoded portrait/landscape frames, viewport bounds, controls, Shorts and manual format`);
  await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
