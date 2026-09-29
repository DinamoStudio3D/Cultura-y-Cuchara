(function () {
  'use strict';
  const core = window.VisitaLojaChabaquitoV1Core;
  const catalog = window.VisitaLojaChabaquitoV1Pilot;
  const host = document.getElementById('chabaquitoPilotObjectives');
  if (!core || !catalog || !host) return;
  let mockEvidence = [];
  let sequence = Date.now();
  const isEnglish = () => document.documentElement.lang === 'en';
  const tr = (es, en) => isEnglish() ? en : es;
  const $ = id => document.getElementById(id);
  const node = (tag, className, text) => { const element = document.createElement(tag); element.className = className; if (text !== undefined) element.textContent = text; return element; };
  function notice(message) { $('chabaquitoPilotNotice').textContent = message; }
  function addMock(id) {
    const config = core.PILOT.objectives.find(objective => objective.id === id);
    const result = core.evaluateAdventure(core.PILOT, mockEvidence);
    if (!config || !result.availableObjectives.includes(id)) return;
    const sourceId = config.type === 'digital_objective' ? `pilot_${id}` : `mock_${config.pointId}`;
    mockEvidence.push({ type: config.type, sourceId, proofId: config.proofId, status: 'validated', verifiedAt: ++sequence });
    render();
    notice(result.completedObjectives.length === 4
      ? tr('¡Lo conseguiste! Encontraste todas las huellas de Chabaquito. +250 XP de aventura. Nueva insignia: Amigo de Chabaquito. ¡Subiste de nivel! Caminante de Loja — Nivel 2. Las evidencias presenciales siguen siendo simuladas.', 'You did it! You found all Chabaquito’s footprints. +250 adventure XP. New badge: Friend of Chabaquito. Level up! Loja Walker — Level 2. In-person evidence is still simulated.')
      : tr('Objetivo simulado. Esto no concede XP real ni guarda visitas.', 'Objective simulated. No real XP or visits were saved.'));
  }
  function quiz(form, objective) {
    const questions = objective.id === 'descubre' ? [{ text: objective.question, options: objective.options }] : objective.questions;
    for (const [index, question] of questions.entries()) {
      const group = node('fieldset', 'chabaquito-pilot-question');
      group.append(node('legend', 'font-semibold text-xs mb-2', question.text));
      for (const [optionIndex, option] of question.options.entries()) {
        const label = node('label', 'chabaquito-pilot-option');
        const input = document.createElement('input'); input.type = 'radio'; input.name = `pilot-${objective.id}-${index}`; input.value = String(optionIndex);
        label.append(input, document.createTextNode(` ${option}`)); group.append(label);
      }
      form.append(group);
    }
    const persistent = objective.id === 'descubre' && window.ChabaquitoV1Persistent;
    const button = node('button', 'chabaquito-pilot-action', persistent ? tr('Validar y guardar', 'Validate and save') : tr('Comprobar en simulación', 'Check in demo'));
    button.type = 'submit'; form.append(button);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const answer = index => form.querySelector(`input[name="pilot-${objective.id}-${index}"]:checked`)?.value;
      const answers = questions.map((_, index) => answer(index));
      if (answers.filter(value => value !== undefined).length < (objective.id === 'cultura' ? 2 : 1)) {
        notice(objective.id === 'cultura' ? tr('Selecciona al menos dos respuestas culturales.', 'Choose at least two cultural answers.') : tr('Selecciona una respuesta.', 'Choose an answer.')); return;
      }
      if (persistent) {
        button.disabled = true; notice(tr('Validando con el servidor…', 'Validating with the server…'));
        const saved = await window.ChabaquitoV1Persistent.completeFirstObjective(answers);
        button.disabled = false;
        if (!saved.ok) {
          notice(saved.code === 'AUTH_REQUIRED' ? tr('Inicia sesión para guardar este objetivo.', 'Sign in to save this objective.') : tr('No se pudo guardar todavía. Inténtalo nuevamente.', 'Could not save yet. Please try again.')); return;
        }
        if (!saved.passed) { notice(tr('Aún no lo conseguiste. Puedes intentarlo de nuevo.', 'Not quite. You can try again.')); return; }
        if (!mockEvidence.some(item => item.sourceId === 'pilot_descubre')) addMock('descubre');
        notice(saved.changed
          ? tr(`Objetivo validado y guardado. XP real acumulado: ${saved.xp}.`, `Objective validated and saved. Real XP total: ${saved.xp}.`)
          : tr(`Este objetivo ya estaba guardado. No se duplicó XP. XP real acumulado: ${saved.xp}.`, `This objective was already saved. XP was not duplicated. Real XP total: ${saved.xp}.`));
        return;
      }
      const correct = objective.id === 'descubre' ? answers[0] === '0' : answers.filter(value => value === '1').length >= 2;
      if (!correct) { notice(tr('Aún no lo conseguiste. Puedes intentarlo de nuevo sin límite.', 'Not quite. You can try again as often as you like.')); return; }
      addMock(objective.id);
    });
  }
  function render() {
    const state = core.evaluateAdventure(core.PILOT, mockEvidence);
    $('chabaquitoPilotCount').textContent = `${state.completedObjectives.length}/5`;
    $('chabaquitoPilotXp').textContent = `${state.xp}/500 XP · ${tr('vista piloto', 'pilot view')}`;
    const level = core.levelForXp(state.xp);
    $('chabaquitoPilotLevel').textContent = `${tr('Nivel', 'Level')} ${level} · ${isEnglish() ? ['Curious Traveler', 'Loja Walker', 'Loja Adventurer', 'Loja Explorer', 'Loja Connoisseur', 'Loja Guardian', 'Master Explorer', 'Loja Legend'][level - 1] : core.LEVELS[level - 1].name}`;
    $('chabaquitoPilotBadge').textContent = state.completed ? tr('Insignia piloto: Amigo de Chabaquito', 'Pilot badge: Friend of Chabaquito') : tr('Insignia pendiente', 'Badge pending');
    host.replaceChildren();
    for (const objective of catalog.objectives) {
      const done = state.completedObjectives.includes(objective.id); const available = state.availableObjectives.includes(objective.id);
      const display = isEnglish() ? { ...objective, ...catalog.english[objective.id] } : objective;
      const card = node('article', `chabaquito-pilot-card ${done ? 'is-done' : ''}`);
      card.append(node('span', 'chabaquito-pilot-state', done ? (objective.id === 'descubre' ? tr('Completado · validado', 'Completed · validated') : tr('Completado · simulación', 'Completed · demo')) : available ? tr('Disponible', 'Available') : tr('Bloqueado', 'Locked')));
      card.append(node('h4', 'text-lg font-black mt-2', display.title)); card.append(node('p', 'text-xs text-white/70 mt-2 leading-relaxed', display.description));
      card.append(node('p', 'text-xs text-amber-300 font-bold mt-3', `+${core.PILOT.objectives.find(item => item.id === objective.id).xp} XP`));
      if (objective.pointId) card.append(node('p', 'text-xs text-white/50 mt-2', `${objective.pointId} · ${tr('lugar por definir', 'place to be chosen')}`));
      if (available && objective.type === 'digital_objective') { const form = node('form', 'chabaquito-pilot-form mt-3'); quiz(form, display); card.append(form); }
      else if (available && objective.type !== 'digital_objective') {
        card.append(node('p', 'text-xs text-white/70 mt-3', objective.type === 'self_visit' ? tr('Ver ubicación · Validar mi visita / Escanear QR: pendientes de punto y backend seguros.', 'View location · Validate visit / Scan QR: awaiting a configured point and secure backend.') : tr('El encargado confirmará la visita por el flujo existente; no requiere compra.', 'Staff will confirm the visit through the existing flow; no purchase is required.'));
        const button = node('button', 'chabaquito-pilot-action mt-3', tr('Simular evidencia (sin guardar)', 'Simulate evidence (unsaved)')); button.type = 'button'; button.addEventListener('click', () => addMock(objective.id)); card.append(button);
      }
      host.append(card);
    }
  }
  $('chabaquitoPilotReset').addEventListener('click', () => { mockEvidence = []; render(); notice(tr('Vista piloto reiniciada. El progreso real guardado no se elimina.', 'Pilot view reset. Saved real progress is not deleted.')); });
  new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  render();
})();
