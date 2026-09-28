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
for (const secure_url of ['javascript:alert(1)', 'http://example.com/image.webp', 'not a URL', 'https://user:pass@example.com/image.webp']) {
  assert.throws(() => uploader.normalizeUploadResult({ secure_url, public_id: 'sample' }), /URL segura/);
}
assert.throws(() => uploader.normalizeUploadResult({
  secure_url: 'https://res.cloudinary.com/demo/video/upload/sample.mp4',
  public_id: 'sample', resource_type: 'video'
}), /URL segura de imagen/);

(async () => {
  const oldFetch = global.fetch;
  try {
    global.fetch = async (url, request) => {
      assert.equal(url, 'https://api.cloudinary.com/v1_1/demo/image/upload');
      assert.equal(request.body.get('folder'), 'visitaloja/places/place-1/hero');
      assert.equal(request.body.get('timestamp'), '1315060510');
      assert.equal(request.body.get('upload_preset'), 'signed_merchants');
      assert.equal(request.body.get('api_key'), 'public_key');
      assert.equal(request.body.get('signature'), 'a'.repeat(40));
      return { ok: true, async json() { return {
        secure_url: 'https://res.cloudinary.com/demo/image/upload/hero.webp', public_id: 'hero', resource_type: 'image'
      }; } };
    };
    const result = await uploader.uploadSignedImage(new Blob(['image'], { type: 'image/webp' }), {
      cloudName: 'demo', apiKey: 'public_key', signature: 'a'.repeat(40),
      params: { folder: 'visitaloja/places/place-1/hero', timestamp: 1315060510, upload_preset: 'signed_merchants' }
    });
    assert.match(result.url, /^https:\/\//);
    await assert.rejects(() => uploader.uploadSignedImage(new Blob(['image']), { cloudName: 'demo' }), /firma/);
    console.log('cloudinary-image-uploader tests: OK');
  } finally { global.fetch = oldFetch; }
})().catch(error => { console.error(error); process.exitCode = 1; });
