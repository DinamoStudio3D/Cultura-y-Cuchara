(function () {
  'use strict';
  const host = document.getElementById('chabaquitoSavedProgress');
  if (!host || !window.firebase || !firebase.apps.some(app => app.name === 'viveLojaPublic')) return;
  const auth = firebase.app('viveLojaPublic').auth();
  const db = firebase.app('viveLojaPublic').firestore();
  const status = document.getElementById('chabaquitoSavedStatus');
  const actions = document.getElementById('chabaquitoSavedActions');
  const answers = new Map();
  let user = null;
  let saved = new Set();
  let unsubscribe = null;
  let busy = false;
  const en = () => document.documentElement.lang === 'en';
  const tr = (es, english) => en() ? english : es;
  const names = { descubre: ['Conoce a Chabaquito', 'Meet Chabaquito'], cultura: ['El desafío lojano', 'The Loja challenge'] };
  let xp = 0;
  let error = '';

  function render() {
    actions.replaceChildren();
    if (!user) {
      status.textContent = tr('Inicia sesión para consultar tus objetivos guardados. La aventura de arriba sigue siendo una demostración.',
        'Sign in to view saved objectives. The adventure above remains a demo.');
      return;
    }
    status.textContent = error || tr(`${saved.size}/2 objetivos digitales guardados · ${xp} XP validados. El resto de la aventura aún es demostración.`,
      `${saved.size}/2 digital objectives saved · ${xp} validated XP. The rest of the adventure is still a demo.`);
    for (const id of ['descubre', 'cultura']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chabaquito-pilot-action disabled:opacity-50';
      button.textContent = `${en() ? names[id][1] : names[id][0]} · ${saved.has(id) ? tr('Guardado', 'Saved') : tr('Validar y guardar', 'Validate and save')}`;
      button.disabled = busy || saved.has(id) || !answers.has(id) || (id === 'cultura' && !saved.has('descubre'));
      button.title = !answers.has(id) ? tr('Resuelve primero esta pregunta en la demostración.', 'Answer this question in the demo first.') : '';
      button.addEventListener('click', () => save(id));
      actions.append(button);
    }
  }

  async function save(objectiveId) {
    if (!user || busy || !answers.has(objectiveId)) return;
    busy = true; error = ''; render();
    try {
      const response = await fetch('/api/chabaquito-digital', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ objectiveId, answers: answers.get(objectiveId) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || tr('No se pudo guardar.', 'Could not save.'));
      if (result.passed === false) throw new Error(tr('La respuesta no fue validada.', 'The answer was not validated.'));
      saved.add(objectiveId); xp = result.xp;
    } catch (cause) { error = cause.message; }
    finally { busy = false; render(); }
  }

  window.addEventListener('chabaquito:demo-answer', event => {
    const { objectiveId, answers: submitted } = event.detail || {};
    if (names[objectiveId] && Array.isArray(submitted)) answers.set(objectiveId, submitted);
    render();
  });
  async function start() {
    try {
      const response = await fetch('/api/chabaquito-digital', { cache: 'no-store' });
      if (!response.ok || (await response.json()).ready !== true) return;
    } catch (_) { return; }
    host.classList.remove('hidden');
    auth.onAuthStateChanged(nextUser => {
    if (unsubscribe) unsubscribe();
    user = nextUser; saved = new Set(); xp = 0; error = ''; answers.clear();
    if (user) {
      const currentUid = user.uid;
      unsubscribe = db.collection('chabaquitoExplorerProfiles').doc(currentUid).onSnapshot(snapshot => {
        if (auth.currentUser?.uid !== currentUid) return;
        xp = snapshot.exists ? Number(snapshot.data().validatedXp || 0) : 0;
        saved = new Set();
        // La vista privada se reconstruye desde evidencias validadas, no desde un dato local.
        db.collection('chabaquitoExplorerProfiles').doc(currentUid).collection('evidence').get()
          .then(result => { if (auth.currentUser?.uid !== currentUid) return;
            saved = new Set(result.docs.filter(doc => doc.data().status === 'validated' && doc.data().type === 'digital_objective')
              .map(doc => doc.data().sourceId).filter(id => /^pilot_(descubre|cultura)$/.test(id)).map(id => id.slice(6)));
            error = ''; render();
          }).catch(() => { error = tr('No se pudo leer el progreso guardado. Comprueba las reglas de Firebase.',
            'Could not read saved progress. Check Firebase rules.'); render(); });
      }, () => { error = tr('El progreso aún no está disponible. Comprueba las reglas de Firebase.',
        'Progress is not available yet. Check Firebase rules.'); render(); });
    } else unsubscribe = null;
    render();
    });
  }
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  start();
})();
