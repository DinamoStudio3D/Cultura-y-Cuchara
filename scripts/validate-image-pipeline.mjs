import fs from 'node:fs';

// Preview validation for the plan-aware Cloudinary pipeline.
const requiredFiles = [
  'js/image-compressor.js',
  'js/cloudinary-image-uploader.js',
  'js/visitaloja-image-config.js',
  'js/merchant-image-upload-adapter.js',
  'js/merchant-image-cleanup.js',
  'js/subscription-plan-config.js',
  'functions/merchant-image-signing.js',
  'api/sign-merchant-image.js',
  'api/delete-merchant-image.js',
  'merchant-profile.html'
];

let failed = false;
function ok(message) { console.log(`✓ ${message}`); }
function fail(message) { console.error(`✗ ${message}`); failed = true; }
function requireText(file, checks) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [label, predicate] of checks) predicate(text) ? ok(label) : fail(label);
  return text;
}

for (const file of requiredFiles) {
  if (fs.existsSync(file)) ok(`Existe ${file}`);
  else fail(`Falta ${file}`);
}

if (!failed) {
  const portal = requireText('merchant-profile.html', [
    ['Portal carga configuración de planes', (t) => t.includes('js/subscription-plan-config.js')],
    ['Portal usa límite dinámico de galería', (t) => t.includes('maxGalleryImages')],
    ['Portal conserva URLs HTTPS externas', (t) => /https?:\/\//.test(t)],
    ['Portal solicita firma segura a la API', (t) => t.includes("/api/sign-merchant-image")],
    ['Portal limpia imágenes solo después del guardado', (t) => t.includes('cleanupAfterSave') && t.includes('/api/delete-merchant-image')]
  ]);

  const plans = requireText('js/subscription-plan-config.js', [
    ['Planes exponen maxGalleryImages', (t) => t.includes('maxGalleryImages')],
    ['Planes soportan downgrade sin borrar fotos', (t) => t.includes('validateGalleryTransition') && t.includes('previous.overLimit')],
    ['Planes distinguen plan desactivado', (t) => t.includes('planInactive') && t.includes('assignedPlan.active === false')]
  ]);

  const signApi = requireText('api/sign-merchant-image.js', [
    ['API exige rol owner', (t) => t.includes('fieldString(accessFields.role)==="owner"')],
    ['API valida límite antes de firmar galería', (t) => t.includes('currentCount>=limit') && t.includes('gallery-plan-limit-reached')],
    ['API consulta businessEntitlements', (t) => t.includes('businessEntitlements/')],
    ['API ignora entitlement explícitamente inactivo', (t) => t.includes('!entitlement.active||fieldBool(entitlement.active)')]
  ]);

  const cleanup = requireText('js/merchant-image-cleanup.js', [
    ['Cleanup restringe a carpeta VisitaLoja del negocio', (t) => t.includes('visitaloja/places/')],
    ['Cleanup no trata cualquier URL externa como propia', (t) => t.includes('cloudinary') || t.includes('Cloudinary')]
  ]);

  requireText('api/delete-merchant-image.js', [
    ['API de borrado exige owner', (t) => t.includes('owner')],
    ['API de borrado valida el publicId solicitado', (t) => t.includes('publicId')]
  ]);

  // Evita que futuras ediciones vuelvan a un límite fijo de seis en el portal.
  if (/gallery\.length\s*>?=\s*6/.test(portal) || /gallery\.length\s*>\s*6/.test(portal)) {
    fail('El portal contiene un límite fijo de 6 fotos');
  } else ok('El portal no contiene un límite fijo de 6 fotos');

  void plans; void signApi; void cleanup;
}

if (failed) process.exit(1);
console.log('\nImage pipeline validation: OK');
