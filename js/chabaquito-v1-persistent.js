(function () {
  'use strict';
  // Only this explicit action saves a validated first objective. The demo stays in memory.
  const CONFIG = Object.freeze({ enabled: true, adventureId: 'tras-las-huellas-de-chabaquito',
    firstObjectiveId: 'descubre', endpoint: '/api/chabaquito-v1-objective' });
  const app = window.firebase?.apps.find(candidate => candidate.name === 'viveLojaPublic');
  const auth = app?.auth();
  const host = document.getElementById('chabaquitoSavedProgress');
  const status = document.getElementById('chabaquitoSavedStatus');
  const actions = document.getElementById('chabaquitoSavedActions');
  const catalog = window.VisitaLojaChabaquitoV1Pilot;
  let savedState = null, busy = false, message = '', generation = 0;
  const en = () => document.documentElement.lang === 'en';
  const tr = (es, english) => en() ? english : es;
  function getCurrentUser() { return auth?.currentUser || null; }
  function getState() {
    return Object.freeze({ enabled: CONFIG.enabled, authenticated: Boolean(getCurrentUser()),
      adventureId: CONFIG.adventureId, objectiveId: CONFIG.firstObjectiveId,
      persistenceReady: CONFIG.enabled && Boolean(getCurrentUser()) });
  }
  async function request(method, answers) {
    const user = getCurrentUser();
    if (!user) return { ok: false, code: 'AUTH_REQUIRED' };
    const version = generation;
    try {
      const token = await user.getIdToken();
      if (version !== generation || getCurrentUser()?.uid !== user.uid) return { ok: false, code: 'SESSION_CHANGED' };
      const response = await fetch(CONFIG.endpoint, { method, cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        ...(method === 'POST' ? { body: JSON.stringify({ adventureId: CONFIG.adventureId,
          objectiveId: CONFIG.firstObjectiveId, answers }) } : {}) });
      const payload = await response.json();
      if (version !== generation || getCurrentUser()?.uid !== user.uid) return { ok: false, code: 'SESSION_CHANGED' };
      if (!response.ok) return { ok: false, code: response.status === 401 ? 'AUTH_REQUIRED' : 'SERVER_ERROR' };
      return payload;
    } catch (_) { return { ok: false, code: 'NETWORK_ERROR' }; }
  }
  async function completeFirstObjective(answers) {
    if (!Array.isArray(answers) || answers.length !== 1 || !Number.isInteger(answers[0]) || answers[0] < 0 || answers[0] > 2) return { ok: false, code: 'INVALID_ANSWERS' };
    return request('POST', answers);
  }
  function render() {
    if (!host || !catalog) return;
    document.getElementById('chabaquitoSavedTitle').textContent = tr('Mi progreso guardado · primer objetivo', 'My saved progress · first objective');
    actions.replaceChildren();
    if (!getCurrentUser()) {
      status.textContent = tr('Inicia sesión para guardar el primer objetivo. La demostración de arriba no guarda progreso.',
        'Sign in to save the first objective. The demo above does not save progress.'); return;
    }
    const done = savedState?.completedObjectives?.includes('descubre');
    status.textContent = message || (busy ? tr('Consultando o guardando…', 'Loading or saving…') : done
      ? tr(`Primer objetivo guardado · ${savedState.adventureXp} XP de aventura.`, `First objective saved · ${savedState.adventureXp} adventure XP.`)
      : tr('Solo el primer objetivo puede guardarse en esta fase. Los demás siguen siendo demostración.',
        'Only the first objective can be saved in this phase. The others remain a demo.'));
    const refresh = document.createElement('button'); refresh.type = 'button';
    refresh.className = 'chabaquito-pilot-action'; refresh.textContent = tr('Actualizar progreso', 'Refresh progress'); refresh.disabled = busy;
    refresh.addEventListener('click', load); actions.append(refresh);
    if (done || !savedState || busy) return;
    const objective = catalog.objectives.find(item => item.id === 'descubre');
    const display = en() ? { ...objective, ...catalog.english.descubre } : objective;
    const form = document.createElement('form'); form.className = 'chabaquito-pilot-form mt-3';
    const group = document.createElement('fieldset'); const legend = document.createElement('legend');
    legend.textContent = display.question; group.append(legend);
    display.options.forEach((option, index) => {
      const label = document.createElement('label'); label.className = 'chabaquito-pilot-option';
      const input = document.createElement('input'); input.type = 'radio'; input.name = 'saved-chabaquito-answer'; input.value = String(index); input.required = true;
      label.append(input, document.createTextNode(` ${option}`)); group.append(label);
    });
    const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'chabaquito-pilot-action';
    submit.textContent = tr('Validar y guardar primer objetivo', 'Validate and save first objective');
    form.append(group, submit); actions.append(form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return;
      const selected = form.querySelector('input:checked'); if (!selected) return;
      const version = generation; busy = true; message = ''; render();
      const result = await completeFirstObjective([Number(selected.value)]);
      if (version !== generation) return;
      busy = false;
      if (result.ok && result.passed) { savedState = result; message = ''; }
      else message = result.code === 'SESSION_CHANGED' ? '' : result.ok
        ? tr('Respuesta incorrecta. Inténtalo de nuevo.', 'Incorrect answer. Try again.')
        : tr('No se pudo guardar. No se muestra XP como validado; actualiza o revisa tu sesión.', 'Could not save. No XP is shown as validated; refresh or check your session.');
      render();
    });
  }
  async function load() {
    if (!getCurrentUser() || busy) return;
    const version = generation; busy = true; message = ''; render();
    const result = await request('GET');
    if (version !== generation) return;
    busy = false;
    if (result.ok) savedState = result;
    else { savedState = null; message = tr('El progreso guardado no está disponible en esta Preview. La demostración sigue funcionando.',
      'Saved progress is unavailable in this Preview. The demo still works.'); }
    render();
  }
  window.ChabaquitoV1Persistent = Object.freeze({ config: CONFIG, getState, completeFirstObjective });
  if (!host || !auth) return;
  auth.onAuthStateChanged(() => { generation++; savedState = null; busy = false; message = ''; render(); load(); });
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  window.addEventListener('focus', () => { if (getCurrentUser() && !busy) load(); });
})();
