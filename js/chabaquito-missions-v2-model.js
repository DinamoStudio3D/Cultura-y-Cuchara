/*
 * Misiones de Chabaquito V2 — contrato de datos (fase aislada).
 *
 * IMPORTANTE:
 * - Este archivo NO lee ni escribe Firestore todavía.
 * - NO reemplaza missionRewardCampaigns / missionRewardClaims ni el canje físico existente.
 * - Define y valida el modelo que usará la futura capa de misiones y recompensas digitales.
 */
(() => {
  'use strict';

  const MISSION_TYPES = Object.freeze(['category_visits', 'place_visits', 'canton_visits', 'total_visits']);
  const REWARD_TYPES = Object.freeze(['digital', 'digital_physical']);
  const STATUS = Object.freeze(['draft', 'active', 'paused', 'archived']);
  const BADGE_RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary']);

  const COLLECTIONS = Object.freeze({
    missions: 'chabaquitoMissions',
    userProgress: 'chabaquitoMissionProgress',
    userRewards: 'chabaquitoDigitalRewards'
  });

  function cleanText(value, max, field, required = true) {
    const text = String(value ?? '').trim();
    if (required && !text) throw new Error(`${field} es obligatorio.`);
    if (text.length > max) throw new Error(`${field} supera ${max} caracteres.`);
    return text;
  }

  function cleanId(value, field = 'ID') {
    const id = String(value ?? '').trim();
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) throw new Error(`${field} no es válido.`);
    return id;
  }

  function cleanPositiveInteger(value, field, max = 500) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > max) throw new Error(`${field} debe estar entre 1 y ${max}.`);
    return number;
  }

  function cleanStringList(value, field, maxItems = 100) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error(`${field} debe ser una lista.`);
    const unique = [...new Set(value.map(item => String(item ?? '').trim()).filter(Boolean))];
    if (unique.length > maxItems) throw new Error(`${field} supera ${maxItems} elementos.`);
    if (unique.some(item => item.length > 120)) throw new Error(`${field} contiene un valor demasiado largo.`);
    return unique;
  }

  function normalizeBadge(input = {}) {
    const rarity = String(input.rarity || 'common').trim();
    if (!BADGE_RARITIES.includes(rarity)) throw new Error('Rareza de insignia no válida.');
    return Object.freeze({
      title: cleanText(input.title, 80, 'Nombre de insignia'),
      description: cleanText(input.description, 240, 'Descripción de insignia'),
      icon: cleanText(input.icon || '🏅', 16, 'Icono de insignia'),
      imageUrl: cleanText(input.imageUrl, 1000, 'Imagen de insignia', false),
      rarity
    });
  }

  function normalizeMission(input = {}) {
    const type = String(input.type || '').trim();
    const rewardType = String(input.rewardType || 'digital').trim();
    const status = String(input.status || 'draft').trim();
    if (!MISSION_TYPES.includes(type)) throw new Error('Tipo de misión no válido.');
    if (!REWARD_TYPES.includes(rewardType)) throw new Error('Tipo de recompensa no válido.');
    if (!STATUS.includes(status)) throw new Error('Estado de misión no válido.');

    const mission = {
      id: cleanId(input.id, 'ID de misión'),
      title: cleanText(input.title, 100, 'Título'),
      description: cleanText(input.description, 500, 'Descripción'),
      type,
      targetCount: cleanPositiveInteger(input.targetCount, 'Meta'),
      categoryIds: cleanStringList(input.categoryIds, 'Categorías', 50),
      placeIds: cleanStringList(input.placeIds, 'Lugares', 100),
      cantonIds: cleanStringList(input.cantonIds, 'Cantones', 32),
      rewardType,
      badge: normalizeBadge(input.badge),
      physicalCampaignId: rewardType === 'digital_physical' ? cleanId(input.physicalCampaignId, 'Campaña física') : null,
      startsAt: input.startsAt || null,
      endsAt: input.endsAt || null,
      status,
      version: 1
    };

    if (type === 'category_visits' && mission.categoryIds.length === 0) throw new Error('La misión necesita al menos una categoría.');
    if (type === 'place_visits' && mission.placeIds.length === 0) throw new Error('La misión necesita al menos un lugar.');
    if (type === 'canton_visits' && mission.cantonIds.length === 0) throw new Error('La misión necesita al menos un cantón.');
    if (mission.startsAt && mission.endsAt && new Date(mission.startsAt).getTime() >= new Date(mission.endsAt).getTime()) throw new Error('La fecha final debe ser posterior a la inicial.');

    return Object.freeze(mission);
  }

  function normalizeProgress(input = {}) {
    const current = Number(input.current || 0);
    const target = cleanPositiveInteger(input.target, 'Meta de progreso');
    if (!Number.isInteger(current) || current < 0 || current > target) throw new Error('Progreso actual no válido.');
    return Object.freeze({
      missionId: cleanId(input.missionId, 'ID de misión'),
      userId: cleanText(input.userId, 128, 'Usuario'),
      current,
      target,
      completed: current >= target,
      qualifyingVisitIds: cleanStringList(input.qualifyingVisitIds, 'Visitas válidas', 500),
      completedAt: current >= target ? (input.completedAt || null) : null
    });
  }

  function buildDigitalReward({ mission, userId, unlockedAt = null }) {
    const normalizedMission = normalizeMission(mission);
    return Object.freeze({
      missionId: normalizedMission.id,
      userId: cleanText(userId, 128, 'Usuario'),
      badge: normalizedMission.badge,
      unlockedAt,
      source: 'chabaquito_mission_v2',
      version: 1
    });
  }

  window.visitaLojaChabaquitoMissionsV2 = Object.freeze({
    collections: COLLECTIONS,
    missionTypes: MISSION_TYPES,
    rewardTypes: REWARD_TYPES,
    statuses: STATUS,
    badgeRarities: BADGE_RARITIES,
    normalizeMission,
    normalizeProgress,
    buildDigitalReward
  });
})();
