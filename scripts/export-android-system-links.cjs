const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
const literal = source.match(/const SYSTEM_LINKS=(\[[\s\S]*?\n\]);/);
if (!literal) throw Error('No se encontró el catálogo de enlaces oficiales.');
const rows = vm.runInNewContext('(' + literal[1] + ')', Object.create(null));
const result = rows.map(({title, path, audience, description}) => {
  if (typeof path !== 'string' || !/^\/(?:[a-z0-9-]+\.html)?$/.test(path)) throw Error('Ruta oficial incompatible');
  return {title, path, audience, description};
});
const file = path.join(__dirname, '../android/native/app/src/main/assets/admin-system-links.json');
const content = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--check')) { if (fs.readFileSync(file, 'utf8') !== content) throw Error('Regenera los enlaces con node scripts/export-android-system-links.cjs'); }
else fs.writeFileSync(file, content);
