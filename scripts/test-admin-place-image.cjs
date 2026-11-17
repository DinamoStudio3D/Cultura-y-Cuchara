const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {createHandler} = require('../functions/admin-place-image');
const env = {CLOUDINARY_CLOUD_NAME:'demo',CLOUDINARY_API_KEY:'123',CLOUDINARY_API_SECRET:'secret',CLOUDINARY_UPLOAD_PRESET:'signed'};
async function call({body={placeId:'new-draft',purpose:'gallery'},method='POST',token='valid',user={localId:'admin',customAttributes:'{"admin":true}'},profile=null}={}) {
 let status=200,result,reads=0;
 const res={setHeader(){},status(n){status=n;return this},json(x){result=x;return this}};
 await createHandler({env,now:()=>1700000000000,fetchImpl:async url=>{
  reads++;
  if(url.includes('accounts:lookup')) return {ok:true,json:async()=>({users:user?[user]:[]})};
  return {ok:!!profile,json:async()=>({fields:profile})};
 }})({method,headers:{authorization:token?'Bearer '+token:''},body},res);
 return {status,result,reads};
}
test('rejects invalid targets and unauthenticated requests before signing',async()=>{
 for(const body of [{placeId:'../other',purpose:'gallery'},{placeId:'cafe',purpose:'video'},{placeId:{},purpose:'logo'}]) assert.equal((await call({body})).status,400);
 assert.equal((await call({method:'GET'})).status,405);
 assert.equal((await call({token:''})).status,401);
 assert.equal((await call({user:null})).status,401);
 assert.equal((await call({user:{localId:'disabled',disabled:true,customAttributes:'{"admin":true}'}})).status,401);
});
test('owners and staff cannot use general administration signing',async()=>{
 for(const role of ['owner','staff']) assert.equal((await call({user:{localId:role,customAttributes:JSON.stringify({role})},profile:{active:{booleanValue:true},role:{stringValue:role}}})).status,403);
});
test('administrator signature fixes the requested place and image purpose',async()=>{
 for(const purpose of ['logo','hero','gallery']) {
  const {status,result}=await call({body:{placeId:'new-draft',purpose,folder:'evil',public_id:'evil'}});
  assert.equal(status,200);assert.equal(result.params.folder,'visitaloja/places/new-draft/'+purpose);
  assert.equal('apiSecret' in result,false);
  const expected=crypto.createHash('sha1').update(Object.keys(result.params).sort().map(k=>k+'='+result.params[k]).join('&')+'secret').digest('hex');
  assert.equal(result.signature,expected);
 }
});
test('active admin profile is accepted and inactive admin profile is denied',async()=>{
 const user={localId:'profile-admin'};
 for(const active of [true,false]) assert.equal((await call({user,profile:{active:{booleanValue:active},role:{stringValue:'admin'}}})).status,active?200:403);
});
