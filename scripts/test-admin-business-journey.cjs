const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/admin-business-journey.js'),'utf8');
function fixture(){
 const calls=[],nodes={};
 const node=id=>nodes[id]||=( {value:'',textContent:'',hidden:false,disabled:false,options:[],handlers:{},dataset:{},addEventListener(type,fn){this.handlers[type]=fn;},replaceChildren(...options){this.options=options;},add(option){this.options.push(option);},focus(){calls.push(['focus',id]);},scrollIntoView(){},click(){this.handlers.click?.();}} );
 const buttons=['edit','owner','benefits','publish','menu','claims'].map(action=>{const b=node(action);b.dataset.journeyAction=action;return b;});
 const window={confirm:()=>false};
 const context={window,document:{getElementById:node,querySelectorAll:()=>buttons},Option:function(text,value){this.text=text;this.value=value;},adminUnsavedChanges:false,setAdminUnsavedChanges:value=>{context.adminUnsavedChanges=value;},showAdminModule:name=>{calls.push(['module',name]);return context.allowNavigation;},editAdminPlace:id=>calls.push(['edit',id]),resetPlaceForm:()=>calls.push(['new']),openPlaceManagement:(...args)=>calls.push(args)};
 vm.createContext(context);vm.runInContext(source,context);return{api:window.VisitaLojaAdminBusinessJourney,nodes,calls,context,window};
}
test('owner and benefits actions retain the selected place instead of opening a general module',()=>{const f=fixture();f.api.update([{id:'a',title:'Café A'},{id:'b',title:'Hotel B'}]);f.api.select({id:'b',title:'Hotel B',publicationStatus:'draft'});f.nodes.owner.click();f.nodes.benefits.click();assert.deepEqual(f.calls,[['b','merchants'],['b','fidelity']]);assert.match(f.nodes.adminJourneySummary.textContent,/Hotel B · Borrador/);f.api.moduleChanged('merchants');assert.equal(f.nodes.adminSelectedPlaceNotice.hidden,false);assert.match(f.nodes.adminJourneyContextText.textContent,/Hotel B/);});
test('deleting the selected stop clears its context and disables actions',()=>{const f=fixture();f.api.select({id:'deleted',title:'Antes'});f.api.update([{id:'remaining',title:'Ahora'}]);assert.equal(f.nodes.owner.disabled,true);assert.equal(f.nodes.adminSelectedPlaceNotice.hidden,true);f.nodes.owner.click();assert.equal(f.calls.length,0);});
test('cancelled unsaved-change confirmation cannot reset or replace the current form',()=>{const f=fixture();f.api.select({id:'a',title:'Café'});f.context.adminUnsavedChanges=true;f.nodes.adminJourneyNew.click();f.nodes.edit.click();assert.equal(f.calls.length,0);assert.equal(f.context.adminUnsavedChanges,true);});
test('new place clears selection only after navigation succeeds',()=>{const f=fixture();f.api.select({id:'a',title:'Café'});f.context.allowNavigation=false;f.nodes.adminJourneyNew.click();assert.equal(f.nodes.owner.disabled,false);f.context.allowNavigation=true;f.nodes.adminJourneyNew.click();assert.equal(f.nodes.owner.disabled,true);assert.ok(f.calls.some(call=>call[0]==='new'));});
test('saved place title and publication status refresh without interpreting access as configured',()=>{const f=fixture();f.api.select({id:'a',title:'Antes'});f.api.update([{id:'a',title:'Después',publicationStatus:'hidden'}]);assert.match(f.nodes.adminJourneySummary.textContent,/Después · Oculta/);f.api.clear();assert.equal(f.nodes.adminJourneyPlace.value,'');assert.equal(f.nodes.publish.disabled,true);});

test('canjes opens the selected stop history and menu opens the existing QR selector',async()=>{
 const f=fixture();
 f.api.update([{id:'expreso',title:'Expreso al Sur'},{id:'other',title:'Otra parada'}]);
 f.nodes.adminJourneyPlace.value='expreso';
 f.nodes.adminJourneyPlace.handlers.change();
 f.nodes.claims.click();
 f.nodes.menu.click();
 await Promise.resolve();
 assert.deepEqual(f.calls,[['expreso','fidelity','activity'],['module','places'],['edit','expreso'],['focus','placeMenuQrId']]);
});

