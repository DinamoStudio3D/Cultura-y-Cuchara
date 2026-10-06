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

test("la proyección refleja XP y nivel actuales del perfil",()=>{
  const low=publicRankingProjection({participateInRanking:true,publicAlias:"Explorador",validatedXp:0});
  const high=publicRankingProjection({participateInRanking:true,publicAlias:"Explorador",validatedXp:1000});
  assert.equal(low.xp,0);assert.equal(high.xp,1000);assert.ok(high.level>=low.level);
});
test("opt-out nunca produce una entrada pública aunque conserve XP",()=>assert.equal(publicRankingProjection({participateInRanking:false,publicAlias:"Anterior",validatedXp:9999}),null));
test("solo se publican hasta tres insignias con IDs seguros",()=>{
  const entry=publicRankingProjection({participateInRanking:true,publicAlias:"Explorador",validatedXp:100,publicBadgeIds:["uno","../../privado","dos","tres","cuatro","<x>"]});
  assert.deepEqual(entry.badgeIds,["uno","dos","tres"]);
});


test("un usuario puede activar el ranking antes de haber ganado XP",()=>{
  const entry=publicRankingProjection({participateInRanking:true,publicAlias:"Nuevo explorador"});
  assert.equal(entry.xp,0);
  assert.equal(entry.level,1);
});
