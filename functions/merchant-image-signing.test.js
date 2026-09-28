"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createMerchantImageSignature } = require("./merchant-image-signing");

const input = {
  merchant: { active: true, placeIds: ["place-1"] },
  placeId: "place-1",
  purpose: "gallery",
  credentials: { cloudName: "demo", apiKey: "public_key", apiSecret: "private-secret", uploadPreset: "signed_merchants" },
  timestamp: 1315060510
};
const result = createMerchantImageSignature(input);
assert.deepEqual(result.params, {
  folder: "visitaloja/places/place-1/gallery",
  timestamp: 1315060510,
  upload_preset: "signed_merchants"
});
assert.equal(result.signature, crypto.createHash("sha1").update(
  "folder=visitaloja/places/place-1/gallery&timestamp=1315060510&upload_preset=signed_merchantsprivate-secret"
).digest("hex"));
assert.equal(result.apiKey, "public_key");
assert.equal(Object.values(result).includes("private-secret"), false);

for (const change of [
  { placeId: "other" }, { placeId: "../place-1" }, { purpose: "../../admin" },
  { merchant: { active: false, placeIds: ["place-1"] } },
  { merchant: { active: true, placeIds: [] } },
  { credentials: null }
]) {
  assert.throws(() => createMerchantImageSignature({ ...input, ...change }));
}
console.log("merchant-image-signing tests: OK");
