(function () {
  'use strict';

  // Chabaquito V1 — persistent mode bootstrap.
  // Safe by default: this module does not write to Firestore and stays disabled
  // until the server-side validation flow is explicitly enabled.
  const CONFIG = Object.freeze({
    enabled: false,
    adventureId: 'tras-las-huellas-de-chabaquito',
    firstObjectiveId: 'descubre'
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
      persistenceReady: false
    });
  }

  async function completeFirstObjective() {
    if (!CONFIG.enabled) {
      return { ok: false, code: 'PERSISTENCE_DISABLED' };
    }

    const user = getCurrentUser();
    if (!user) {
      return { ok: false, code: 'AUTH_REQUIRED' };
    }

    // Deliberately no client-side XP/Firestore write here. The next phase will
    // call a trusted server endpoint that validates the objective and records
    // evidence + XP idempotently.
    return { ok: false, code: 'SERVER_VALIDATION_NOT_CONNECTED' };
  }

  window.ChabaquitoV1Persistent = Object.freeze({
    config: CONFIG,
    getState,
    completeFirstObjective
  });
})();
