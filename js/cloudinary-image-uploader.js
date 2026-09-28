(function (global) {
  'use strict';

  const CLOUD_NAME_RE = /^[a-zA-Z0-9_-]+$/;
  const PRESET_RE = /^[a-zA-Z0-9_-]+$/;

  function normalizeConfig(config) {
    const cloudName = String(config && config.cloudName || '').trim();
    const uploadPreset = String(config && config.uploadPreset || '').trim();
    if (!CLOUD_NAME_RE.test(cloudName)) throw new Error('Cloud Name de Cloudinary no válido.');
    if (!PRESET_RE.test(uploadPreset)) throw new Error('Upload Preset de Cloudinary no válido.');
    return { cloudName, uploadPreset };
  }

  function buildUploadUrl(cloudName) {
    if (!CLOUD_NAME_RE.test(String(cloudName || '').trim())) throw new Error('Cloud Name de Cloudinary no válido.');
    return 'https://api.cloudinary.com/v1_1/' + String(cloudName).trim() + '/image/upload';
  }

  function normalizeUploadResult(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Respuesta de Cloudinary no válida.');
    if (!payload.secure_url || !payload.public_id) throw new Error('Cloudinary no devolvió una imagen válida.');
    let url;
    try { url = new URL(payload.secure_url); } catch (_) { throw new Error('Cloudinary no devolvió una URL segura.'); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      (payload.resource_type && payload.resource_type !== 'image')) {
      throw new Error('Cloudinary no devolvió una URL segura de imagen.');
    }
    return {
      url: url.href,
      publicId: payload.public_id,
      width: Number(payload.width) || null,
      height: Number(payload.height) || null,
      format: payload.format || null,
      bytes: Number(payload.bytes) || null,
      resourceType: payload.resource_type || 'image'
    };
  }

  async function uploadUnsignedImage(blob, config, options) {
    if (!(blob instanceof Blob)) throw new Error('No hay una imagen optimizada para subir.');
    const cfg = normalizeConfig(config);
    const opts = options || {};
    const form = new FormData();
    form.append('file', blob, opts.filename || 'visitaloja-image.webp');
    form.append('upload_preset', cfg.uploadPreset);
    if (opts.folder) form.append('folder', String(opts.folder));
    if (opts.context) form.append('context', String(opts.context));

    const response = await fetch(buildUploadUrl(cfg.cloudName), { method: 'POST', body: form });
    let payload = null;
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const message = payload && payload.error && payload.error.message;
      throw new Error(message ? 'Cloudinary: ' + message : 'No se pudo subir la imagen a Cloudinary.');
    }
    return normalizeUploadResult(payload);
  }

  async function uploadSignedImage(blob, authorization, options) {
    if (!(blob instanceof Blob)) throw new Error('No hay una imagen optimizada para subir.');
    const auth = authorization || {};
    const params = auth.params || {};
    if (!CLOUD_NAME_RE.test(auth.cloudName || '') || !String(auth.apiKey || '').trim() ||
      !/^[a-f0-9]{40}$/.test(auth.signature || '') ||
      !Number.isSafeInteger(params.timestamp) || !params.folder || !params.upload_preset) {
      throw new Error('La firma de subida no es válida.');
    }
    const form = new FormData();
    form.append('file', blob, options && options.filename || 'visitaloja-image.webp');
    for (const key of ['folder', 'timestamp', 'upload_preset']) form.append(key, String(params[key]));
    form.append('api_key', String(auth.apiKey));
    form.append('signature', auth.signature);
    const response = await fetch(buildUploadUrl(auth.cloudName), { method: 'POST', body: form });
    let payload = null;
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const message = payload && payload.error && payload.error.message;
      throw new Error(message ? 'Cloudinary: ' + message : 'No se pudo subir la imagen a Cloudinary.');
    }
    return normalizeUploadResult(payload);
  }

  const api = Object.freeze({ normalizeConfig, buildUploadUrl, normalizeUploadResult, uploadUnsignedImage, uploadSignedImage });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.VisitaLojaCloudinaryUploader = api;
})(typeof window !== 'undefined' ? window : globalThis);
