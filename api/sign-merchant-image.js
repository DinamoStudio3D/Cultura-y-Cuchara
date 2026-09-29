"use strict";

const { createMerchantImageSignature } = require("../functions/merchant-image-signing");

const PROJECT_ID = "cultura-y-cuchara";
const WEB_API_KEY = "AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE";

function createHandler({ fetchImpl = fetch, env = process.env, now = Date.now } = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
    const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization || "")?.[1];
    if (!token) return res.status(401).json({ error: "Debes iniciar sesión." });
    const { placeId, purpose } = req.body || {};
    if (typeof placeId !== "string" || typeof purpose !== "string" ||
        !/^[A-Za-z0-9_-]{1,180}$/.test(placeId) || !/^(logo|hero|gallery)$/.test(purpose)) {
      return res.status(400).json({ error: "Destino de imagen inválido." });
    }
    const credentials = {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
      uploadPreset: env.CLOUDINARY_UPLOAD_PRESET
    };
    if (Object.values(credentials).some(value => !value)) {
      return res.status(503).json({ error: "Cloudinary aún no está configurado." });
    }
    try {
      // Identity Toolkit verifies the ID token. The subsequent Firestore request
      // uses that same token, so existing security rules enforce owner-only read.
      const identity = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token })
      });
      if (!identity.ok) return res.status(401).json({ error: "La sesión ha caducado." });
      const user = (await identity.json()).users?.[0];
      if (!user?.localId || user.disabled) return res.status(401).json({ error: "La sesión no es válida." });
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/missionRewardMerchants/${encodeURIComponent(user.localId)}`;
      const merchantResponse = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!merchantResponse.ok) return res.status(403).json({ error: "Negocio no autorizado." });
      const fields = (await merchantResponse.json()).fields || {};
      const merchant = {
        active: fields.active?.booleanValue === true,
        placeIds: (fields.placeIds?.arrayValue?.values || []).map(value => value.stringValue)
      };
      const signature = createMerchantImageSignature({
        merchant, placeId, purpose, credentials, timestamp: Math.floor(now() / 1000)
      });
      return res.status(200).json(signature);
    } catch (error) {
      if (error.message === "Parada no autorizada.") {
        return res.status(403).json({ error: "Negocio no autorizado para esta parada." });
      }
      return res.status(503).json({ error: "No se pudo autorizar la imagen." });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
