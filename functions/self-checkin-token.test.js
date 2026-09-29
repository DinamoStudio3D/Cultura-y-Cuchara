"use strict";

const assert = require("node:assert/strict");
const { generateSelfCheckinToken, hashSelfCheckinToken, timingSafeTokenMatch, buildSelfCheckinUrl } = require("./self-checkin-token");

const a = generateSelfCheckinToken();
const b = generateSelfCheckinToken();
assert.ok(a.length >= 32);
assert.notEqual(a, b);
assert.equal(hashSelfCheckinToken(a).length, 64);
assert.equal(timingSafeTokenMatch(a, hashSelfCheckinToken(a)), true);
assert.equal(timingSafeTokenMatch("incorrecto", hashSelfCheckinToken(a)), false);
assert.equal(timingSafeTokenMatch(a, "bad-hash"), false);

const url = new URL(buildSelfCheckinUrl({ placeId: "museo-loja", token: a }));
assert.equal(url.origin, "https://www.visitaloja.com");
assert.equal(url.pathname, "/fidelidad.html");
assert.equal(url.searchParams.get("checkin"), "museo-loja");
assert.equal(url.searchParams.get("mode"), "self");
assert.equal(url.searchParams.get("token"), a);

console.log("self-checkin token tests: OK");
