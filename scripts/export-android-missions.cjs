// Keep native editorial templates aligned with the website without running its DOM code.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const context = {window: {}}; vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/chabaquito-mission-drafts.js'), 'utf8'), context);
const content = JSON.stringify(context.window.VisitaLojaChabaquitoMissionDrafts, null, 2) + '\n';
const file = path.join(__dirname, '../android/native/app/src/main/assets/admin-mission-templates.json');
if (process.argv.includes('--check')) { if (fs.readFileSync(file, 'utf8') !== content) throw Error('Regenera las plantillas con node scripts/export-android-missions.cjs'); }
else fs.writeFileSync(file, content);
