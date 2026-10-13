/* Actual category and place renderer, isolated data and map/action dependencies. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.VISITALOJA_QA_OUTPUT||'/tmp/visitaloja-v78-cards';
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const categories=source.slice(source.indexOf('        function renderCategoriesUI()'),source.indexOf('        function renderTrendingUI()'));
const places=source.slice(source.indexOf('        function renderMapAndGrid()'),source.indexOf('        function openQrClaimModal(e,'));
const categoryOpen=source.match(/        function openCategoryList\(category\).*\n/)[0];
const css=fs.readFileSync('/tmp/visitaloja-tailwind.css','utf8')+['css/mobile-ui.css','css/public-layout.css','css/public-colors.css','css/discovery-cards.css'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.VISITALOJA_QA_BROWSER||chromium.executablePath(),headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});const report=[];
 try{for(const width of [320,390,768,1440]){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.fulfill({body:route.request().url().endsWith('/fixture')?'<html></html>':fs.readFileSync(path.join(root,'assets/photos/loja-puerta.webp')),contentType:route.request().url().endsWith('/fixture')?'text/html':'image/webp'}));
 await page.goto('https://qa.test/fixture');
 await page.setContent('<html lang="es"><head><style>'+css+'</style></head><body><section id="categorias"><div class="max-w-7xl mx-auto"><h2>Explora a tu manera</h2><div id="exploreCategoryGrid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"></div></div></section><section id="establecimientos"><div class="max-w-7xl mx-auto"><h2>Paradas de Visita Loja</h2><div id="localesGrid"></div></div></section><section id="agenda"></section></body></html>');
 await page.addScriptTag({path:path.join(root,'js/welcome-settings.js')});await page.addScriptTag({path:path.join(root,'js/homepage-content.js')});
 await page.addScriptTag({content:`
 var currentLang='es',userCoords=null,userMarkerInstance=null,activeMapGroup='all',markersMap={},favoriteLocations=[],calls=[];
 var markersLayer={clearLayers(){}};
 var categories=[{id:'cafe',name:'Cafeterías',icon:'☕'},{id:'hotel',name:'Hoteles',icon:'🏨'},{id:'aliado',name:'Marcas aliadas',icon:'🤝'}];
 var locations=categories.map((c,i)=>({id:'fixture-'+i,category:c.id,title:['Café entre historias','Descansa en el corazón de Loja','Marca aliada'][i],tag:c.name,desc:'Sabores, lugares y experiencias para descubrir Loja a tu ritmo.',hours:'Lun – Dom: 08:00 – 20:00',gallery:[{img:'assets/photos/loja-puerta.webp'}],gps:'https://www.google.com/maps/search/?api=1&query=Loja'}));
 function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function paidPlaceBenefits(){return{}};function isLocOpenNow(){return true};function mapMarkerPalette(){return{color:'#075bb2'}};
 function renderAdminLocationsList(){};function updatePassportUI(){};
 function simulateMapClick(i){calls.push(['details',i])};function filterItems(id){calls.push(['category',id])};
 function toggleFavoriteCard(e,id){e.stopPropagation();calls.push(['favorite',id])};function openQrClaimModal(e,id){e.stopPropagation();calls.push(['qr',id])};
 function trackBusinessEvent(){};
 ${categoryOpen}${categories}${places}
 renderCategoriesUI();renderMapAndGrid();`});
 await page.evaluate(()=>VisitaLojaHomepage.apply({homepageContent:{blocks:{categoryCard_cafe:{title:'Pausa lojana',icon:'🌿',titleEn:'Loja break',iconEn:'🌿'}}}}));
 assert.equal(await page.locator('#exploreCategoryGrid [data-category="cafe"] strong').textContent(),'Pausa lojana');
 assert.equal(await page.locator('#exploreCategoryGrid [data-category="cafe"] > span').first().textContent(),'🌿');
 await page.evaluate(()=>renderCategoriesUI());
 assert.equal(await page.locator('#exploreCategoryGrid [data-category="cafe"] strong').textContent(),'Pausa lojana');
 await page.evaluate(()=>{currentLang='en';document.documentElement.lang='en';VisitaLojaHomepage.apply();});
 assert.equal(await page.locator('#exploreCategoryGrid [data-category="cafe"] strong').textContent(),'Loja break');
 await page.evaluate(()=>{currentLang='es';document.documentElement.lang='es';VisitaLojaHomepage.apply({});renderCategoriesUI();});
 assert.equal(await page.locator('#localesGrid > .local-item').count(),3);
 assert.equal(await page.locator('#localesGrid > .local-item').first().evaluate(e=>getComputedStyle(e).display),'flex');
 assert.equal(await page.locator('#localesGrid > .local-item').first().evaluate(e=>getComputedStyle(e).flexDirection),'column');
 await page.locator('#localesGrid > .local-item').first().evaluate(e=>e.classList.add('hidden-item'));
 assert.equal(await page.locator('#localesGrid > .local-item').first().isVisible(),false);
 await page.locator('#localesGrid > .local-item').first().evaluate(e=>e.classList.remove('hidden-item'));
 await page.locator('#exploreCategoryGrid [data-category="cafe"]').click();assert.deepEqual(await page.evaluate(()=>calls.at(-1)),['category','cafe']);
 await page.locator('#localesGrid > .local-item').first().press('Enter');assert.deepEqual(await page.evaluate(()=>calls.at(-1)),['details',0]);
 await page.locator('#localesGrid > .local-item').first().locator('.vl18-favorite').click();assert.deepEqual(await page.evaluate(()=>calls.at(-1)),['favorite','fixture-0']);
 await page.locator('#localesGrid > .local-item').first().locator('.vl18-quicklinks button').click();assert.deepEqual(await page.evaluate(()=>calls.at(-1)),['qr','fixture-0']);
 assert.equal(await page.locator('#localesGrid > .local-item').last().locator('.vl18-quicklinks button').count(),0);
 await page.evaluate(()=>VisitaLojaHomepage.apply({cardImageFit:'contain',cardStyle:'bordered',cornerStyle:'extra',homepageContent:{blocks:{placesCardText:{title:'VIVE LOJA',button:'Conocer este lugar'}}}}));
 assert.deepEqual((await page.locator('#localesGrid .vl-card-kicker').allTextContents()).map(s=>s.trim()),['VIVE LOJA','VIVE LOJA','VIVE LOJA']);
 assert.equal(await page.locator('#localesGrid .vl17-media > img').first().evaluate(e=>getComputedStyle(e).objectFit),'contain');
 assert.equal(await page.locator('#localesGrid > .local-item').first().evaluate(e=>getComputedStyle(e).boxShadow),'none');
 await page.evaluate(()=>{renderMapAndGrid();});assert.equal((await page.locator('#localesGrid .vl-card-kicker').first().textContent()).trim(),'VIVE LOJA');
 await page.evaluate(()=>VisitaLojaHomepage.apply({cardImageFit:'cover',cardStyle:'elevated'}));
 assert.equal(await page.locator('#localesGrid .vl17-media > img').first().evaluate(e=>getComputedStyle(e).objectFit),'cover');
 assert.equal(await page.locator('#localesGrid .vl17-partner-media > img').evaluate(e=>getComputedStyle(e).objectFit),'contain');
 const contrasts=await page.locator('#localesGrid .vl17-media > .absolute.top-3 > span').evaluateAll(els=>els.map(e=>{
 const lum=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(x=>Number(x)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
 const s=getComputedStyle(e),a=lum(s.color),b=lum(s.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 }));assert(contrasts.every(r=>r>=4.5),JSON.stringify(contrasts));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const buttons=await page.locator('#localesGrid .vl18-quicklinks button,#localesGrid .vl18-favorite,#exploreCategoryGrid button').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().height));assert(buttons.every(h=>h>=44),JSON.stringify(buttons));
 await page.evaluate(()=>scrollTo(0,0));if(width===390||width===1440)await page.screenshot({path:path.join(out,`cards-${width}.png`),fullPage:true});
 assert.deepEqual(errors,[]);report.push({width,pageErrors:0,realWrites:0,checks:'actual renderers, category/detail/favorite/QR delegation, image fit, partner logo, card styles, editable labels after rerender, no overflow'});console.log('PASS',width);await context.close();
 }fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
