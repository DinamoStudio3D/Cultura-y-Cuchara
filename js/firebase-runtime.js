(function (root) {
  'use strict';
  function resolve(productionConfig, environment = root.__VL_FIREBASE_ENV__) {
    if (!environment) throw new Error('Firebase bloqueado: configuración de entorno no disponible.');
    if (environment.mode === 'production' && environment.projectId === 'cultura-y-cuchara' && productionConfig.projectId === environment.projectId) return productionConfig;
    if (environment.mode !== 'preview' || environment.projectId !== 'visitaloja-chabaquito-preview' || environment.config?.projectId !== environment.projectId || environment.config.authDomain !== 'visitaloja-chabaquito-preview.firebaseapp.com') throw new Error('Firebase bloqueado: proyecto incorrecto.');
    return Object.freeze({ ...environment.config });
  }
  const api = Object.freeze({ resolve });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VisitaLojaFirebaseRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis);
