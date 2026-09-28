(function (global) {
  'use strict';

  // Configuración pública del frontend. Nunca colocar API Secret aquí.
  // Cloudinary unsigned uploads solo se habilitan cuando enabled=true y
  // se han definido cloudName + uploadPreset deliberadamente.
  const CONFIG = Object.freeze({
    provider: 'firebase',
    cloudinary: Object.freeze({
      enabled: false,
      cloudName: '',
      uploadPreset: ''
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
    return cfg.provider === 'cloudinary' && cloud.enabled === true &&
      typeof cloud.cloudName === 'string' && cloud.cloudName.trim().length > 0 &&
      typeof cloud.uploadPreset === 'string' && cloud.uploadPreset.trim().length > 0;
  }

  function getPublicCloudinaryConfig(config) {
    const cfg = config || CONFIG;
    if (!cloudinaryReady(cfg)) return null;
    return Object.freeze({
      cloudName: cfg.cloudinary.cloudName.trim(),
      uploadPreset: cfg.cloudinary.uploadPreset.trim()
    });
  }

  const api = Object.freeze({ CONFIG, cloudinaryReady, getPublicCloudinaryConfig });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.VisitaLojaImageConfig = api;
})(typeof window !== 'undefined' ? window : globalThis);
