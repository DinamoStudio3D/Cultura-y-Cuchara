"use strict";

const EARTH_RADIUS_M = 6371000;
const DEFAULT_RADIUS_M = 120;
const MIN_RADIUS_M = 30;
const MAX_RADIUS_M = 500;
const MAX_ACCEPTED_ACCURACY_M = 100;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validCoordinates(lat, lng) {
  return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function radians(value) { return value * Math.PI / 180; }

function distanceMeters(a, b) {
  const lat1 = finiteNumber(a?.lat), lng1 = finiteNumber(a?.lng);
  const lat2 = finiteNumber(b?.lat), lng2 = finiteNumber(b?.lng);
  if (!validCoordinates(lat1, lng1) || !validCoordinates(lat2, lng2)) throw new Error("Coordenadas inválidas.");
  const dLat = radians(lat2 - lat1), dLng = radians(lng2 - lng1);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function placeCoordinates(place) {
  const lat = finiteNumber(place?.lat ?? place?.latitude ?? place?.location?.lat ?? place?.location?.latitude);
  const lng = finiteNumber(place?.lng ?? place?.longitude ?? place?.location?.lng ?? place?.location?.longitude);
  if (!validCoordinates(lat, lng)) throw new Error("El lugar no tiene coordenadas válidas para self-check-in.");
  return { lat, lng };
}

function allowedRadius(place) {
  const configured = finiteNumber(place?.selfCheckinRadiusM);
  if (configured === null) return DEFAULT_RADIUS_M;
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, configured));
}

function validateProximity({ place, latitude, longitude, accuracy }) {
  const userLat = finiteNumber(latitude), userLng = finiteNumber(longitude), accuracyM = finiteNumber(accuracy);
  if (!validCoordinates(userLat, userLng)) throw new Error("No se pudo obtener una ubicación válida.");
  if (accuracyM === null || accuracyM <= 0 || accuracyM > MAX_ACCEPTED_ACCURACY_M) {
    throw new Error("La ubicación no tiene suficiente precisión. Acércate al atractivo e inténtalo nuevamente.");
  }
  const target = placeCoordinates(place);
  const distanceM = distanceMeters({ lat: userLat, lng: userLng }, target);
  const radiusM = allowedRadius(place);
  if (distanceM > radiusM) throw new Error(`Debes estar cerca del atractivo para registrar la visita. Distancia aproximada: ${Math.round(distanceM)} m.`);
  return { ok: true, distanceM: Math.round(distanceM), radiusM, accuracyM: Math.round(accuracyM) };
}

module.exports = { DEFAULT_RADIUS_M, MIN_RADIUS_M, MAX_RADIUS_M, MAX_ACCEPTED_ACCURACY_M, distanceMeters, placeCoordinates, allowedRadius, validateProximity };
