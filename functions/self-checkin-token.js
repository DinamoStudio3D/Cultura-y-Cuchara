"use strict";

const crypto = require("node:crypto");

function generateSelfCheckinToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function hashSelfCheckinToken(token) {
  const value = String(token || "").trim();
  if (!value) throw new Error("Token de self-check-in requerido.");
  return crypto.createHash("sha256").update(value).digest("hex");
}

function timingSafeTokenMatch(token, expectedHash) {
  const hash = hashSelfCheckinToken(token);
  const expected = String(expectedHash || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expected, "hex"));
}

function buildSelfCheckinUrl({ origin = "https://www.visitaloja.com", placeId, token }) {
  const id = String(placeId || "").trim();
  if (!id) throw new Error("placeId requerido.");
  if (!token) throw new Error("token requerido.");
  const url = new URL("/self-checkin.html", origin);
  url.searchParams.set("checkin", id);
  url.searchParams.set("mode", "self");
  url.searchParams.set("token", token);
  return url.toString();
}

module.exports = { generateSelfCheckinToken, hashSelfCheckinToken, timingSafeTokenMatch, buildSelfCheckinUrl };
