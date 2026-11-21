const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
const literal = html.match(/const DEFAULT_CHABAQUITO = (\{[^\n]+\});/);
if (!literal) throw Error('No se encontró la configuración inicial de Chabaquito.');
const data = vm.runInNewContext('(' + literal[1] + ')', Object.create(null));
const defaults = Object.fromEntries(['active','animated','imageUrl','messages','missions','certificate'].map(key => [key, data[key]]));
const file = path.join(__dirname, '../android/native/app/src/main/assets/admin-chabaquito-defaults.json');
const content = JSON.stringify(defaults, null, 2) + '\n';
if (process.argv.includes('--check')) { if (fs.readFileSync(file, 'utf8') !== content) throw Error('Regenera Chabaquito con node scripts/export-android-chabaquito.cjs'); }
else fs.writeFileSync(file, content);
