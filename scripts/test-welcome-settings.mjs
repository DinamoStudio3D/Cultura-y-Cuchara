import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../js/welcome-settings.js';
import '../js/homepage-content.js';
const model=globalThis.VisitaLojaWelcomeSettings;
test('existing presentation values are normalized without accepting CSS injection',()=>{
 const base=model.normalize();assert.equal(base.brightness,1);assert.equal(base.style,'cinematic');
 const malformed=model.normalize({heroStyle:'anything',heroHeight:'injected',heroMobilePosition:'url(evil)',heroBgPosition:'url(evil)',cardImageFit:'url(evil)',heroImageOpacity:900});
 assert.equal(malformed.style,'cinematic');assert.equal(malformed.height,'immersive');assert.equal(malformed.mobilePosition,'50% 50%');assert.equal(malformed.cardImageFit,'cover');assert.equal(malformed.visibility,85);
 assert.equal(model.normalize({heroBgPosition:'25% 75%',heroMobilePosition:'same'}).mobilePosition,'25% 75%');
 assert.equal(model.normalize({heroMobilePosition:'80% 50%'}).mobilePosition,'80% 50%');
});
test('new editable fields preserve defaults and visibility choices without deleting data',()=>{
 const home=globalThis.VisitaLojaHomepage;
 const original=home.normalize();assert.equal(original.blocks.welcomeSearch.placeholder,'Café, hotel, comida lojana…');
 const edited=home.normalize({blocks:{welcomePlaces:{enabled:false},welcomePhoto:{enabled:false},welcomeSearch:{title:'Busca una experiencia',placeholder:'Hoteles'}}});
 assert.equal(edited.blocks.welcomePlaces.enabled,false);assert.equal(edited.blocks.welcomePhoto.enabled,false);assert.equal(edited.blocks.welcomeSearch.placeholder,'Hoteles');assert.equal(edited.blocks.explore.title,original.blocks.explore.title);
});
