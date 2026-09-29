"use strict";

const PROJECT_ID = "cultura-y-cuchara";
const WEB_API_KEY = "AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE";
const ADVENTURE_ID = "tras-las-huellas-de-chabaquito";
const OBJECTIVE_ID = "digital-1";

function createHandler({ fetchImpl = fetch, env = process.env } = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
    if (env.CHABAQUITO_V1_ENABLED !== "true") {
      return res.status(503).json({ error: "El progreso persistente de Chabaquito aún no está activado." });
    }

    const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization || "")?.[1];
    if (!token) return res.status(401).json({ error: "Debes iniciar sesión." });

    const { adventureId, objectiveId, answers } = req.body || {};
    if (adventureId !== ADVENTURE_ID || objectiveId !== OBJECTIVE_ID || !Array.isArray(answers)) {
      return res.status(400).json({ error: "Objetivo inválido." });
    }

    try {
      const identity = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token })
      });
      if (!identity.ok) return res.status(401).json({ error: "La sesión ha caducado." });
      const user = (await identity.json()).users?.[0];
      if (!user?.localId || user.disabled) return res.status(401).json({ error: "La sesión no es válida." });

      // The endpoint is intentionally fail-closed until trusted persistence is
      // connected. Correct answers and XP are not accepted from the browser.
      // A later commit will validate answers here and perform an idempotent,
      // server-authorized Firestore write.
      return res.status(503).json({
        error: "La validación persistente todavía no está conectada.",
        code: "PERSISTENCE_NOT_CONNECTED"
      });
    } catch (_) {
      return res.status(503).json({ error: "No se pudo validar el objetivo." });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
