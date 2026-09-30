'use strict';
// Read-only preflight; no SDK, deployment, credential output or database access.
const { configuration, PREVIEW_PROJECT } = require('../../api/_firebase-environment');
try {
  const target = configuration(process.env);
  if (target.mode !== 'preview' || target.projectId !== PREVIEW_PROJECT) throw new Error('Solo se admite el destino Preview aislado.');
  console.log(`Firebase destino = ${target.projectId}`);
  console.log('Configuración pública comprobada. No demuestra acceso al proyecto ni autoriza despliegues/escrituras.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
