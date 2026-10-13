import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync(new URL('../merchant-dashboard.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function inAnalyticsPeriod'),html.indexOf('function periodLabel'));
function check(from,to,stamp,cutoff=0){const ctx={el:id=>({value:id==='dateFrom'?from:to}),millis:value=>Date.parse(value),analyticsCutoff:()=>cutoff};vm.createContext(ctx);vm.runInContext(source,ctx);return ctx.inAnalyticsPeriod({placeId:'one',createdAt:stamp},['createdAt']);}
test('inclusive Ecuador dates exclude the following midnight',()=>{assert.equal(check('2026-10-01','2026-10-01','2026-10-01T05:00:00Z'),true);assert.equal(check('2026-10-01','2026-10-01','2026-10-02T04:59:59Z'),true);assert.equal(check('2026-10-01','2026-10-01','2026-10-02T05:00:00Z'),false);});
test('date selection cannot extend plan retention and rejects reversed dates',()=>{assert.equal(check('2020-01-01','','2025-10-01T05:00:00Z',Date.parse('2026-01-01')),false);assert.equal(check('2026-10-02','2026-10-01','2026-10-01T05:00:00Z'),false);});

test('embedded admin callables use the authenticated Firebase application',()=>{const source=fs.readFileSync(new URL('../js/loyalty-points-v83.js',import.meta.url),'utf8');assert.match(source,/auth\.app\.functions\('us-central1'\)/);assert.doesNotMatch(source,/firebase\.app\(\)\.functions/);});
