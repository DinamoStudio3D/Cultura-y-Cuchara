const test=require('node:test'),assert=require('node:assert/strict');
const {available,path,attach}=require('../js/place-digital-menu.js');
const menu={menuImageUrl:'https://i.imgur.com/jTQZHUy.jpeg',targetUrl:'https://www.visitaloja.com/menu-digital.html?id=menu-sport-burger'};
test('only a published QR with the same menu identifier can be linked',()=>{
 assert.equal(available('menu-sport-burger',menu),true);
 assert.equal(available('menu-sport-burger',{...menu,targetUrl:'https://visitaloja-5dnry0emh-dinamostudio3d.vercel.app/menu-digital.html?id=menu-sport-burger'}),true);
 for(const patch of [{active:false},{menuImageUrl:''},{menuImageUrl:'javascript:alert(1)'},{menuImageUrl:'https://evil.test/a.jpg'},{visit:{placeId:'visit-only'}},{targetUrl:'https://evil.test/menu-digital.html?id=menu-sport-burger'},{targetUrl:'/menu-digital.html?id=another-menu'}])assert.equal(available('menu-sport-burger',{...menu,...patch}),false);
 assert.equal(path('../anything'),'');assert.equal(path('menu-sport-burger'),'/menu-digital.html?id=menu-sport-burger');
});
test('unlinked, unavailable or disconnected businesses never advertise an empty menu',async()=>{
 const button={hidden:false,setAttribute(){}};let reads=0;const db={collection(){return{doc(){return{async get(){reads++;return{exists:false};}};}};}};
 assert.equal(await attach(button,{},db),false);assert.equal(reads,0);assert.equal(button.hidden,true);
 assert.equal(await attach(button,{menuQrId:'missing'},db),false);assert.equal(button.hidden,true);
 assert.equal(await attach(button,{menuQrId:'menu-sport-burger'},{collection(){throw Error('offline');}}),false);assert.equal(button.hidden,true);
});
test('late responses cannot attach the previous business menu to a newly selected business',async()=>{
 let finish;const button={hidden:false,setAttribute(){}},db={collection(){return{doc(){return{get:()=>new Promise(resolve=>{finish=resolve;})};}};}};
 const pending=attach(button,{title:'Previous',menuQrId:'menu-sport-burger'},db);await attach(button,{title:'No menu'},db);finish({exists:true,data:()=>menu});assert.equal(await pending,false);assert.equal(button.hidden,true);assert.equal(button.onclick,null);
});
test('linked businesses use the published QR document and offer a dialog',async()=>{
 const attrs={},button={setAttribute(k,v){attrs[k]=v;}},db={collection(name){assert.equal(name,'qrCodes');return{doc(id){assert.equal(id,'menu-sport-burger');return{async get(options){assert.equal(options.source,'server');return{exists:true,data:()=>menu};}};}};}};
 assert.equal(await attach(button,{title:'Sport Burger',menuQrId:'menu-sport-burger'},db),true);assert.equal(button.hidden,false);assert.equal(button.textContent,'Ver menú');assert.equal(attrs['aria-haspopup'],'dialog');
});
