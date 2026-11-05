'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {execute,COLLECTION}=require('../functions/rewards-draft-store');
const api=require('../functions/rewards-drafts-api');
const env={VERCEL_ENV:'preview',REWARDS_DRAFT_WRITES:'approved-preview-v1'};
const reward={title:'Café gratis',description:'Una bebida',targetVisits:10,validityDays:30,stock:5,rewardType:'product'};

function fixture(){
  const records=new Map(Object.entries({
    'adminUsers/admin':{active:true,role:'admin'},
    'businessAccess/owner_cafe':{active:true,uid:'owner',placeId:'cafe',role:'owner'},
    'businessAccess/staff_cafe':{active:true,uid:'staff',placeId:'cafe',role:'staff'}
  }));
  const snap=path=>({exists:records.has(path),id:path.split('/').pop(),data:()=>records.get(path)});
  const collection=path=>({
    doc:key=>({path:path+'/'+key,get:async()=>snap(path+'/'+key),collection:key2=>collection(path+'/'+key+'/'+key2)}),
    where:(key,_,value)=>({limit:limit=>({get:async()=>({docs:[...records.keys()].filter(id=>id.startsWith(path+'/')&&id.split('/').length===2&&records.get(id)[key]===value).slice(0,limit).map(snap)})})})
  });
  const db={collection,runTransaction:async work=>{
    const writes=[];
    const result=await work({get:ref=>ref.get(),set:(ref,data)=>writes.push([ref.path,data])});
    for(const entry of writes)records.set(...entry);
    return result;
  }};
  return {records,run:(uid,action,extra={},override={})=>execute({db,user:{uid},input:{placeId:'cafe',action,...extra},now:new Date(),env,...override})};
}

test('API desactivada por defecto antes de cargar Firebase',async()=>{
  const response={setHeader(){},status(status){this.statusCode=status;return this},json(payload){this.payload=payload;return this}};
  await api({method:'POST',body:{action:'save'}},response);
  assert.equal(response.statusCode,503);
  assert.equal(response.payload.code,'REWARDS_DISABLED');
});

test('bloquea escrituras en producción, encargados y acceso a otros negocios',async()=>{
  const {run,records}=fixture();
  await assert.rejects(run('owner','save',{revision:0,draft:reward},{env:{...env,VERCEL_ENV:'production'}}),{status:503});
  await assert.rejects(run('staff','save',{revision:0,draft:reward}),{status:403});
  await assert.rejects(run('owner','save',{placeId:'otra',revision:0,draft:reward}),{status:403});
  await assert.rejects(run('owner','load',{authorUid:'other'}),{status:403});
  await assert.rejects(run('owner','queue'),{status:403});
  assert.equal(records.size,3);
});

test('conserva versiones y evita sobrescrituras o dobles aprobaciones',async()=>{
  const {run,records}=fixture();
  const saved=await run('owner','save',{revision:0,draft:{...reward,status:'published'}});
  assert.equal(saved.draft.status,'draft');
  await assert.rejects(run('owner','save',{revision:0,draft:reward}),{status:409});
  await run('owner','submit',{revision:1});
  await assert.rejects(run('owner','approve',{revision:2}),{status:403});
  await assert.rejects(run('owner','save',{revision:2,draft:reward}),{status:409});
  const {drafts}=await run('admin','queue');
  assert.equal(drafts.length,1);
  const subject={authorUid:'owner',revision:2};
  await assert.rejects(run('admin','reject',subject),{status:400});
  await run('admin','reject',{...subject,note:'Aclara las condiciones.'});
  const {draft}=await run('owner','load');
  assert.equal(draft.reviewNote,'Aclara las condiciones.');
  await run('owner','save',{revision:3,draft:reward});
  await run('owner','submit',{revision:4});
  const approved=await run('admin','approve',{...subject,revision:5});
  assert.equal(approved.draft.status,'approved');
  await assert.rejects(run('admin','approve',{...subject,revision:5}),{status:409});
  assert.equal([...records.keys()].filter(key=>key.startsWith(COLLECTION+'/')&&key.includes('/history/')).length,6);
  assert.equal((await run('admin','queue')).drafts.length,0);
});
