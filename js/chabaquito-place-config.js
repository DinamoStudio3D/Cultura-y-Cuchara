/* Contrato compartido Admin/backend. Catálogo: prefecturaloja.gob.ec/nuestros-cantones/ */
(function (root) {
  'use strict';
  const CANTONS = Object.freeze(['Calvas','Catamayo','Celica','Chaguarpamba','Espíndola','Gonzanamá','Loja','Macará','Olmedo','Paltas','Pindal','Puyango','Quilanga','Saraguro','Sozoranga','Zapotillo'].map(name => Object.freeze({ id: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''), name })));
  const METHODS = Object.freeze({ manager: 'merchant_confirmation', proximity: 'self_checkin', both: 'both' });
  const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  function methodFor(place) { return place.discovery?.method || Object.keys(METHODS).find(key => METHODS[key] === place.validationMode) || ''; }
  function authorizedMerchant(merchant, placeId) { return merchant?.active === true && Array.isArray(merchant.placeIds) && merchant.placeIds.includes(placeId) && (!merchant.role || ['owner','manager','staff','propietario','encargado'].includes(merchant.role)); }
  function readiness({ placeId, place = {}, qr, merchants = [] }) {
    const issues = [], method = methodFor(place);
    if (!validId(placeId)) issues.push('Guarda primero la parada para obtener su identidad.');
    if (place.active === false || (place.publicationStatus && place.publicationStatus !== 'published')) issues.push('La parada debe estar activa y publicada.');
    if (!CANTONS.some(c => c.id === place.cantonId)) issues.push('Selecciona un cantón válido de Loja.');
    if (!Object.hasOwn(METHODS, method)) issues.push('Selecciona un método válido.');
    if (!validId(place.discovery?.qrId) || !qr || qr.id !== place.discovery.qrId || qr.placeId !== placeId || qr.active !== true || qr.discoveryEnabled !== true) issues.push('El QR debe estar activo y asociado a esta parada.');
    if (['proximity','both'].includes(method) && (typeof place.lat !== 'number' || !Number.isFinite(place.lat) || Math.abs(place.lat) > 90 || typeof place.lng !== 'number' || !Number.isFinite(place.lng) || Math.abs(place.lng) > 180)) issues.push('Faltan coordenadas oficiales válidas.');
    if (['manager','both'].includes(method) && !merchants.some(m => authorizedMerchant(m, placeId))) issues.push('Falta un propietario o encargado activo asignado a esta parada.');
    return { ready: issues.length === 0, enabled: place.discovery?.enabled === true && issues.length === 0, method, mode: METHODS[method], issues };
  }
  const api = Object.freeze({ CANTONS, METHODS, methodFor, authorizedMerchant, readiness });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ChabaquitoPlaceConfig = api;
})(typeof window !== 'undefined' ? window : globalThis);
