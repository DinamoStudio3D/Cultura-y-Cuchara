"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createHandler, publicIdFromCloudinaryUrl } = require("./delete-merchant-image.js");

function response() {
  return { statusCode: 200, body: null, headers: {}, setHeader(k,v){this.headers[k]=v;}, status(n){this.statusCode=n;return this;}, json(v){this.body=v;return this;} };
}

function request(body, token="token") {
  return { method:"POST", headers:{authorization:`Bearer ${token}`}, body };
}

const env={CLOUDINARY_CLOUD_NAME:"demo",CLOUDINARY_API_KEY:"key",CLOUDINARY_API_SECRET:"secret"};
const image="https://res.cloudinary.com/demo/image/upload/v123/visitaloja/places/place-1/gallery/photo.webp";

assert.equal(publicIdFromCloudinaryUrl(image,"demo"),"visitaloja/places/place-1/gallery/photo");
assert.equal(publicIdFromCloudinaryUrl("https://i.imgur.com/photo.jpg","demo"),null);

(async()=>{
  let destroyBody="";
  const fetchImpl=async(url,options={})=>{
    if(url.includes("accounts:lookup")) return {ok:true,json:async()=>({users:[{localId:"user-1",disabled:false}]})};
    if(url.includes("firestore.googleapis.com")) return {ok:true,json:async()=>({fields:{active:{booleanValue:true},placeIds:{arrayValue:{values:[{stringValue:"place-1"}]}}}})};
    if(url.includes("cloudinary.com")){destroyBody=options.body;return {ok:true,json:async()=>({result:"ok"})};}
    throw new Error("unexpected fetch "+url);
  };
  const handler=createHandler({fetchImpl,env,now:()=>1700000000000});
  const res=response();
  await handler(request({placeId:"place-1",purpose:"gallery",url:image}),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.deleted,true);
  const params=new URLSearchParams(destroyBody);
  assert.equal(params.get("public_id"),"visitaloja/places/place-1/gallery/photo");
  assert.equal(params.get("invalidate"),"true");
  const expected=crypto.createHash("sha1").update("invalidate=true&public_id=visitaloja/places/place-1/gallery/photo&timestamp=1700000000secret").digest("hex");
  assert.equal(params.get("signature"),expected);

  let destroyCalled=false;
  const unauthorized=createHandler({env,fetchImpl:async(url)=>{
    if(url.includes("accounts:lookup")) return {ok:true,json:async()=>({users:[{localId:"user-1"}]})};
    if(url.includes("firestore.googleapis.com")) return {ok:true,json:async()=>({fields:{active:{booleanValue:true},placeIds:{arrayValue:{values:[{stringValue:"other-place"}]}}}})};
    destroyCalled=true; return {ok:true,json:async()=>({result:"ok"})};
  }});
  const denied=response();
  await unauthorized(request({placeId:"place-1",purpose:"gallery",url:image}),denied);
  assert.equal(denied.statusCode,403);
  assert.equal(destroyCalled,false);

  let legacyDestroy=false;
  const legacy=createHandler({env,fetchImpl:async(url)=>{
    if(url.includes("accounts:lookup")) return {ok:true,json:async()=>({users:[{localId:"user-1"}]})};
    if(url.includes("firestore.googleapis.com")) return {ok:true,json:async()=>({fields:{active:{booleanValue:true},placeIds:{arrayValue:{values:[{stringValue:"place-1"}]}}}})};
    legacyDestroy=true; return {ok:true,json:async()=>({result:"ok"})};
  }});
  const legacyRes=response();
  await legacy(request({placeId:"place-1",purpose:"gallery",url:"https://i.imgur.com/legacy.jpg"}),legacyRes);
  assert.equal(legacyRes.statusCode,200);
  assert.equal(legacyRes.body.skipped,true);
  assert.equal(legacyDestroy,false);

  console.log("delete-merchant-image tests: OK");
})().catch(error=>{console.error(error);process.exit(1);});

