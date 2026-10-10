/* Isolated actual welcome markup/styles; no Firebase, login or real mutations. */
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),output=process.env.VISITALOJA_QA_OUTPUT||'/tmp/visitaloja-v77-qa';
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const nav=html.match(/<nav data-vl-surface="dark" class="sticky[\s\S]*?<\/nav>/)[0];
const start=html.indexOf('<section id="inicio"'),end=html.indexOf('<!-- World Tourism Day',start);
const welcome=html.slice(start,end);
const cssFiles=['css/mobile-ui.css','css/public-layout.css','css/public-colors.css','css/welcome-v77.css'];
const css=fs.readFileSync('/tmp/visitaloja-tailwind.css','utf8')+cssFiles.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
const functions=html.slice(html.indexOf('        function searchFromWelcome(event)'),html.indexOf('        function clearSmartSearch()'));
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.VISITALOJA_QA_BROWSER||chromium.executablePath(),headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
 const report=[];
 try{
 for(const width of [320,390,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();let requests=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   requests++;
   if(route.request().url().includes('/fixture'))return route.fulfill({body:'<html><body></body></html>',contentType:'text/html'});
   return route.fulfill({body:fs.readFileSync(path.join(root,'assets/photos/loja-puerta.webp')),contentType:'image/webp'});
  });
  await page.goto('https://qa.test/fixture');
  await page.setContent('<html lang="es"><head><style>'+css+'</style></head><body>'+nav+'<main>'+welcome+'<section id="establecimientos"><input id="searchInput"></section></main></body></html>');
  // Remote photography is substituted with an existing repository photograph, only in QA.
  await page.addScriptTag({path:path.join(root,'js/homepage-content.js')});
  await page.addScriptTag({content:'window.searchCalls=0;function searchItems(){window.searchCalls++};'+functions});
  await page.waitForFunction(()=>[...document.querySelectorAll('#heroSlidesContainer img')].every(i=>i.complete));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const targets=await page.evaluate(()=>[...document.querySelectorAll('#inicio button,#inicio a,.vl-discovery-inner>a')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
  assert(targets.every(t=>t.height>=44),JSON.stringify(targets));
  const copy=await page.locator('.vl-welcome-copy').boundingBox(),visual=await page.locator('.vl-welcome-visual').boundingBox();
  if(width>760)assert(copy.x>=visual.x&&copy.x+copy.width<=visual.x+visual.width);
  else assert(copy.y+18>=visual.y+visual.height);
  await page.locator('#welcomeSearch').fill('  café lojano  ');
  await page.locator('.vl-welcome-primary').click();
  assert.equal(await page.locator('#searchInput').inputValue(),'café lojano');
  assert.equal(await page.evaluate(()=>searchCalls),1);
  await page.evaluate(()=>window.scrollTo(0,0));
  const defaults=await page.evaluate(()=>({title:document.getElementById('heroTitle').textContent,mobile:document.querySelector('.vl-mobile-intro h1').textContent}));
  await page.evaluate(()=>VisitaLojaHomepage.apply({title:'Descubre una Loja extraordinaria',subtitle:'Una búsqueda, muchas experiencias.',homepageContent:{blocks:{mobileWelcome:{title:'Una nueva aventura',description:'Descubre Loja a tu ritmo.'}}}}));
  assert.equal(await page.locator('#heroTitle').textContent(),'Descubre una Loja extraordinaria');
  assert.equal(await page.locator('.vl-mobile-intro h1').textContent(),'Una nueva aventura');
  await page.evaluate(defaults=>{document.getElementById('heroTitle').textContent=defaults.title;document.querySelector('.vl-mobile-intro h1').textContent=defaults.mobile;document.getElementById('heroSubtitle').textContent='Descubre las huecas tradicionales, cafeterías de especialidad, hoteles y rincones turísticos imperdibles a través de nuestra ruta interactiva.';document.querySelector('.vl-mobile-intro p').textContent='Sabores, cultura y nuevas historias por descubrir.';},defaults);
  if(width===390||width===1440){const bottom=await page.locator('.vl-discovery-nav').evaluate(e=>e.getBoundingClientRect().bottom+scrollY);await page.screenshot({path:path.join(output,`welcome-${width}.png`),clip:{x:0,y:0,width,height:Math.ceil(bottom)}});}
  // Long editable text must grow rather than hide the search or overflow horizontally.
  await page.evaluate(()=>VisitaLojaHomepage.apply({title:'Historias y experiencias para descubrir todos los rincones de la provincia de Loja',homepageContent:{blocks:{mobileWelcome:{title:'Descubre nuevas historias en cada rincón de Loja',description:'Una experiencia turística para compartir en familia, conocer nuestros sabores y recorrer la provincia a tu ritmo.'}}}}));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(await page.locator('#welcomeSearch').isVisible());
  if(width<=760){const intro=await page.locator('.vl-mobile-intro').boundingBox(),img=await page.locator('.vl-welcome-visual').boundingBox();assert(intro.y>=img.y+90&&intro.y+intro.height<=img.y+img.height+1,JSON.stringify({intro,img}));}
  assert.deepEqual(errors,[]);
  report.push({width,pageErrors:0,realWrites:0,checks:'no overflow, 44px targets, layout, actual search handler, editable text, long text'});console.log('PASS',width);
  await context.close();
 }
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
