(function (global) {
  'use strict';

  // Configuración pública del frontend. Nunca colocar API Secret aquí.
  // Cloudinary solo se habilita con firma del servidor y activación explícita.
  const CONFIG = Object.freeze({
    provider: 'firebase',
    cloudinary: Object.freeze({
      enabled: false,
      mode: 'signed'
    }),
    compression: Object.freeze({
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.82,
      mimeType: 'image/webp',
      maxInputBytes: 20 * 1024 * 1024
    })
  });

  function cloudinaryReady(config) {
    const cfg = config || CONFIG;
    const cloud = cfg.cloudinary || {};
    return cfg.provider === 'cloudinary' && cloud.enabled === true && cloud.mode === 'signed';
  }

  function getPublicCloudinaryConfig(config) {
    const cfg = config || CONFIG;
    if (!cloudinaryReady(cfg)) return null;
    return Object.freeze({ mode: 'signed' });
  }

  const api = Object.freeze({ CONFIG, cloudinaryReady, getPublicCloudinaryConfig });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.VisitaLojaImageConfig = api;
})(typeof window !== 'undefined' ? window : globalThis);
