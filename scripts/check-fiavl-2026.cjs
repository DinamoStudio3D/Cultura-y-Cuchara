#!/usr/bin/env node
// FIAVL 2026 preview consistency check. Run: node scripts/check-fiavl-2026.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'fiavl-2026-preview.html'), 'utf8');
const geo = JSON.parse(fs.readFileSync(path.join(root, 'data/fiavl-2026-venues.geojson'), 'utf8'));
const match = html.match(/const events=(\[.*?\]);const /s);
if (!match) throw new Error('Embedded events not found');
const events = JSON.parse(match[1]);
const aliasBlock = html.match(/const venueAliases=(\{.*?\});events\.forEach/s);
if (!aliasBlock) throw new Error('Venue aliases not found');
const aliases = Object.fromEntries([...aliasBlock[1].matchAll(/'([^']+)':'([^']+)'/g)].map(x => [x[1], x[2]]));
const venues = new Map(geo.features.map(f => [f.properties.name, f]));
const failures = [];
const ids = new Set();
const normalized = e => aliases[e.lugar] || e.lugar;
for (const e of events) {
  if (!e.id || ids.has(e.id)) failures.push('Missing or duplicate event ID: ' + e.id);
  ids.add(e.id);
  if (!/^2026-11-(1[2-9]|2[0-2])$/.test(e.fecha)) failures.push('Unexpected date: ' + e.id);
  if (!/^([01]?\d|2[0-3]):[0-5]\d(?:–(?:[01]?\d|2[0-4]):[0-5]\d)?$/.test(e.hora)) failures.push('Time format: ' + e.id + ' ' + e.hora);
  if (!e.titulo || !e.lugar || !venues.has(normalized(e))) failures.push('Missing title/venue registry entry: ' + e.id);
}
const venueNames = new Set();
const circuitNumbers = new Set();
let verified = 0;
for (const f of geo.features) {
  const p = f.properties || {};
  if (!p.name || venueNames.has(p.name)) failures.push('Duplicate or missing venue: ' + p.name);
  venueNames.add(p.name);
  const count = events.filter(e => normalized(e) === p.name).length;
  if (count !== p.events) failures.push('Venue event count mismatch: ' + p.name + ' expected ' + count + ', stored ' + p.events);
  if (p.address_verification === 'intersection_confirmed' || p.address_verification === 'reference_confirmed') {
    if (!p.address_reference || !p.address_source) failures.push('Documented address missing reference/source: ' + p.name);
  }
  if (p.official_circuit_2026) {
    if (!Number.isInteger(p.official_circuit_number) || p.official_circuit_number < 1 || p.official_circuit_number > 9 || !p.official_circuit_source) failures.push('Invalid official circuit metadata: ' + p.name);
    if (circuitNumbers.has(p.official_circuit_number)) failures.push('Duplicate official circuit number: ' + p.official_circuit_number);
    circuitNumbers.add(p.official_circuit_number);
  }
  if (p.verification === 'verified') {
    verified++;
    const c = f.geometry?.coordinates;
    if (f.geometry?.type !== 'Point' || !Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite)) failures.push('Verified venue without valid point: ' + p.name);
    if (!p.coordinate_source) failures.push('Verified venue without coordinate source: ' + p.name);
  } else if (f.geometry !== null) failures.push('Unverified venue has geometry: ' + p.name);
}
console.log(JSON.stringify({ events: events.length, venues: geo.features.length, verifiedVenues: verified, errors: failures.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
