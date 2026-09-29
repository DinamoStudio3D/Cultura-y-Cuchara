"use strict";

const assert = require("node:assert/strict");
const { createHandler } = require("./sign-merchant-image");

const env = {
  CLOUDINARY_CLOUD_NAME: "demo",
  CLOUDINARY_API_KEY: "public_key",
  CLOUDINARY_API_SECRET: "private-secret",
  CLOUDINARY_UPLOAD_PRESET: "visitaloja_merchant_signed"
};

async function request(handler, { token = "valid-token", body = { placeId: "place-1", purpose: "logo" }, method = "POST" } = {}) {
  const res = {
    setHeader() {},
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; }
  };
  await handler({ method, headers: { authorization: token ? `Bearer ${token}` : "" }, body }, res);
  return res;
}

(async () => {
  let calls = 0;
  let active = true;
  const handler = createHandler({ env, now: () => 1700000000000, async fetchImpl(url, options) {
    calls++;
    if (url.includes("accounts:lookup")) {
      assert.equal(JSON.parse(options.body).idToken, "valid-token");
      return { ok: true, async json() { return { users: [{ localId: "merchant-1" }] }; } };
    }
    assert.match(url, /missionRewardMerchants\/merchant-1$/);
    assert.equal(options.headers.Authorization, "Bearer valid-token");
    return { ok: true, async json() { return { fields: {
      active: { booleanValue: active },
      placeIds: { arrayValue: { values: [{ stringValue: "place-1" }] } }
    } }; } };
  } });

  assert.equal((await request(handler, { token: "" })).code, 401);
  assert.equal((await request(handler, { method: "GET" })).code, 405);
  assert.equal((await request(handler, { body: { placeId: "../place-1", purpose: "logo" } })).code, 400);
  assert.equal(calls, 0, "Las solicitudes inválidas no consultan Firebase");
  const valid = await request(handler);
  assert.equal(valid.code, 200);
  assert.equal(valid.data.params.folder, "visitaloja/places/place-1/logo");
  assert.equal(valid.data.params.upload_preset, env.CLOUDINARY_UPLOAD_PRESET);
  assert.match(valid.data.signature, /^[a-f0-9]{40}$/);
  assert.equal(valid.data.apiSecret, undefined);
  assert.equal((await request(handler, { body: { placeId: "other", purpose: "logo" } })).code, 403);
  active = false;
  assert.equal((await request(handler)).code, 403);
  assert.equal((await request(createHandler({ env: {} }))).code, 503);
  const invalidSession = createHandler({ env, async fetchImpl() { return { ok: false }; } });
  assert.equal((await request(invalidSession)).code, 401);
  const deniedByRules = createHandler({ env, async fetchImpl(url) {
    return url.includes("accounts:lookup")
      ? { ok: true, async json() { return { users: [{ localId: "merchant-1" }] }; } }
      : { ok: false };
  } });
  assert.equal((await request(deniedByRules)).code, 403);
  console.log("Vercel merchant image signer: OK (token, permisos, secreto ausente)");
})().catch(error => { console.error(error); process.exitCode = 1; });
