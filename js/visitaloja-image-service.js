(function (global) {
  'use strict';

  function requireDependency(name, value) {
    if (!value) throw new Error('Falta el módulo requerido: ' + name + '.');
    return value;
  }

  function normalizePurpose(value) {
    const purpose = String(value || 'gallery').trim().toLowerCase();
    return ['logo', 'hero', 'gallery'].includes(purpose) ? purpose : 'gallery';
  }

  function safeSegment(value, fallback) {
    const clean = String(value || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return clean || fallback;
  }

  function buildFolder(placeId, purpose) {
    return 'visitaloja/places/' + safeSegment(placeId, 'unknown') + '/' + normalizePurpose(purpose);
  }

  function createService(dependencies) {
    const deps = dependencies || {};
    const compressor = requireDependency('VisitaLojaImageCompressor', deps.compressor || global.VisitaLojaImageCompressor);
    const cloudinary = requireDependency('VisitaLojaCloudinaryUploader', deps.cloudinary || global.VisitaLojaCloudinaryUploader);

    async function prepare(file, options) {
      return compressor.compressImageClientSide(file, options && options.compression);
    }

    async function uploadPrepared(prepared, config, options) {
      if (!prepared || !prepared.blob) throw new Error('Primero debes preparar una imagen.');
      const opts = options || {};
      const purpose = normalizePurpose(opts.purpose);
      const placeId = safeSegment(opts.placeId, 'unknown');
      const uploaded = await cloudinary.uploadUnsignedImage(prepared.blob, config, {
        folder: buildFolder(placeId, purpose),
        filename: purpose + '-' + Date.now() + '.webp',
        context: 'placeId=' + placeId + '|purpose=' + purpose
      });
      return {
        provider: 'cloudinary',
        purpose,
        placeId,
        url: uploaded.url,
        publicId: uploaded.publicId,
        width: uploaded.width || prepared.width,
        height: uploaded.height || prepared.height,
        bytes: uploaded.bytes || prepared.optimizedBytes,
        format: uploaded.format || 'webp',
        originalBytes: prepared.originalBytes,
        optimizedBytes: prepared.optimizedBytes,
        savingsPercent: prepared.savingsPercent
      };
    }

    async function prepareAndUpload(file, config, options) {
      const prepared = await prepare(file, options);
      return uploadPrepared(prepared, config, options);
    }

    return Object.freeze({ prepare, uploadPrepared, prepareAndUpload });
  }

  const api = Object.freeze({ normalizePurpose, safeSegment, buildFolder, createService });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.VisitaLojaImageService = api;
})(typeof window !== 'undefined' ? window : globalThis);
