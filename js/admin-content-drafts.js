/* Device-local drafts only. Never used by the public site or written to Firestore. */
(function(root){
  'use strict';
  const maxChars=300000;
  function key(uid,scope){
    if(typeof uid!=='string'||!uid||typeof scope!=='string'||!scope)throw Error('Inicia sesión para gestionar tus borradores.');
    return 'vl_content_draft_v1:'+encodeURIComponent(uid)+':'+encodeURIComponent(scope);
  }
  function save(storage,uid,scope,data,now=Date.now()){
    const record={version:1,uid,scope,savedAt:now,data};
    const serialized=JSON.stringify(record);
    if(serialized.length>maxChars)throw Error('El borrador supera el espacio permitido.');
    storage.setItem(key(uid,scope),serialized);
    return record;
  }
  function load(storage,uid,scope){
    const raw=storage.getItem(key(uid,scope));
    if(!raw)return null;
    if(raw.length>maxChars)throw Error('El borrador guardado es demasiado grande.');
    let record;
    try{record=JSON.parse(raw);}catch{throw Error('El borrador guardado no se puede leer.');}
    if(record?.version!==1||record.uid!==uid||record.scope!==scope||!Number.isFinite(record.savedAt)||!record.data?.blocks||typeof record.data.blocks!=='object'||Array.isArray(record.data.blocks))throw Error('El borrador guardado no es válido.');
    return record;
  }
  root.VisitaLojaContentDrafts={save,load};
})(typeof window!=='undefined'?window:globalThis);
