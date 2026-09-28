'use strict';

const assert = require('node:assert/strict');
const signing = require('../functions/merchant-image-signing');
const configApi = require('./visitaloja-image-config');
const providerApi = require('./visitaloja-image-provider');
const imageServiceApi = require('./visitaloja-image-service');
const cloudinary = require('./cloudinary-image-uploader');
const adapterApi = require('./merchant-image-upload-adapter');

(async () => {
  const oldFetch = global.fetch;
  const activeConfig = { provider: 'cloudinary', cloudinary: { enabled: true, mode: 'signed' } };
  let firebaseCalls = 0;
  let cloudinaryCalls = 0;
  let merchant = { active: true, placeIds: ['place-1'] };
  const credentials = {
    cloudName: 'demo', apiKey: 'public_key', apiSecret: 'private-secret', uploadPreset: 'signed_merchants'
  };
  const uploader = adapterApi.createMerchantImageUploader({
    providerApi, configApi, imageServiceApi, config: activeConfig,
    firebaseUpload: async () => { firebaseCalls++; return 'https://storage.test/fallback'; },
    allowFirebaseFallback: false,
    imageDependencies: {
      compressor: { async compressImageClientSide() {
        return { blob: new Blob(['image'], { type: 'image/webp' }), width: 100, height: 100,
          originalBytes: 2000, optimizedBytes: 5, savingsPercent: 99 };
      } }, cloudinary
    },
    async signUpload({ placeId, purpose }) {
      return signing.createMerchantImageSignature({ merchant, placeId, purpose, credentials, timestamp: 1315060510 });
    }
  });

  try {
    global.fetch = async (url, request) => {
      cloudinaryCalls++;
      assert.equal(url, 'https://api.cloudinary.com/v1_1/demo/image/upload');
      assert.equal(request.body.get('folder'), 'visitaloja/places/place-1/gallery');
      assert.equal(request.body.get('upload_preset'), 'signed_merchants');
      assert.equal(request.body.get('api_key'), 'public_key');
      assert.match(request.body.get('signature'), /^[a-f0-9]{40}$/);
      assert.equal(request.body.get('file').type, 'image/webp');
      return { ok: true, async json() { return {
        secure_url: 'https://res.cloudinary.com/demo/image/upload/photo.webp',
        public_id: 'photo', resource_type: 'image'
      }; } };
    };
    const url = await uploader.uploadUrl({ type: 'image/jpeg' }, 'place-1', 'gallery-1');
    assert.equal(url, 'https://res.cloudinary.com/demo/image/upload/photo.webp');
    assert.equal(cloudinaryCalls, 1);
    assert.equal(firebaseCalls, 0);

    merchant = { active: false, placeIds: ['place-1'] };
    await assert.rejects(() => uploader.uploadUrl({ type: 'image/jpeg' }, 'place-1', 'logo'), /Parada no autorizada/);
    assert.equal(cloudinaryCalls, 1, 'No debe subir sin firma autorizada');
    assert.equal(firebaseCalls, 0, 'No debe ocultar un fallo de autorización con Firebase');
    console.log('merchant signed pipeline: OK (firma, subida y denegación)');
  } finally { global.fetch = oldFetch; }
})().catch(error => { console.error(error); process.exitCode = 1; });
