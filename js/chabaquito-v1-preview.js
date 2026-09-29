(function () {
  'use strict';
  const core = window.VisitaLojaChabaquitoV1Core;
  const catalog = window.VisitaLojaChabaquitoV1Pilot;
  const host = document.getElementById('chabaquitoPilotObjectives');
  if (!core || !catalog || !host) return;
  // Estado efímero de DEMOSTRACIÓN: nunca se envía a Firestore ni se guarda.
  let mockEvidence = [];
  let sequence = Date.now();
  const isEnglish = () => document.documentElement.lang === 'en';
  const tr = (es, en) => isEnglish() ? en : es;
  const $ = id => document.getElementById(id);
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function notice(message) { $('chabaquitoPilotNotice').textContent = message; }
  function addMock(id) {
    const config = core.PILOT.objectives.find(objective => objective.id === id);
    const result = core.evaluateAdventure(core.PILOT, mockEvidence);
    if (!config || !result.availableObjectives.includes(id)) return;
    const sourceId = config.type === 'digital_objective' ? `pilot_${id}` : `mock_${config.pointId}`;
    mockEvidence.push({ type: config.type, sourceId, proofId: config.proofId,
      status: 'validated', verifiedAt: ++sequence });
    render();
    notice(result.completedObjectives.length === 4
      ? tr('¡Lo conseguiste! Encontraste todas las huellas de Chabaquito. +250 XP de aventura. Nueva insignia: Amigo de Chabaquito. ¡Subiste de nivel! Caminante de Loja — Nivel 2. Todo es una simulación sin guardar.',
        'You did it! You found all Chabaquito’s footprints. +250 adventure XP. New badge: Friend of Chabaquito. Level up! Loja Walker — Level 2. This is an unsaved demo.')
      : tr('Objetivo simulado. Esto no concede XP real ni guarda visitas.', 'Objective simulated. No real XP or visits were saved.'));
  }
  function quiz(form, objective) {
    const questions = objective.id === 'descubre'
      ? [{ text: objective.question, options: objective.options }]
      : objective.questions;
    for (const [index, question] of questions.entries()) {
      const group = node('fieldset', 'chabaquito-pilot-question');
      group.append(node('legend', 'font-semibold text-xs mb-2', question.text));
      if (question.pending) {
        group.append(node('p', 'text-xs text-amber-300', tr('Contenido pendiente de verificar; no se califica.', 'Content pending verification; not graded.')));
      } else {
        for (const [optionIndex, option] of question.options.entries()) {
          const label = node('label', 'chabaquito-pilot-option');
          const input = document.createElement('input');
          input.type = 'radio'; input.name = `pilot-${objective.id}-${index}`; input.value = String(optionIndex);
          label.append(input, document.createTextNode(` ${option}`));
          group.append(label);
        }
      }
      form.append(group);
    }
    const button = node('button', 'chabaquito-pilot-action', tr('Comprobar en simulación', 'Check in demo'));
    button.type = 'submit'; form.append(button);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const answer = index => form.querySelector(`input[name="pilot-${objective.id}-${index}"]:checked`)?.value;
      const first = answer(0), second = answer(1);
      if (first === undefined || (objective.id === 'cultura' && second === undefined)) {
        notice(tr('Selecciona una respuesta para cada pregunta disponible.', 'Choose an answer for each available question.')); return;
      }
      // Claves visibles solo para la maqueta. El backend tendrá su propia validación.
      const correct = objective.id === 'descubre' ? first === '0' : Number(first === '1') + Number(second === '1') >= 2;
      if (!correct) { notice(tr('Aún no lo conseguiste. Puedes intentarlo de nuevo sin límite.', 'Not quite. You can try again as often as you like.')); return; }
      addMock(objective.id);
    });
  }
  function render() {
    const state = core.evaluateAdventure(core.PILOT, mockEvidence);
    $('chabaquitoPilotCount').textContent = `${state.completedObjectives.length}/5`;
    $('chabaquitoPilotXp').textContent = `${state.xp}/500 XP · ${tr('simulación', 'demo')}`;
    const level = core.levelForXp(state.xp);
    $('chabaquitoPilotLevel').textContent = `${tr('Nivel', 'Level')} ${level} · ${isEnglish() ? ['Curious Traveler', 'Loja Walker', 'Loja Adventurer', 'Loja Explorer', 'Loja Connoisseur', 'Loja Guardian', 'Master Explorer', 'Loja Legend'][level - 1] : core.LEVELS[level - 1].name}`;
    $('chabaquitoPilotBadge').textContent = state.completed ? tr('Insignia simulada: Amigo de Chabaquito', 'Demo badge: Friend of Chabaquito') : tr('Insignia pendiente', 'Badge pending');
    host.replaceChildren();
    for (const objective of catalog.objectives) {
      const done = state.completedObjectives.includes(objective.id);
      const available = state.availableObjectives.includes(objective.id);
      const display = isEnglish() ? { ...objective, ...catalog.english[objective.id] } : objective;
      const card = node('article', `chabaquito-pilot-card ${done ? 'is-done' : ''}`);
      card.append(node('span', 'chabaquito-pilot-state', done ? tr('Completado · simulación', 'Completed · demo') : available ? tr('Disponible · demostración', 'Available · demo') : tr('Bloqueado', 'Locked')));
      card.append(node('h4', 'text-lg font-black mt-2', display.title));
      card.append(node('p', 'text-xs text-white/70 mt-2 leading-relaxed', display.description));
      card.append(node('p', 'text-xs text-amber-300 font-bold mt-3', `+${core.PILOT.objectives.find(item => item.id === objective.id).xp} XP · ${tr('al validar en el futuro', 'after future validation')}`));
      if (objective.pointId) card.append(node('p', 'text-xs text-white/50 mt-2', `${objective.pointId} · ${tr('lugar por definir', 'place to be chosen')}`));
      if (available && objective.type === 'digital_objective') {
        const form = node('form', 'chabaquito-pilot-form mt-3'); quiz(form, display); card.append(form);
      } else if (available && objective.type !== 'digital_objective') {
        const hint = node('p', 'text-xs text-white/70 mt-3', objective.type === 'self_visit'
          ? tr('Ver ubicación · Validar mi visita / Escanear QR: pendientes de punto y backend seguros.', 'View location · Validate visit / Scan QR: awaiting a configured point and secure backend.')
          : tr('El encargado confirmará la visita por el flujo existente; no requiere compra.', 'Staff will confirm the visit through the existing flow; no purchase is required.'));
        card.append(hint);
        const button = node('button', 'chabaquito-pilot-action mt-3', tr('Simular evidencia (sin guardar)', 'Simulate evidence (unsaved)'));
        button.type = 'button'; button.addEventListener('click', () => addMock(objective.id)); card.append(button);
      }
      host.append(card);
    }
  }
  $('chabaquitoPilotReset').addEventListener('click', () => {
    mockEvidence = []; render(); notice(tr('Demostración reiniciada. No se modificó ningún dato real.', 'Demo reset. No real data was changed.'));
  });
  new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  render();
})();
