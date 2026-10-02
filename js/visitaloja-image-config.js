(function (global) {
  'use strict';
  // Configuración pública. Nunca colocar CLOUDINARY_API_SECRET en el navegador.
  const CONFIG=Object.freeze({provider:'cloudinary',cloudinary:Object.freeze({enabled:true,mode:'signed'}),compression:Object.freeze({maxWidth:1600,maxHeight:1600,quality:.82,mimeType:'image/webp',maxInputBytes:20*1024*1024})});
  function cloudinaryReady(config){const cfg=config||CONFIG,cloud=cfg.cloudinary||{};return cfg.provider==='cloudinary'&&cloud.enabled===true&&cloud.mode==='signed'}
  function getPublicCloudinaryConfig(config){const cfg=config||CONFIG;if(!cloudinaryReady(cfg))return null;return Object.freeze({enabled:true,mode:'signed'});}
  const api=Object.freeze({CONFIG,cloudinaryReady,getPublicCloudinaryConfig});if(typeof module!=='undefined'&&module.exports)module.exports=api;global.VisitaLojaImageConfig=api;
})(typeof window!=='undefined'?window:globalThis);
