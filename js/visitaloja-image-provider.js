(function (global) {
  'use strict';

  function safeExt(file) {
    return file && file.type === 'image/png' ? 'png' : file && file.type === 'image/webp' ? 'webp' : 'jpg';
  }

  function createProvider(dependencies) {
    const deps = dependencies || {};
    const configApi = deps.configApi || global.VisitaLojaImageConfig;
    const imageServiceApi = deps.imageServiceApi || global.VisitaLojaImageService;
    if (!configApi) throw new Error('Falta VisitaLojaImageConfig.');

    async function uploadToFirebase(file, context) {
      if (typeof deps.firebaseUpload === 'function') return deps.firebaseUpload(file, context);
      throw new Error('Firebase Storage no está disponible.');
    }

    async function upload(file, context) {
      const ctx = context || {};
      const config = ctx.config || configApi.CONFIG;
      const cloudConfig = configApi.getPublicCloudinaryConfig(config);

      if (cloudConfig) {
        if (!imageServiceApi) throw new Error('Falta VisitaLojaImageService.');
        try {
          const service = imageServiceApi.createService(ctx.imageDependencies);
          const result = await service.prepareAndUpload(file, cloudConfig, {
            placeId: ctx.placeId,
            purpose: ctx.purpose,
            compression: config.compression
          });
          return Object.assign({ fallbackUsed: false }, result);
        } catch (error) {
          if (ctx.allowFirebaseFallback !== true) throw error;
          const url = await uploadToFirebase(file, ctx);
          return { provider: 'firebase', url, fallbackUsed: true, cloudinaryError: error.message || String(error) };
        }
      }

      const url = await uploadToFirebase(file, ctx);
      return { provider: 'firebase', url, fallbackUsed: false };
    }

    return Object.freeze({ upload });
  }

  const api = Object.freeze({ safeExt, createProvider });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.VisitaLojaImageProvider = api;
})(typeof window !== 'undefined' ? window : globalThis);
