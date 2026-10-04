(function (global) {
  'use strict';

  const CLOUD_NAME_RE = /^[a-zA-Z0-9_-]+$/;

  function buildUploadUrl(cloudName) {
    const value = String(cloudName || '').trim();
    if (!CLOUD_NAME_RE.test(value)) throw new Error('Cloud Name de Cloudinary no válido.');
    return 'https://api.cloudinary.com/v1_1/' + value + '/image/upload';
  }

  function normalizeUploadResult(payload) {
    if (!payload || !payload.secure_url || !payload.public_id) throw new Error('Cloudinary no devolvió una imagen válida.');
    let url;
    try { url = new URL(payload.secure_url); } catch (_) { throw new Error('Cloudinary no devolvió una URL segura.'); }
    if (url.protocol !== 'https:' || url.username || url.password || (payload.resource_type && payload.resource_type !== 'image')) {
      throw new Error('Cloudinary no devolvió una URL segura de imagen.');
    }
    return { url: url.href, publicId: payload.public_id, width: Number(payload.width)||null, height:Number(payload.height)||null, format:payload.format||null, bytes:Number(payload.bytes)||null };
  }

  async function uploadSignedImage(blob, authorization, options) {
    if (!(blob instanceof Blob)) throw new Error('No hay una imagen para subir.');
    const auth = authorization || {}, params = auth.params || {};
    if (!CLOUD_NAME_RE.test(auth.cloudName || '') || !String(auth.apiKey || '').trim() || !/^[a-f0-9]{40}$/.test(auth.signature || '') || !Number.isSafeInteger(params.timestamp) || !params.folder || !params.upload_preset) {
      throw new Error('La firma de subida no es válida.');
    }
    const form = new FormData();
    form.append('file', blob, options && options.filename || 'visitaloja-image.webp');
    ['folder','timestamp','upload_preset'].forEach(key => form.append(key, String(params[key])));
    form.append('api_key', String(auth.apiKey));
    form.append('signature', auth.signature);
    const response = await fetch(buildUploadUrl(auth.cloudName), { method:'POST', body:form });
    let payload=null; try { payload=await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(payload && payload.error && payload.error.message ? 'Cloudinary: '+payload.error.message : 'No se pudo subir la imagen a Cloudinary.');
    return normalizeUploadResult(payload);
  }

  const api=Object.freeze({buildUploadUrl,normalizeUploadResult,uploadSignedImage});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.VisitaLojaCloudinaryUploader=api;
})(typeof window!=='undefined'?window:globalThis);
