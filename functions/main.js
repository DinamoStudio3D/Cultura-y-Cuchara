"use strict";

// Conserva todas las funciones existentes y añade el flujo autónomo sin mezclarlo
// con confirmLoyaltyVisit ni con la fidelidad comercial.
const existing = require("./index");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { safeSyncUserMissionsV2 } = require("./chabaquito-missions-v2-service");
const { createSelfCheckinHandler } = require("./self-checkin-callable");

Object.assign(exports, existing);

const db = getFirestore();
const selfCheckinHandler = createSelfCheckinHandler({
  db,
  Timestamp,
  safeSyncUserMissionsV2,
  HttpsError
});

exports.registerSelfCheckin = onCall(
  { region: "us-central1", enforceAppCheck: false },
  selfCheckinHandler
);
