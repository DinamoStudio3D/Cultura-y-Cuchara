'use strict';

const assert = require('assert');
const imageConfig = require('./visitaloja-image-config.js');

assert.strictEqual(imageConfig.CONFIG.provider, 'firebase');
assert.strictEqual(imageConfig.CONFIG.cloudinary.enabled, false);
assert.strictEqual(imageConfig.cloudinaryReady(imageConfig.CONFIG), false);
assert.strictEqual(imageConfig.getPublicCloudinaryConfig(imageConfig.CONFIG), null);

const enabled = {
  provider: 'cloudinary',
  cloudinary: { enabled: true, cloudName: 'visitaloja', uploadPreset: 'merchant_images' }
};
assert.strictEqual(imageConfig.cloudinaryReady(enabled), true);
assert.deepStrictEqual(
  imageConfig.getPublicCloudinaryConfig(enabled),
  { cloudName: 'visitaloja', uploadPreset: 'merchant_images' }
);

assert.strictEqual(imageConfig.cloudinaryReady({ provider: 'cloudinary', cloudinary: { enabled: true, cloudName: '', uploadPreset: 'x' } }), false);
assert.strictEqual(imageConfig.cloudinaryReady({ provider: 'firebase', cloudinary: { enabled: true, cloudName: 'x', uploadPreset: 'y' } }), false);

console.log('visitaloja-image-config tests: OK');
