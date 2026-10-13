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
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || (payload.resource_type && payload.resource_type !== 'image')) {
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
    const opts = options || {}, controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    if (opts.signal?.aborted) abort();
    else opts.signal?.addEventListener('abort', abort, {once:true});
    const timer = setTimeout(() => { timedOut = true; abort(); }, opts.timeoutMs ?? 120000);
    try {
      controller.signal.throwIfAborted();
      const response = await fetch(buildUploadUrl(auth.cloudName), { method:'POST', body:form, signal:controller.signal });
      let payload=null; try { payload=await response.json(); } catch (error) { if (controller.signal.aborted) throw error; }
      if (controller.signal.aborted) throw Object.assign(new Error('Subida cancelada.'), {name:'AbortError'});
      if (!response.ok) throw new Error(payload?.error?.message ? 'Cloudinary: '+payload.error.message : 'Cloudinary rechazó la imagen (HTTP '+response.status+').');
      const result = normalizeUploadResult(payload);
      const url = new URL(result.url);
      if (!url.pathname.startsWith('/'+auth.cloudName+'/image/upload/') || !result.publicId.startsWith(params.folder+'/')) throw new Error('Cloudinary devolvió una imagen fuera del destino autorizado.');
      return result;
    } catch (error) {
      if (timedOut) throw new Error('La subida superó dos minutos. Inténtalo con una imagen más pequeña.');
      if (controller.signal.aborted) throw Object.assign(new Error('Subida cancelada.'), {name:'AbortError'});
      throw error;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', abort);
    }
  }

  const api=Object.freeze({buildUploadUrl,normalizeUploadResult,uploadSignedImage});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.VisitaLojaCloudinaryUploader=api;
})(typeof window!=='undefined'?window:globalThis);
