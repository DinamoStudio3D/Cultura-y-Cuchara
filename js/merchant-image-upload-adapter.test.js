'use strict';

const assert = require('assert');
const adapterApi = require('./merchant-image-upload-adapter.js');

(async () => {
  const calls = [];
  const configApi = { CONFIG: { provider: 'firebase' } };
  const providerApi = {
    createProvider(deps) {
      assert.strictEqual(typeof deps.firebaseUpload, 'function');
      return {
        async upload(file, context) {
          calls.push({ file, context });
          return { provider: 'firebase', url: 'https://firebase.test/current-contract.jpg', fallbackUsed: false };
        }
      };
    }
  };

  const uploader = adapterApi.createMerchantImageUploader({
    providerApi,
    configApi,
    firebaseUpload: async () => 'unused'
  });

  const url = await uploader.uploadUrl({ name: 'photo.jpg' }, 'place-1', 'hero');
  assert.strictEqual(url, 'https://firebase.test/current-contract.jpg');
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].context.placeId, 'place-1');
  assert.strictEqual(calls[0].context.purpose, 'hero');
  assert.strictEqual(calls[0].context.allowFirebaseFallback, false);

  const badProviderApi = {
    createProvider() { return { async upload() { return { provider: 'firebase' }; } }; }
  };
  const badUploader = adapterApi.createMerchantImageUploader({
    providerApi: badProviderApi,
    configApi,
    firebaseUpload: async () => 'unused'
  });
  await assert.rejects(() => badUploader.uploadUrl({}, 'x', 'gallery'), /no devolvió una URL/);

  console.log('merchant-image-upload-adapter tests: OK');
})().catch(error => { console.error(error); process.exit(1); });
