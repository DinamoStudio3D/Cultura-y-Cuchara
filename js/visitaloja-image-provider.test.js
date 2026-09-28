'use strict';

const assert = require('assert');
const providerApi = require('./visitaloja-image-provider.js');
const configApi = require('./visitaloja-image-config.js');

(async () => {
  let firebaseCalls = 0;
  const firebaseUpload = async () => { firebaseCalls++; return 'https://firebase.test/image.webp'; };

  const firebaseProvider = providerApi.createProvider({ configApi, firebaseUpload });
  const firebaseResult = await firebaseProvider.upload({ type: 'image/jpeg' }, {});
  assert.strictEqual(firebaseResult.provider, 'firebase');
  assert.strictEqual(firebaseResult.fallbackUsed, false);
  assert.strictEqual(firebaseCalls, 1);

  const cloudConfig = {
    provider: 'cloudinary',
    cloudinary: { enabled: true, mode: 'signed' },
    compression: { maxWidth: 1600 }
  };
  const cloudProvider = providerApi.createProvider({
    configApi,
    firebaseUpload,
    imageServiceApi: {
      createService() {
        return { async prepareAndUpload() { return { provider: 'cloudinary', url: 'https://cloudinary.test/image.webp' }; } };
      }
    }
  });
  const cloudResult = await cloudProvider.upload({ type: 'image/jpeg' }, { config: cloudConfig, placeId: 'abc', purpose: 'gallery' });
  assert.strictEqual(cloudResult.provider, 'cloudinary');
  assert.strictEqual(cloudResult.fallbackUsed, false);
  assert.strictEqual(firebaseCalls, 1);

  const failingCloudProvider = providerApi.createProvider({
    configApi,
    firebaseUpload,
    imageServiceApi: {
      createService() { return { async prepareAndUpload() { throw new Error('cloud failed'); } }; }
    }
  });
  await assert.rejects(
    () => failingCloudProvider.upload({ type: 'image/jpeg' }, { config: cloudConfig }),
    /cloud failed/
  );
  assert.strictEqual(firebaseCalls, 1);

  const fallbackResult = await failingCloudProvider.upload(
    { type: 'image/jpeg' },
    { config: cloudConfig, allowFirebaseFallback: true }
  );
  assert.strictEqual(fallbackResult.provider, 'firebase');
  assert.strictEqual(fallbackResult.fallbackUsed, true);
  assert.match(fallbackResult.cloudinaryError, /cloud failed/);
  assert.strictEqual(firebaseCalls, 2);

  console.log('visitaloja-image-provider tests: OK');
})().catch(error => { console.error(error); process.exit(1); });
