import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Firestore separates admin and owner roles', () => {
  const rules = read('firestore.rules');
  const claim = rules.match(/function hasAdminClaim\(\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  const profile = rules.match(/function hasActiveAdminProfile\(\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  assert.match(claim, /role == 'admin'/);
  assert.doesNotMatch(claim, /role == 'owner'/);
  assert.match(profile, /role == 'admin'/);
  assert.doesNotMatch(profile, /role == 'owner'/);
  assert.match(rules, /match \/businessAccess\/\{accessId\}/);
  assert.match(rules, /match \/businessEntitlements\/\{placeId\}/);
  assert.match(rules, /hasBusinessOwnerAccess\(documentId\)/);
  assert.match(rules, /request\.resource\.data\.gallery\.size\(\) <= 6/);
});

test('Storage does not grant global access to business owners', () => {
  const rules = read('storage.rules');
  const admin = rules.match(/function isViveLojaAdmin\(\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  assert.match(admin, /role == 'admin'/);
  assert.doesNotMatch(admin, /role == 'owner'/);
  assert.match(rules, /isAssignedMerchant\(placeId\)/);
  assert.match(rules, /function hasBusinessOwnerAccess\(placeId\)/);
  assert.match(rules, /function canManageMerchantImages\(placeId\)/);
  assert.match(rules, /!firestore\.exists\(/);
  assert.match(rules, /&& canManageMerchantImages\(placeId\)/);
});

test('Image signing does not grant admin permissions to owner role', () => {
  const api = read('api/sign-event-image.js');
  assert.doesNotMatch(api, /claims\.role === "owner"/);
  assert.doesNotMatch(api, /\["admin", "owner"\]/);
  assert.match(api, /claims\.role === "admin"/);
});

test('Firebase deploy configuration includes both rulesets', () => {
  const config = JSON.parse(read('firebase.json'));
  assert.equal(config.firestore.rules, 'firestore.rules');
  assert.equal(config.storage.rules, 'storage.rules');
});

test('Gallery upload fallback matches Firestore compatibility limit', () => {
  const api = read('api/sign-merchant-image.js');
  const plans = read('js/subscription-plan-config.js');
  assert.match(api, /DEFAULT_GALLERY_LIMIT=6/);
  assert.match(plans, /DEFAULT_GALLERY_LIMIT = 6/);
  assert.match(read('firestore.rules'), /gallery\.size\(\) <= 6/);
});
