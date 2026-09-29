(function (global) {
  'use strict';

  const CANONICAL_ORIGIN = 'https://www.visitaloja.com';

  function bytesToBase64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function generateToken(byteLength = 24) {
    if (!global.crypto?.getRandomValues) throw new Error('Este navegador no permite generar un QR seguro.');
    const bytes = new Uint8Array(byteLength);
    global.crypto.getRandomValues(bytes);
    return bytesToBase64Url(bytes);
  }

  async function sha256Hex(value) {
    if (!global.crypto?.subtle) throw new Error('Este navegador no permite proteger el token del QR.');
    const data = new TextEncoder().encode(String(value || ''));
    const digest = await global.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function buildUrl(placeId, token, origin = CANONICAL_ORIGIN) {
    const id = String(placeId || '').trim();
    const secret = String(token || '').trim();
    if (!id || !secret) throw new Error('Lugar y token son obligatorios.');
    const url = new URL('/fidelidad.html', origin);
    url.searchParams.set('checkin', id);
    url.searchParams.set('mode', 'self');
    url.searchParams.set('token', secret);
    return url.toString();
  }

  async function createOrRotate({ db, placeId, actorUid = '', actorEmail = '' }) {
    if (!db) throw new Error('Firestore no está disponible.');
    const id = String(placeId || '').trim();
    if (!id) throw new Error('Selecciona un lugar.');

    const token = generateToken();
    const tokenHash = await sha256Hex(token);
    const ref = db.collection('selfCheckinQrSecrets').doc(id);
    const existing = await ref.get();
    const now = global.firebase?.firestore?.FieldValue?.serverTimestamp
      ? global.firebase.firestore.FieldValue.serverTimestamp()
      : new Date();

    const payload = {
      placeId: id,
      tokenHash,
      active: true,
      updatedAt: now,
      updatedByUid: actorUid || '',
      updatedByEmail: actorEmail || ''
    };
    if (!existing.exists) payload.createdAt = now;

    await ref.set(payload, { merge: true });
    return { token, tokenHash, url: buildUrl(id, token), rotated: existing.exists };
  }

  async function deactivate({ db, placeId, actorUid = '', actorEmail = '' }) {
    if (!db) throw new Error('Firestore no está disponible.');
    const id = String(placeId || '').trim();
    if (!id) throw new Error('Selecciona un lugar.');
    const now = global.firebase?.firestore?.FieldValue?.serverTimestamp
      ? global.firebase.firestore.FieldValue.serverTimestamp()
      : new Date();
    await db.collection('selfCheckinQrSecrets').doc(id).set({
      active: false,
      updatedAt: now,
      updatedByUid: actorUid || '',
      updatedByEmail: actorEmail || ''
    }, { merge: true });
  }

  global.VisitaLojaSelfCheckinQr = Object.freeze({
    CANONICAL_ORIGIN,
    generateToken,
    sha256Hex,
    buildUrl,
    createOrRotate,
    deactivate
  });
})(window);
