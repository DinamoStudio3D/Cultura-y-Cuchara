"use strict";

const { validateDigitalAnswer } = require("../functions/chabaquito-v1-digital");
const { persistDigitalCompletion } = require("../functions/chabaquito-v1-digital-service");
const core = require("../js/chabaquito-v1-core");
const { getAdminDb } = require("./_firebase-admin");

const { configuration } = require('./_firebase-environment');
const PRODUCTION_WEB_API_KEY = 'AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE';
const ADVENTURE_ID = "tras-las-huellas-de-chabaquito";
const OBJECTIVE_ID = "descubre";

function createHandler({ fetchImpl = fetch, env = process.env, dbFactory = getAdminDb } = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Método no permitido." });
    if (env.CHABAQUITO_V1_ENABLED !== "true") {
      return res.status(503).json({ error: "El progreso persistente de Chabaquito aún no está activado." });
    }

    const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization || "")?.[1];
    if (!token) return res.status(401).json({ error: "Debes iniciar sesión." });

    const { adventureId, objectiveId, answers } = req.body || {};
    if (req.method === "POST" && (adventureId !== ADVENTURE_ID || objectiveId !== OBJECTIVE_ID || !Array.isArray(answers))) {
      return res.status(400).json({ error: "Objetivo inválido." });
    }

    try {
      const target = configuration(env);
      const webApiKey = target.mode === 'preview' ? target.config.apiKey : PRODUCTION_WEB_API_KEY;
      const identity = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${webApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token })
      });
      if (!identity.ok) return res.status(401).json({ error: "La sesión ha caducado." });
      const user = (await identity.json()).users?.[0];
      if (!user?.localId || user.disabled) return res.status(401).json({ error: "La sesión no es válida." });

      if (req.method === "GET") {
        const profileRef = dbFactory(env).collection(core.COLLECTIONS.profiles).doc(user.localId);
        const [profile, progress] = await Promise.all([
          profileRef.get(), profileRef.collection("adventures").doc(ADVENTURE_ID).get()
        ]);
        const xp = profile.exists ? Number(profile.data().validatedXp || 0) : 0;
        const adventure = progress.exists ? progress.data() : {};
        return res.status(200).json({ ok: true, xp, level: core.levelForXp(xp),
          adventureXp: Number(adventure.xp || 0),
          completedObjectives: Array.isArray(adventure.completedObjectives) ? adventure.completedObjectives : [] });
      }

      let passed;
      try { passed = validateDigitalAnswer(objectiveId, answers); }
      catch (_) { return res.status(400).json({ error: "Respuestas no válidas." }); }
      if (!passed) return res.status(200).json({ ok: true, passed: false });

      const db = dbFactory(env);
      const saved = await persistDigitalCompletion({
        db,
        authenticatedUid: user.localId,
        objectiveId,
        now: Date.now()
      });
      return res.status(200).json({ ok: true, passed: true, ...saved });
    } catch (error) {
      console.error("[chabaquito-v1-objective]", error?.message || error);
      return res.status(503).json({ error: "No se pudo guardar el progreso del objetivo." });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
