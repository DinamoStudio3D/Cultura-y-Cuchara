/* Local promotion preparation. This module never publishes or sends notifications. */
(function (root) {
  'use strict';
  function id(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw Error('Identificador inválido.');
    return value;
  }
  function text(value, max, optional = false) {
    if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > max) throw Error('Completa el título, el mensaje y las condiciones dentro de sus límites.');
    return value.trim();
  }
  function time(value) {
    if (!value) return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw Error('Revisa las fechas de la promoción.');
    const stamp = Date.parse(value + ':00-05:00');
    if (!Number.isFinite(stamp) || new Date(stamp - 5 * 3600000).toISOString().slice(0,16) !== value) throw Error('Revisa las fechas de la promoción.');
    return stamp;
  }
  function normalizeDraft(data) {
    const start = time(data.startsAt), end = time(data.endsAt);
    if ((start === null) !== (end === null) || (start !== null && start >= end)) throw Error('Indica inicio y fin, con el fin posterior al inicio, o deja ambas fechas vacías.');
    return {
      schemaVersion: 1, status: 'draft', placeId: id(data.placeId), promotionId: id(data.promotionId),
      title: text(data.title,120), message: text(data.message,500), conditions: text(data.conditions || '',400,true),
      startsAt: start === null ? '' : data.startsAt, endsAt: end === null ? '' : data.endsAt,
      audience: 'followers_with_promotion_consent', channel: 'inApp',
    };
  }
  function scheduleLabel(draft, now = Date.now()) {
    const data = normalizeDraft(draft), start = time(data.startsAt), end = time(data.endsAt);
    if (start === null) return 'Sin fechas';
    const stamp = new Date(now).getTime();
    if (!Number.isFinite(stamp)) throw Error('Fecha de referencia inválida.');
    return stamp < start ? 'Fechas futuras' : stamp >= end ? 'Fechas finalizadas' : 'Fechas vigentes';
  }
  function audienceMatches(draft, follower) {
    const data = normalizeDraft(draft);
    return follower?.placeId === data.placeId && follower.active === true && follower.promotions === true;
  }
  const api = { normalizeDraft, scheduleLabel, audienceMatches, time };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VisitaLojaLoyaltyPromotionPolicy = api;
})(typeof window === 'undefined' ? globalThis : window);
