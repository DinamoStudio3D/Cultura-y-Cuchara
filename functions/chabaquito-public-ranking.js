"use strict";
const core=require("../js/chabaquito-v1-core");

function cleanAlias(value){return String(value??"").trim();}
function rankingDocumentId(uid){const value=String(uid??"").trim();if(!/^[A-Za-z0-9_-]{1,128}$/.test(value))throw new Error("UID inválido.");const crypto=require("node:crypto");return crypto.createHash("sha256").update(value).digest("base64url");}
function rankingPreferencePatch({participateInRanking,publicAlias}){if(typeof participateInRanking!=="boolean")throw new Error("Preferencia de ranking inválida.");if(!participateInRanking)return{participateInRanking:false,publicAlias:""};const alias=cleanAlias(publicAlias);if(!alias||alias.length>40||/[<>\x00-\x1f]/.test(alias))throw new Error("Alias público no válido.");return{participateInRanking:true,publicAlias:alias};}
function publicRankingProjection(profile){const entry=core.publicRankingEntry(profile);if(!entry)return null;return{alias:entry.alias,avatar:entry.avatar,level:entry.level,xp:entry.xp,badgeIds:entry.badgeIds};}
module.exports={publicRankingProjection,rankingDocumentId,rankingPreferencePatch};
