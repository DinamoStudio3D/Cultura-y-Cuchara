/* Comprueba la salida nativa de qrcode-generator, sin logo ni redibujado de módulos. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const sharp = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'sharp') : 'sharp');
const jsQR = require('../js/vendor/jsQR.js');
const qrcode = require('../js/vendor/qrcode-generator.js');
const url = 'https://www.visitaloja.com/';
const source = fs.readFileSync(path.join(__dirname, '../js/admin-qr-static.js'), 'utf8');
const head = source.slice(source.indexOf('(() => {'), source.indexOf("  const module = $('qrModule');"));
const api = vm.runInNewContext(head + 'return {validatedUrl,qrCode,modulePixels};})();', {qrcode, URL});
async function decode(input) {
  const {data, info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  return jsQR(new Uint8ClampedArray(data), info.width, info.height,
    {inversionAttempts: 'dontInvert'})?.data;
}
function checkPattern(image, info, code, cell, x, y, label) {
  const offset = 4 * cell;
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
    const px = offset + (x + col) * cell + Math.floor(cell / 2);
    const py = offset + (y + row) * cell + Math.floor(cell / 2);
    const base = (py * info.width + px) * info.channels;
    const expected = code.isDark(y + row, x + col) ? 0 : 255;
    assert.strictEqual(image[base], expected, `${label}: módulo ${col},${row}`);
  }
}
(async () => {
  const code = api.qrCode(api.validatedUrl(url), 'M');
  const count = code.getModuleCount();
  assert.strictEqual(count, 29); // v3: hay marca de alineación.
  for (const target of [512, 1024]) {
    const cell = api.modulePixels(code, target, 4);
    const side = (count + 8) * cell;
    const gif = Buffer.from(code.createDataURL(cell, cell * 4).split(',')[1], 'base64');
    const svg = Buffer.from(code.createSvgTag(cell, cell * 4));
    const png = await sharp(gif).png().toBuffer();
    for (const [name, content] of [['Vista previa nativa', gif], ['PNG', png], ['SVG', svg]]) {
      assert.strictEqual(await decode(content), url);
      const {data, info} = await sharp(content).ensureAlpha().raw().toBuffer({resolveWithObject: true});
      assert.strictEqual(info.width, side);
      assert.strictEqual(info.height, side);
      for (const [x, y, label] of [[0,0,'finder superior izquierdo'],[count-7,0,'finder superior derecho'],[0,count-7,'finder inferior izquierdo'],[count-9,count-9,'alignment']])
        checkPattern(data,info,code,cell,x,y,`${name}: ${label}`);
      for (const [x,y] of [[0,0],[side-1,0],[0,side-1],[side-1,side-1],[4*cell-1,4*cell-1]]) {
        const i=(y*side+x)*4;
        assert.deepStrictEqual([...data.subarray(i,i+3)],[255,255,255],`${name}: quiet zone`);
      }
      console.log(`${name}, ${side} px, módulo ${cell} px: ${url}`);
    }
  }
  assert.notStrictEqual(await decode(Buffer.from(api.qrCode('https://.www.visitaloja.com/','M').createDataURL(6,24).split(',')[1],'base64')),url);
  console.log('QR M, negro #000000, blanco #ffffff, sin logo, margen 4 módulos: OK');
})().catch(error => {console.error(error);process.exitCode = 1});
