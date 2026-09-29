(function () {
  'use strict';

  // Persistent Chabaquito V1 client. XP is never written by the browser:
  // authenticated answers go to the trusted Vercel API for validation + storage.
  const CONFIG = Object.freeze({
    enabled: true,
    adventureId: 'tras-las-huellas-de-chabaquito',
    firstObjectiveId: 'descubre',
    endpoint: '/api/chabaquito-v1-objective'
  });

  function getCurrentUser() {
    const auth = window.visitorAuth;
    return auth && auth.currentUser ? auth.currentUser : null;
  }

  function getState() {
    const user = getCurrentUser();
    return Object.freeze({
      enabled: CONFIG.enabled,
      authenticated: Boolean(user),
      uid: user ? user.uid : null,
      adventureId: CONFIG.adventureId,
      objectiveId: CONFIG.firstObjectiveId,
      persistenceReady: CONFIG.enabled && Boolean(user)
    });
  }

  async function completeFirstObjective(answers) {
    if (!CONFIG.enabled) return { ok: false, code: 'PERSISTENCE_DISABLED' };
    const user = getCurrentUser();
    if (!user) return { ok: false, code: 'AUTH_REQUIRED' };
    if (!Array.isArray(answers)) return { ok: false, code: 'INVALID_ANSWERS' };

    let token;
    try {
      token = await user.getIdToken();
    } catch (_) {
      return { ok: false, code: 'TOKEN_ERROR' };
    }

    let response;
    try {
      response = await fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adventureId: CONFIG.adventureId,
          objectiveId: CONFIG.firstObjectiveId,
          answers
        })
      });
    } catch (_) {
      return { ok: false, code: 'NETWORK_ERROR' };
    }

    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (response.status === 401) return { ok: false, code: 'AUTH_REQUIRED', ...payload };
    if (!response.ok) return { ok: false, code: 'SERVER_ERROR', status: response.status, ...payload };
    if (!payload.passed) return { ok: true, passed: false, code: 'TRY_AGAIN' };

    return {
      ok: true,
      passed: true,
      saved: true,
      changed: Boolean(payload.changed),
      xp: Number(payload.xp || 0),
      adventureXp: Number(payload.adventureXp || 0),
      completedObjectives: Array.isArray(payload.completedObjectives) ? payload.completedObjectives : []
    };
  }

  window.ChabaquitoV1Persistent = Object.freeze({
    config: CONFIG,
    getState,
    completeFirstObjective
  });
})();
