const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {document:{getElementById:()=>null},window:{},URL};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'partner-marquee.js'),'utf8'),context);
const {normalize,httpsUrl}=context.window.VisitaLojaPartnerMarquee;

assert.equal(httpsUrl('javascript:alert(1)'), '');
assert.equal(httpsUrl('http://example.org/logo.png'), '');
assert.equal(httpsUrl('https://user:pass@example.org/logo.png'), '');
assert.equal(httpsUrl('https://example.org/logo.png'), 'https://example.org/logo.png');
const data=normalize({enabled:true,logoSize:999,speed:-4,direction:'right',brands:[
    {name:'Marca local',imageUrl:'https://example.org/logo.png',linkUrl:'javascript:alert(1)'},
    {name:'Sin logo',imageUrl:'http://example.org/inseguro.png'}
]});
assert.equal(data.enabled,true);
assert.equal(data.source,'manual');
assert.equal(data.logoSize,140);
assert.equal(data.speed,15);
assert.equal(data.direction,'right');
assert.equal(data.brands.length,1);
assert.equal(data.brands[0].linkUrl,'');
assert.equal(normalize(null).enabled,false);
assert.equal(normalize({source:'auto',brands:[{name:'Marca',imageUrl:'https://example.org/a.png'}]}).source,'auto');
console.log('partner marquee normalization: OK');
