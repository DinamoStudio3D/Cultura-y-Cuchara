'use strict';

const fs = require('fs');
const assert = require('assert');

const read = p => fs.readFileSync(p, 'utf8');
const store = read('js/admin-qr-dynamic-store.js');
const ui = read('js/admin-qr-dynamic-ui.js');
const publicPage = read('qr-dinamico.html');
const vercel = JSON.parse(read('vercel.json'));

// Contrato de colecciones: privado, resolución pública mínima e historial.
assert.match(store, /dynamicMarketingQrs/);
assert.match(store, /dynamicQrPublic/);
assert.match(store, /dynamicQrHistory/);

// La URL que se imprime debe ser permanente y nunca el destino final.
assert.match(store, /https:\/\/www\.visitaloja\.com\/q\/\$\{encodeURIComponent\(validId\(qrId\)\)\}/);
assert.match(ui, /const permanentUrl = store\.publicUrl\(record\.id\)/);
assert.match(ui, /staticQr\.loadSaved\(\{[\s\S]*url: permanentUrl/);
assert.match(ui, /Descargar PNG/);
assert.match(ui, /Descargar SVG/);

// Cambiar destino conserva el ID: update recibe qrId y solo actualiza campos mutables.
assert.match(store, /async function update\(qrIdValue, changes\)/);
assert.match(store, /tx\.update\(privateRef, \{[\s\S]*destinationUrl,[\s\S]*status,[\s\S]*updatedAt/);
assert.doesNotMatch(store, /tx\.update\(privateRef, \{[\s\S]{0,300}\bqrId\s*:/);

// El resolvedor público acepta solo IDs válidos, exige estado activo y HTTPS.
assert.match(publicPage, /\^\\\/q\\\/\(\[A-Za-z0-9_-\]\{6,64\}\)/);
assert.match(publicPage, /data\.status !== 'active'/);
assert.match(publicPage, /destination\.protocol !== 'https:'/);
assert.match(publicPage, /location\.replace\(destination\.href\)/);

// Debe existir rewrite /q/:id hacia la página pública.
const rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : [];
assert.ok(rewrites.some(r => r.source === '/q/:id' && r.destination === '/qr-dinamico.html'), 'Falta rewrite /q/:id');

console.log('OK dynamic QR contract: permanent URL, mutable destination, public resolver and downloads.');
