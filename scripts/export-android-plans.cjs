const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
function literal(name) { const m = html.match(new RegExp('const '+name+'=(\\{[^\\n]+\\});')); if (!m) throw Error('Falta '+name); return vm.runInNewContext('('+m[1]+')', Object.create(null)); }
const context = {window:{}}; vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/plan-offer.js'),'utf8'),context);
const offer = context.window.VisitaLojaPlanOffer, defaults = literal('DEFAULT_SUBSCRIPTIONS');
// The web editor starts from these service defaults before upgrading old offers.
const features = literal('DEFAULT_PLAN_FEATURES'); defaults.plans = defaults.plans.map(p => offer.upgrade({...p,features:{...(features[p.id]||features.free),...(p.features||{})}}));
const specs={},templates={};
for (const id of ['free','impulse','featured','premium']) {
 specs[id]=offer.spec(id); templates[id]={};
 for (const products of [0,54322]) for (const months of [1,54323]) {
  templates[id][(products?'products':'none')+'-'+(months===1?'one':'many')]=offer.benefits({id,features:{maxGalleryImages:54321,maxFeaturedProducts:products,analyticsPeriodMonths:months}}).map(s=>s.replaceAll('54321','{photos}').replaceAll('54322','{products}').replaceAll('54323','{months}'));
 }
}
const content=JSON.stringify({defaults,features,specs,templates},null,2)+'\n';
const file=path.join(__dirname,'../android/native/app/src/main/assets/admin-plans-catalog.json');
if(process.argv.includes('--check')) {if(fs.readFileSync(file,'utf8')!==content)throw Error('Regenera planes con node scripts/export-android-plans.cjs');}else fs.writeFileSync(file,content);
