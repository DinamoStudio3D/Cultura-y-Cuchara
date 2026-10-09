import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const window = {};
vm.runInNewContext(fs.readFileSync(new URL('../js/public-color-contract.js', import.meta.url), 'utf8'), { window });
const luminance = color => {
    const channels = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255)
        .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return channels.reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
};
test('custom campaign foregrounds satisfy normal-text AA across the RGB range', () => {
    for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
        const background = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        const foreground = window.VisitaLojaColors.ink(background);
        const a = luminance(background), z = luminance(foreground);
        assert((Math.max(a, z) + .05) / (Math.min(a, z) + .05) >= 4.5, background);
    }
});
test('surface application gives descendants the same accessible pair', () => {
    const properties = new Map();
    window.VisitaLojaColors.applySurface({ style: { setProperty: (key, value) => properties.set(key, value) } }, '#ffffff');
    assert.equal(properties.size, 4);
    assert.equal(properties.get('background'), '#ffffff');
    assert.equal(properties.get('--vl-text'), '#000000');
});
