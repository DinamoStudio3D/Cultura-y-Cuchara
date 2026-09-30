'use strict';
const assert = require('node:assert/strict');
const { configuration } = require('./_firebase-environment');
const { serviceAccountFromEnv } = require('./_firebase-admin');
const { resolve } = require('../js/firebase-runtime');
const { createHandler } = require('./firebase-web-config');
const config = { projectId:'visitaloja-chabaquito-preview',authDomain:'visitaloja-chabaquito-preview.firebaseapp.com',apiKey:'public-test-key',appId:'test-app',messagingSenderId:'123' };
const env = { VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/chabaquito-v1',VISITALOJA_FIREBASE_PROJECT_ID:config.projectId,VISITALOJA_FIREBASE_WEB_CONFIG:JSON.stringify(config) };
const prod = { projectId:'cultura-y-cuchara' };
assert.equal(resolve(prod,configuration(env)).projectId,config.projectId);
assert.equal(resolve(prod,configuration({VERCEL_ENV:'production'})),prod);
for(const patch of [{VISITALOJA_FIREBASE_PROJECT_ID:'cultura-y-cuchara'},{VISITALOJA_FIREBASE_WEB_CONFIG:''},{VERCEL_GIT_COMMIT_REF:'main'},{VISITALOJA_FIREBASE_WEB_CONFIG:JSON.stringify({...config,private_key:'secret'})},{VISITALOJA_FIREBASE_WEB_CONFIG:JSON.stringify({...config,projectId:'cultura-y-cuchara'})}]) assert.throws(()=>configuration({...env,...patch}));
assert.throws(()=>resolve(prod,undefined));
assert.throws(()=>serviceAccountFromEnv({...env,FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'cultura-y-cuchara',client_email:'fake',private_key:'fake'})}),/equivocado/);
assert.equal(serviceAccountFromEnv({...env,FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:config.projectId,client_email:'fake',private_key:'fake'})}).project_id,config.projectId);
function request(environment) { let code,body;createHandler(environment)({method:'GET'},{setHeader(){},status(c){code=c;return this;},send(v){body=v;return this;}});return{code,body}; }
assert.equal(request({}).code,503);
assert.equal(request(env).code,200);
assert.equal(request({...env,VERCEL_GIT_COMMIT_REF:'feature/visitaloja-integrada-preview'}).code,200);
assert.equal(request({...env,VERCEL_GIT_COMMIT_REF:'feature/visitaloja-integrada-preview',VISITALOJA_FIREBASE_PROJECT_ID:'cultura-y-cuchara'}).code,503);
assert.ok(!request(env).body.includes('private_key'));
const fs=require('node:fs'),path=require('node:path');
function inspect(directory) { for(const entry of fs.readdirSync(directory,{withFileTypes:true})) { if(entry.isDirectory() && !['node_modules','.git'].includes(entry.name))inspect(path.join(directory,entry.name));else if(entry.isFile() && entry.name.endsWith('.html')) { const html=fs.readFileSync(path.join(directory,entry.name),'utf8');if(html.includes('firebase.initializeApp(firebaseConfig')) { assert.ok(html.includes('/api/firebase-web-config'));assert.ok(html.includes('window.VisitaLojaFirebaseRuntime.resolve('));assert.ok(html.indexOf('/api/firebase-web-config')<html.indexOf('firebase.initializeApp(firebaseConfig')); } } } }
inspect('.');
console.log('Firebase isolation: SDK pages, missing configuration, wrong project/branch and admin credentials blocked; production config preserved.');
(async () => {
  const { createHandler: objective } = require('./chabaquito-v1-objective');
  let requested = '';
  const handler = objective({ env:{...env,CHABAQUITO_V1_ENABLED:'true'}, fetchImpl:async url=>{requested=url;return{ok:false};}, dbFactory:()=>{throw new Error('No database access');} });
  let status;
  await handler({method:'GET',headers:{authorization:'Bearer fake'}},{setHeader(){},status(c){status=c;return this;},json(){}});
  assert.equal(status,401);
  assert.ok(requested.endsWith('key=public-test-key'));
  const blocked = require('./sign-merchant-image').createHandler({env,fetchImpl:()=>{throw new Error('Cloudinary/production must not be contacted');}});
  await blocked({method:'POST',headers:{}},{setHeader(){},status(c){status=c;return this;},json(){}});
  assert.equal(status,503);
  console.log('API Preview uses isolated Auth key; unrelated upload API blocked before network.');
})().catch(error=>{console.error(error);process.exitCode=1;});
