/* Comprueba QR nativo sin logo y la variante opcional superpuesta. */
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
const api = vm.runInNewContext(head + 'return {validatedUrl,qrCode,modulePixels,logoBox,logoSvg};})();', {qrcode, URL});
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
  const high = api.qrCode(url, 'H');
  const cell = api.modulePixels(high, 1024, 4);
  const native = Buffer.from(high.createDataURL(cell, cell * 4).split(',')[1], 'base64');
  const logo = await sharp(path.join(__dirname, '../visita-loja-icon-512.png')).resize(128,128).png().toBuffer();
  const box = api.logoBox(high, cell, 4);
  const inset = Math.round((box.patch - box.symbol) / 2);
  const centerLogo = await sharp(logo).resize(box.symbol,box.symbol).png().toBuffer();
  const white = {input: {create:{width:box.patch,height:box.patch,channels:4,background:'#ffffff'}},left:box.x,top:box.y};
  const mark = {input:centerLogo,left:box.x + inset,top:box.y + inset};
  const composed = await sharp(native).composite([white,mark]).png().toBuffer();
  const svgWithLogo = api.logoSvg(high.createSvgTag(cell,cell*4),{data:'data:image/png;base64,'+logo.toString('base64')},high,cell,4);
  for (const [label,content] of [['PNG con logo',composed],['SVG con logo',Buffer.from(svgWithLogo)]]) {
    assert.strictEqual(await decode(content),url,`${label}: URL`);
    const {data,info} = await sharp(content).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for (const [x,y,name] of [[0,0,'finder superior izquierdo'],[high.getModuleCount()-7,0,'finder superior derecho'],[0,high.getModuleCount()-7,'finder inferior izquierdo'],[high.getModuleCount()-9,high.getModuleCount()-9,'alignment']])
      checkPattern(data,info,high,cell,x,y,`${label}: ${name}`);
    console.log(`${label}: ${url}`);
  }
  const previewCell = api.modulePixels(high,304,4);
  const previewBox = api.logoBox(high,previewCell,4);
  const previewNative = Buffer.from(high.createDataURL(previewCell,previewCell*4).split(',')[1],'base64');
  const previewMark = await sharp(logo).resize(previewBox.symbol,previewBox.symbol).png().toBuffer();
  const preview = await sharp(previewNative).composite([
    {input:{create:{width:previewBox.patch,height:previewBox.patch,channels:4,background:'#ffffff'}},left:previewBox.x,top:previewBox.y},
    {input:previewMark,left:previewBox.x+Math.round((previewBox.patch-previewBox.symbol)/2),top:previewBox.y+Math.round((previewBox.patch-previewBox.symbol)/2)}
  ]).png().toBuffer();
  assert.strictEqual(await decode(preview),url,'Vista previa con logo');
  console.log(`Vista previa con logo: ${url}`);
  assert.throws(()=>api.logoBox(api.qrCode('https://www.visitaloja.com/'+'a'.repeat(110),'H'),5,4),/demasiado grande/);
  assert.notStrictEqual(await decode(Buffer.from(api.qrCode('https://.www.visitaloja.com/','M').createDataURL(6,24).split(',')[1],'base64')),url);
  console.log('QR M sin logo y H con logo, margen 4 módulos: OK');
})().catch(error => {console.error(error);process.exitCode = 1});