test('canjes uses the stop ID even when two businesses have the same name',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../gestion-fidelidad.html'),'utf8');
 const nodes={activityPlace:{value:'expreso'},activityType:{value:'loyalty'},activityStatus:{value:'all'},activitySearch:{value:''},activityFrom:{value:''},activityTo:{value:''}};
 const activities=[
  {type:'loyalty',placeId:'expreso',place:'Café',date:1,status:'delivered'},
  {type:'loyalty',placeId:'other',place:'Café',date:1,status:'delivered'},
  {type:'visit',placeId:'expreso',place:'Café',date:1,status:'confirmed'}
 ];
 const start=html.indexOf('function filteredActivities()'),end=html.indexOf('\nfunction renderActivity()',start);
 const context={el:id=>nodes[id],activities,ms:Number};
 vm.runInNewContext(html.slice(start,end),context);
 assert.equal(context.filteredActivities().length,1);
 assert.equal(context.filteredActivities()[0],activities[0]);
 nodes.activityPlace.value='all';
 assert.equal(context.filteredActivities().length,2);
});

test('task search opens rewards and claims for the exact selected place',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../admin.html'),'utf8');
 const calls=[];
 const context={
  adminPlaces:[{id:'expreso',title:'Expreso al Sur'},{id:'other',title:'Otro Café'}],
  normalizeUserSearch:text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),
  openPlaceManagement:(...args)=>{calls.push(args);return context.allow;},
  closeAdminGlobalSearch:()=>calls.push('close'),window:{scrollTo(){}}
 };
 const functions=['adminSearchMatches','adminPlaceTaskResults','openAdminGlobalSearchResult'];
 for(const name of functions){
  const start=html.indexOf('function '+name+'('),end=html.indexOf('\n}',start)+2;
  vm.runInNewContext(html.slice(start,end),context);
 }
 assert.equal(context.adminPlaceTaskResults('premio').length,0);
 assert.equal(context.adminPlaceTaskResults('expreso al sur').length,0);
 const results=context.adminPlaceTaskResults('premio de expreso al sur');
 assert.deepEqual(Array.from(results,item=>item.fidelityView),['programs','activity']);
 assert.ok(results.every(item=>item.placeId==='expreso'));
 assert.equal(context.adminPlaceTaskResults('ver canjes expreso')[0].fidelityView,'activity');
 context.adminGlobalSearchResults=results;
 context.openAdminGlobalSearchResult(1);
 assert.deepEqual(calls,[['expreso','fidelity','activity']]);
 context.allow=true;
 context.openAdminGlobalSearchResult(0);
 assert.deepEqual(calls.at(-2),['expreso','fidelity','programs']);
 assert.equal(calls.at(-1),'close');
});

test('sidebar search renders stop actions and keeps its own result indexes',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../admin.html'),'utf8');
 const calls=[],box={};
 const context={
  adminGlobalSearchItems:()=>[{type:'Módulo',label:'Premios Expreso',module:'fidelity'}],
  adminPlaceTaskResults:()=>[{type:'Tarea de la parada',label:'Ver canjes · Expreso al Sur',fidelityView:'activity',placeId:'expreso'}],
  adminSearchMatches:()=>true,ADMIN_MODULE_LABELS:{},escapeAdminHtml:String,
  adminGlobalSearchResults:[],openPlaceManagement:(...args)=>{calls.push(args);return true;},
  closeAdminGlobalSearch(){},window:{scrollTo(){}}
 };
 for(const name of ['findAdminSearchResults','renderAdminSearchButtons','renderAdminSidebarSearch','openAdminGlobalSearchResult']){
  const start=html.indexOf('function '+name+'('),end=html.indexOf('\n}',start)+2;
  vm.runInNewContext(html.slice(start,end),context);
 }
 assert.equal(context.renderAdminSidebarSearch('premio expreso',box),1);
 assert.equal(box.hidden,false);
 assert.match(box.innerHTML,/Ver canjes · Expreso al Sur/);
 assert.match(box.innerHTML,/openAdminGlobalSearchResult\(0,true\)/);
 context.openAdminGlobalSearchResult(0,true);
 assert.deepEqual(calls,[['expreso','fidelity','activity']]);
 assert.equal(context.renderAdminSidebarSearch('',box),0);
 assert.equal(box.hidden,true);
});
