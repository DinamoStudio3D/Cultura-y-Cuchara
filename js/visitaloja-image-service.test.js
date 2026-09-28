'use strict';

const assert = require('assert');
const imageService = require('./visitaloja-image-service.js');

assert.strictEqual(imageService.normalizePurpose('logo'), 'logo');
assert.strictEqual(imageService.normalizePurpose('HERO'), 'hero');
assert.strictEqual(imageService.normalizePurpose('otro'), 'gallery');
assert.strictEqual(imageService.safeSegment('Café Loja #25', 'unknown'), 'cafe-loja-25');
assert.strictEqual(imageService.buildFolder('Local 123', 'hero'), 'visitaloja/places/local-123/hero');

let compressed = false;
let uploaded = false;
const service = imageService.createService({
  compressor: {
    async compressImageClientSide(file) {
      compressed = file === 'fake-file';
      return { blob: { fake: true }, width: 1600, height: 1200, originalBytes: 9000000, optimizedBytes: 300000, savingsPercent: 97 };
    }
  },
  cloudinary: {
    async uploadUnsignedImage(blob, config, options) {
      uploaded = !!blob.fake && config.cloudName === 'demo' && options.folder === 'visitaloja/places/local-123/gallery';
      return { url: 'https://res.cloudinary.com/demo/image/upload/x.webp', publicId: 'visitaloja/places/local-123/gallery/x', width: 1600, height: 1200, bytes: 300000, format: 'webp' };
    }
  }
});

(async () => {
  const result = await service.prepareAndUpload('fake-file', { cloudName: 'demo', uploadPreset: 'preset' }, { placeId: 'Local 123', purpose: 'gallery' });
  assert.strictEqual(compressed, true);
  assert.strictEqual(uploaded, true);
  assert.strictEqual(result.provider, 'cloudinary');
  assert.strictEqual(result.placeId, 'local-123');
  assert.strictEqual(result.purpose, 'gallery');
  assert.strictEqual(result.savingsPercent, 97);
  assert.strictEqual(result.url, 'https://res.cloudinary.com/demo/image/upload/x.webp');
  console.log('visitaloja-image-service tests: OK');
})().catch(error => { console.error(error); process.exit(1); });
