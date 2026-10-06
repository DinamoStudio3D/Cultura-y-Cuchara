"use strict";
const { Timestamp } = require("firebase-admin/firestore");
const { authenticatedUser, firestore } = require("./_firebase-admin");
const { publicRankingProjection, rankingDocumentId, rankingPreferencePatch } = require("../functions/chabaquito-public-ranking");

module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST") return res.status(405).json({error:"Método no permitido."});
  try{
    const user=await authenticatedUser(req);
    let patch;
    try { patch=rankingPreferencePatch({participateInRanking:req.body?.participateInRanking,publicAlias:req.body?.publicAlias}); }
    catch(error){ return res.status(400).json({error:error?.message||"Preferencia de ranking inválida."}); }
    const db=firestore(),uid=user.uid,profileRef=db.collection("chabaquitoExplorerProfiles").doc(uid),rankingRef=db.collection("chabaquitoPublicRanking").doc(rankingDocumentId(uid)),now=Timestamp.now();
    await db.runTransaction(async tx=>{
      const profileSnap=await tx.get(profileRef),current=profileSnap.exists?profileSnap.data():{},next={...current,...patch};
      if(!patch.participateInRanking){tx.set(profileRef,{...patch,updatedAt:now},{merge:true});tx.delete(rankingRef);return;}
      let projection;try{projection=publicRankingProjection(next);}catch(error){throw Object.assign(new Error(error?.message||"Perfil de ranking inválido."),{status:412});}
      tx.set(profileRef,{...patch,updatedAt:now},{merge:true});
      tx.set(rankingRef,{...projection,updatedAt:now},{merge:false});
    });
    return res.status(200).json({participateInRanking:patch.participateInRanking,publicAlias:patch.publicAlias});
  }catch(error){
    console.error("chabaquito ranking api",error?.message||error);
    return res.status(error?.status||503).json({error:error?.status?error.message:"No se pudo guardar el ranking."});
  }
};
