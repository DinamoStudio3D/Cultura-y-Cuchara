'use strict';

const assert = require('assert');
const compressor = require('./image-compressor.js');

function fakeFile(type, size) {
  return { type, size };
}

assert.deepStrictEqual(
  compressor.calculateDimensions(4000, 3000, 1600, 1600),
  { width: 1600, height: 1200 }
);

assert.deepStrictEqual(
  compressor.calculateDimensions(900, 600, 1600, 1600),
  { width: 900, height: 600 }
);

assert.deepStrictEqual(
  compressor.calculateDimensions(1200, 3000, 1600, 1600),
  { width: 640, height: 1600 }
);

assert.doesNotThrow(() => compressor.validateImageFile(fakeFile('image/jpeg', 8 * 1024 * 1024)));
assert.doesNotThrow(() => compressor.validateImageFile(fakeFile('image/png', 2 * 1024 * 1024)));
assert.doesNotThrow(() => compressor.validateImageFile(fakeFile('image/webp', 500 * 1024)));
assert.throws(() => compressor.validateImageFile(fakeFile('image/gif', 1000)), /JPG, PNG o WebP/);
assert.throws(() => compressor.validateImageFile(fakeFile('image/jpeg', 21 * 1024 * 1024)), /supera el límite/);
assert.throws(() => compressor.calculateDimensions(0, 100, 1600, 1600), /Dimensiones/);

console.log('image-compressor tests: OK');
