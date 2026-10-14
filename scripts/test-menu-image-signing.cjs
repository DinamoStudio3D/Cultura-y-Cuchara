const assert = require('node:assert/strict');
const { createHandler } = require('../api/sign-event-image');

const env = {
  CLOUDINARY_CLOUD_NAME: 'demo-cloud',
  CLOUDINARY_API_KEY: '12345',
  CLOUDINARY_API_SECRET: 'test-secret',
  CLOUDINARY_UPLOAD_PRESET: 'signed-menu'
};
async function call({method='POST',token='valid',fetchImpl,environment=env}={}) {
  let statusCode=200,body;
  const res={
    setHeader(){},
    status(code){statusCode=code;return this;},
    json(value){body=value;return this;}
  };
  await createHandler({folder:'visitaloja/menus',mediaLabel:'menús digitales',
    env:environment,now:()=>1700000000000,fetchImpl:fetchImpl|| (async()=>({ok:false}))})(
    {method,headers:{authorization:token?'Bearer '+token:''}},res);
  return {statusCode,body};
}
(async()=>{
  assert.equal((await call({method:'GET'})).statusCode,405);
  assert.equal((await call({token:''})).statusCode,401);
  assert.equal((await call({environment:{}})).statusCode,503);
  const unauthorized=await call({fetchImpl:async()=>({ok:true,json:async()=>({users:[{localId:'visitor',email:'visitor@example.com'}]})})});
  assert.equal(unauthorized.statusCode,403);
  const approved=await call({fetchImpl:async()=>({ok:true,json:async()=>({users:[{localId:'admin',customAttributes:JSON.stringify({admin:true})}]})})});
  assert.equal(approved.statusCode,200);
  assert.equal(approved.body.params.folder,'visitaloja/menus');
  assert.equal(approved.body.params.upload_preset,'signed-menu');
  assert.match(approved.body.signature,/^[a-f0-9]{40}$/);
  assert.equal('apiSecret' in approved.body,false);
  console.log('Cloudinary signing: 5 scenarios passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
