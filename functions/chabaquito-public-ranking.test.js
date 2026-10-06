"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {publicRankingProjection,rankingDocumentId,rankingPreferencePatch}=require("./chabaquito-public-ranking");

test("ranking es opt-in y no publica nada por defecto",()=>assert.equal(publicRankingProjection({validatedXp:100}),null));
test("proyección pública contiene solo campos permitidos",()=>{
  const entry=publicRankingProjection({participateInRanking:true,publicAlias:"Juan",validatedXp:500,publicAvatar:null,publicBadgeIds:["uno"],email:"privado@example.com",whatsapp:"0999999999",uid:"secret"});
  assert.deepEqual(Object.keys(entry).sort(),["alias","avatar","badgeIds","level","xp"].sort());
  assert.equal(entry.alias,"Juan");assert.equal(entry.xp,500);assert.equal(entry.email,undefined);assert.equal(entry.whatsapp,undefined);assert.equal(entry.uid,undefined);
});
test("salir del ranking limpia la preferencia pública",()=>assert.deepEqual(rankingPreferencePatch({participateInRanking:false,publicAlias:"No importa"}),{participateInRanking:false,publicAlias:""}));
test("entrar al ranking exige alias público válido",()=>{
  assert.throws(()=>rankingPreferencePatch({participateInRanking:true,publicAlias:""}),/Alias público/);
  assert.throws(()=>rankingPreferencePatch({participateInRanking:true,publicAlias:"<script>"}),/Alias público/);
});
test("el documento público no revela el UID",()=>{
  const id=rankingDocumentId("firebase-user-123");
  assert.notEqual(id,"firebase-user-123");assert.ok(!id.includes("firebase-user-123"));
});
