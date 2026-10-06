"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldReconcileLoyaltyVisit } = require("./chabaquito-loyalty-reconciliation");

test("reconciles creation directly as confirmed", () => {
  assert.equal(shouldReconcileLoyaltyVisit(null, { userId: "u1", status: "confirmed" }, "req1"), true);
});

test("reconciles transition pending to confirmed", () => {
  assert.equal(shouldReconcileLoyaltyVisit({ userId: "u1", status: "pending" }, { userId: "u1", status: "confirmed" }, "req1"), true);
});

test("reconciles transition confirmed to reversed", () => {
  assert.equal(shouldReconcileLoyaltyVisit({ userId: "u1", status: "confirmed" }, { userId: "u1", status: "reversed" }, "req1"), true);
});

test("ignores unrelated update while confirmed", () => {
  assert.equal(shouldReconcileLoyaltyVisit({ userId: "u1", status: "confirmed", note: "a" }, { userId: "u1", status: "confirmed", note: "b" }, "req1"), false);
});

test("ignores unrelated update while reversed", () => {
  assert.equal(shouldReconcileLoyaltyVisit({ userId: "u1", status: "reversed", note: "a" }, { userId: "u1", status: "reversed", note: "b" }, "req1"), false);
});

test("ignores pending, missing user and missing request id", () => {
  assert.equal(shouldReconcileLoyaltyVisit(null, { userId: "u1", status: "pending" }, "req1"), false);
  assert.equal(shouldReconcileLoyaltyVisit(null, { status: "confirmed" }, "req1"), false);
  assert.equal(shouldReconcileLoyaltyVisit(null, { userId: "u1", status: "confirmed" }, ""), false);
});
