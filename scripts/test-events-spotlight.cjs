const test=require('node:test'),assert=require('node:assert/strict');
const {upcoming,timestamp,safeImage}=require('../js/events-spotlight.js');
const now=Date.parse('2026-10-20T18:00:00-05:00');
test('only published, current events appear, sorted without mutating admin data',()=>{
 const events=[{id:'later',date:'2026-10-22'},{id:'soon',date:'2026-10-21'},...['draft','hidden'].map(publicationStatus=>({date:'2026-10-21',publicationStatus})),{date:'2026-10-21',active:false},{date:'2026-10-19'},{date:'invalid'},{title:'no date'}];
 assert.deepEqual(upcoming(events,now).map(e=>e.id),['soon','later']);assert.equal(events[0].id,'later');
});
test('the Ecuador one-hour expiry is enforced at the exact boundary',()=>{
 const e={date:'2026-10-20',time:'17:00'};assert.equal(timestamp(e),Date.parse('2026-10-20T22:00:00Z'));assert.equal(upcoming([e],now-1).length,1);assert.equal(upcoming([e],now).length,0);
});
test('posters reject executable URLs and embedded credentials',()=>{
 for(const x of ['javascript:alert(1)','data:image/svg+xml,x','//example.com/x','https://user:pass@example.com/x','assets/../secret.svg'])assert.equal(safeImage(x),'');
 assert.equal(safeImage('https://example.com/poster.webp'),'https://example.com/poster.webp');assert.equal(safeImage('assets/events-preview/music.svg'),'assets/events-preview/music.svg');
});
