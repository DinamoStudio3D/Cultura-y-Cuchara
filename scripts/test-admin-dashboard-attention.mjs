import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8'),nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};const context={document:{getElementById:node},window:{VisitaLojaAdminPlaceDirectory:{status:place=>place.publicationStatus||'published'}}};vm.runInNewContext(html.slice(html.indexOf('function renderDashboardAttention'),html.indexOf('async function loadDashboardSummary')),context);
test('dashboard uses separate application status and preserves unknown data',()=>{const backup={data:{businessApplications:{a:{status:'pending'},b:{}},businessApplicationStatus:{a:{status:'approved'}},locales:{p:{publicationStatus:'draft'}},passportCompletions:{c:{status:'delivered'},d:{status:'pending',campaignId:'pasaporte-2026'},old:{status:'pending',campaignId:'otra'},cancelled:{status:'cancelled',campaignId:'pasaporte-2026'}}},omittedCollections:[]};context.renderDashboardAttention(backup);assert.equal((node('dashboardAttentionCards').innerHTML.match(/<strong>1<\/strong>/g)||[]).length,3);backup.omittedCollections=['locales'];context.renderDashboardAvailability(backup);assert.equal(node('dashboardPlaces').textContent,'—');assert.equal(node('dashboardHealthStatus').textContent,'Consulta incompleta');assert.match(node('dashboardAttentionCards').innerHTML,/Datos no disponibles/);});

test('opening a task applies its filter after navigation succeeds',()=>{
 const calls=[];
 for(const id of ['applicationsStatusFilter','subscriptionCenterFilter','placesPublicationFilter']){
  node(id).scrollIntoView=()=>{};
  node(id).focus=()=>{};
 }
 context.renderBusinessApplications=()=>calls.push('applications');
 context.renderSubscriptionCenter=()=>calls.push('subscriptions');
 context.renderAdminPlaces=()=>calls.push('places');
 context.showAdminModule=()=>false;
 node('applicationsStatusFilter').value='all';
 context.openDashboardAttention('applications');
 assert.equal(node('applicationsStatusFilter').value,'all');
 context.showAdminModule=()=>true;
 context.openDashboardAttention('applications');
 context.openDashboardAttention('expiring');
 context.openDashboardAttention('places');
 assert.deepEqual(calls,['applications','subscriptions','places']);
 assert.equal(node('applicationsStatusFilter').value,'open');
 assert.equal(node('subscriptionCenterFilter').value,'expiring');
 assert.equal(node('placesPublicationFilter').value,'unpublished');
});
