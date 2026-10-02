"use strict";
const crypto=require("node:crypto");
const IDENTIFIER=/^[A-Za-z0-9_-]{1,180}$/;
const PURPOSE=/^(logo|hero|gallery)$/;
const CREDENTIAL=/^[A-Za-z0-9_-]+$/;
function createMerchantImageSignature({placeId,purpose,credentials,timestamp}){
  if(!IDENTIFIER.test(placeId)||!PURPOSE.test(purpose))throw new Error("Destino de imagen inválido.");
  const {cloudName,apiKey,apiSecret,uploadPreset}=credentials||{};
  if(![cloudName,apiKey,uploadPreset].every(v=>typeof v==="string"&&CREDENTIAL.test(v))||typeof apiSecret!=="string"||!apiSecret)throw new Error("Credenciales de imágenes no configuradas.");
  if(!Number.isSafeInteger(timestamp)||timestamp<=0)throw new Error("Fecha de firma inválida.");
  const params={folder:`visitaloja/places/${placeId}/${purpose}`,timestamp,upload_preset:uploadPreset};
  const toSign=Object.keys(params).sort().map(key=>`${key}=${params[key]}`).join("&");
  return {cloudName,apiKey,params,signature:crypto.createHash("sha1").update(toSign+apiSecret).digest("hex")};
}
module.exports={createMerchantImageSignature};
