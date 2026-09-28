'use strict';

const assert = require('assert');
const uploader = require('./cloudinary-image-uploader.js');

assert.deepStrictEqual(
  uploader.normalizeConfig({ cloudName: 'visita_loja-1', uploadPreset: 'merchant_images' }),
  { cloudName: 'visita_loja-1', uploadPreset: 'merchant_images' }
);
assert.throws(() => uploader.normalizeConfig({ cloudName: '', uploadPreset: 'ok' }), /Cloud Name/);
assert.throws(() => uploader.normalizeConfig({ cloudName: 'ok', uploadPreset: 'bad preset' }), /Upload Preset/);
assert.strictEqual(
  uploader.buildUploadUrl('visitaloja'),
  'https://api.cloudinary.com/v1_1/visitaloja/image/upload'
);
assert.deepStrictEqual(
  uploader.normalizeUploadResult({
    secure_url: 'https://res.cloudinary.com/demo/image/upload/sample.webp',
    public_id: 'visitaloja/sample',
    width: 1600,
    height: 1200,
    format: 'webp',
    bytes: 245000,
    resource_type: 'image'
  }),
  {
    url: 'https://res.cloudinary.com/demo/image/upload/sample.webp',
    publicId: 'visitaloja/sample',
    width: 1600,
    height: 1200,
    format: 'webp',
    bytes: 245000,
    resourceType: 'image'
  }
);
assert.throws(() => uploader.normalizeUploadResult({ secure_url: 'https://example.com/x.webp' }), /imagen válida/);

console.log('cloudinary-image-uploader tests: OK');
