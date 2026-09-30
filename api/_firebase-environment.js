'use strict';
const PREVIEW_PROJECT = 'visitaloja-chabaquito-preview';
const PRODUCTION_PROJECT = 'cultura-y-cuchara';
function configuration(env = process.env) {
  if (env.VERCEL_ENV === 'production') return { mode: 'production', projectId: PRODUCTION_PROJECT };
  if (env.VERCEL_ENV !== 'preview' || !['feature/chabaquito-v1', 'feature/visitaloja-integrada-preview'].includes(env.VERCEL_GIT_COMMIT_REF)) throw new Error('Entorno Firebase no autorizado.');
  if (env.VISITALOJA_FIREBASE_PROJECT_ID !== PREVIEW_PROJECT) throw new Error('Confirma el Project ID del Firebase aislado.');
  let publicConfig;
  try { publicConfig = JSON.parse(env.VISITALOJA_FIREBASE_WEB_CONFIG || ''); } catch (_) { throw new Error('Falta configuración Web pública de Preview.'); }
  const allowed = ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId','measurementId'];
  if (!publicConfig || Object.keys(publicConfig).some(key => !allowed.includes(key)) ||
      publicConfig.projectId !== PREVIEW_PROJECT || publicConfig.authDomain !== `${PREVIEW_PROJECT}.firebaseapp.com` ||
      !['apiKey','appId','messagingSenderId'].every(key => typeof publicConfig[key] === 'string' && publicConfig[key].length > 0) ||
      (publicConfig.storageBucket && ![`${PREVIEW_PROJECT}.appspot.com`,`${PREVIEW_PROJECT}.firebasestorage.app`].includes(publicConfig.storageBucket))) throw new Error('Configuración Web incompatible con Firebase aislado.');
  return { mode:'preview', projectId: PREVIEW_PROJECT, config:publicConfig };
}
module.exports = { configuration, PREVIEW_PROJECT, PRODUCTION_PROJECT };
