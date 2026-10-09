"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const guide=require("../api/canton-catamayo")._test;
test("Catamayo: asignación explícita",()=>{
 assert.equal(guide.inCatamayo({cantonId:"catamayo"}),true);
 assert.equal(guide.inCatamayo({cantonId:"loja"}),false);
 assert.equal(guide.inCatamayo({cantonId:"loja",city:"Catamayo"}),false);
 assert.equal(guide.inCatamayo({city:"Catamayo"}),true);
 assert.equal(guide.inCatamayo({cantonId:"",city:"Catamayo"}),true);
 assert.equal(guide.inCatamayo({address:"Catamayo"}),false);
});
test("Solo registros publicados",()=>{
 assert.equal(guide.published({publicationStatus:"published"}),true);
 assert.equal(guide.published({publicationStatus:"draft"}),false);
 assert.equal(guide.published({publicationStatus:"published",status:"inactive"}),false);
});
test("Render seguro y sin enlaces falsos de filtros",()=>{
 const empty=guide.render([]);
 assert.match(empty,/Próximamente, más lugares de Catamayo/);
 assert.doesNotMatch(empty,/aria-label="Categorías disponibles"/);
 const page=guide.render([{id:"prueba",title:"Lugar de prueba",category:"hotel",cantonId:"catamayo"}]);
 assert.match(page,/Lugar de prueba/);
 assert.match(page,/Alojamiento/);
 assert.doesNotMatch(page,/href="#lugares"/);
 const malicious=guide.render([{id:"test",title:"<script>alert(1)<\/script>",category:"hotel"}]);
 assert.doesNotMatch(malicious,/<h3><script>/);
});
