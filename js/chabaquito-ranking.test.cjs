'use strict';
const assert = require('node:assert/strict');
const { DEMO, selectTop } = require('./chabaquito-ranking');
for (const count of [3, 5, 10]) {
  const result = selectTop(DEMO, count);
  assert.equal(result.length, count);
  assert.equal(new Set(result.map(item => item.alias)).size, count);
  assert.ok(result.every((entry, index) => index === 0 || result[index - 1].xp >= entry.xp));
  assert.ok(result.every(entry => !('uid' in entry) && !('email' in entry) && !('phone' in entry)));
}
assert.throws(() => selectTop(DEMO, 4));
assert.equal(selectTop([{ alias: 'invalid', xp: -1 }, { alias: 'valid', xp: 50 }], 3).length, 1);
assert.equal(DEMO.length, 10, 'Selecting a top must not mutate the source');
console.log('Ranking demo: Top 3/5/10, order, privacy and unchanged source OK.');
