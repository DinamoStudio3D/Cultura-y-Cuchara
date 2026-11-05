'use strict';
window.requestRewardsDraft = async function (auth, payload) {
  const user = auth.currentUser;
  if (!user) throw new Error('Inicia sesión.');
  const token = await user.getIdToken();
  if (auth.currentUser !== user) throw new Error('La sesión cambió.');
  const response = await fetch('/api/rewards-drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo contactar con el Centro de Recompensas.');
  return result;
};
