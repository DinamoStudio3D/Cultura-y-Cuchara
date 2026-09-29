import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const tests = [
  'js/image-compressor.test.js',
  'js/cloudinary-image-uploader.test.js',
  'js/visitaloja-image-service.test.js',
  'js/visitaloja-image-config.test.js',
  'js/visitaloja-image-provider.test.js',
  'js/merchant-image-upload-adapter.test.js',
  'js/merchant-profile-flow.test.js',
  'js/merchant-signed-pipeline.test.js',
  'functions/merchant-image-signing.test.js',
  'api/sign-merchant-image.test.js'
];

const optionalTests = ['api/delete-merchant-image.test.js'];
const requiredPortalScripts = [
  'js/image-compressor.js',
  'js/cloudinary-image-uploader.js',
  'js/visitaloja-image-service.js',
  'js/visitaloja-image-config.js',
  'js/visitaloja-image-provider.js',
  'js/merchant-image-upload-adapter.js',
  'js/merchant-image-cleanup.js'
];

let failed = false;

for (const test of [...tests, ...optionalTests.filter(fs.existsSync)]) {
  if (!fs.existsSync(test)) {
    console.error(`✗ Falta ${test}`);
    failed = true;
    continue;
  }
  const run = spawnSync(process.execPath, [test], { encoding: 'utf8' });
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.status !== 0) {
    console.error(`✗ Falló ${test}`);
    failed = true;
  } else console.log(`✓ ${test}`);
}

const portal = fs.readFileSync('merchant-profile.html', 'utf8');
let lastIndex = -1;
for (const script of requiredPortalScripts) {
  const index = portal.indexOf(`src="${script}"`);
  if (index < 0) {
    console.error(`✗ merchant-profile.html no carga ${script}`);
    failed = true;
  } else if (index <= lastIndex) {
    console.error(`✗ Orden incorrecto de módulos: ${script}`);
    failed = true;
  } else {
    console.log(`✓ Portal carga ${script} en orden seguro`);
    lastIndex = index;
  }
}

const config = fs.readFileSync('js/visitaloja-image-config.js', 'utf8');
if (!/provider:\s*'cloudinary'/.test(config) || !/enabled:\s*true/.test(config) || !/mode:\s*'signed'/.test(config)) {
  console.error('✗ Cloudinary firmado no está activo en la configuración pública');
  failed = true;
} else console.log('✓ Cloudinary firmado está activo');

if (!portal.includes("fetch('/api/sign-merchant-image'") || !portal.includes('allowFirebaseFallback:false')) {
  console.error('✗ El Portal no exige la subida firmada sin fallback silencioso');
  failed = true;
} else console.log('✓ El Portal exige subida Cloudinary firmada');

if (!portal.includes('cleanupAfterSave') || !portal.includes("fetch('/api/delete-merchant-image'")) {
  console.error('✗ Falta la limpieza segura de imágenes después de guardar');
  failed = true;
} else console.log('✓ El Portal integra limpieza segura post-guardado');

if (failed) process.exit(1);
console.log('\nImage pipeline validation: OK');
