(function(root){
  'use strict';
  const DAY = 86400000;
  function ecuadorDate(value) {
    if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) throw new Error('Usa fechas válidas para la temporada.');
    const ms = Date.parse(value + 'T00:00:00-05:00');
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new Error('Usa fechas válidas para la temporada.');
    return ms;
  }
  function normalize(input) {
    const result = {};
    const {seasonStart, seasonEnd, imageUrl} = input;
    if (seasonStart || seasonEnd) {
      const start = ecuadorDate(seasonStart);
      const end = ecuadorDate(seasonEnd);
      if (end < start || end - start >= 365 * DAY) throw new Error('La temporada debe durar entre 1 y 365 días.');
      Object.assign(result, {seasonStart, seasonEnd});
    }
    if (imageUrl) {
      let url;
      try { if (typeof imageUrl === 'string' && imageUrl.length <= 1000) url = new URL(imageUrl); } catch (_) {}
      if (!url || url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password ||
          url.port || !/^\/[^/]+\/image\/upload\//.test(url.pathname)) {
        throw new Error('Usa un enlace HTTPS de una imagen subida a Cloudinary.');
      }
      result.imageUrl = url.href;
    }
    return result;
  }
  function windowFor(draft, nowMs) {
    const starts = draft.seasonStart ? Math.max(nowMs, ecuadorDate(draft.seasonStart)) : nowMs;
    const expiry = draft.seasonEnd ? ecuadorDate(draft.seasonEnd) + DAY : nowMs + draft.validityDays * DAY;
    if (expiry <= starts) throw new Error('La temporada ya terminó.');
    return {startsAt: new Date(starts), expiresAt: new Date(expiry)};
  }
  const api = {normalize, windowFor};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VisitaLojaRewardSeason = api;
})(typeof window === 'object' ? window : globalThis);
