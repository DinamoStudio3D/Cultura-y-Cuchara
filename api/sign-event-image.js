"use strict";
const crypto = require("node:crypto");
const PROJECT_ID = "cultura-y-cuchara";
const WEB_API_KEY = "AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE";
const LEGACY_ADMIN_EMAIL = "sukogames1996@gmail.com";
function createHandler({
  fetchImpl = fetch,
  env = process.env,
  now = Date.now,
  folder = "visitaloja/events/posters",
  usePreset = true,
  mediaLabel = "afiche",
} = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST")
      return res.status(405).json({ error: "Método no permitido." });
    const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(
      req.headers.authorization || "",
    )?.[1];
    if (!token) return res.status(401).json({ error: "Debes iniciar sesión." });
    const { cloudName, apiKey, apiSecret, uploadPreset } = {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
      uploadPreset: env.CLOUDINARY_UPLOAD_PRESET,
    };
    if (
      ![
        cloudName,
        apiKey,
        apiSecret,
        ...(usePreset ? [uploadPreset] : []),
      ].every((v) => typeof v === "string" && v.trim())
    )
      return res
        .status(503)
        .json({ error: "Cloudinary no está configurado en este despliegue." });
    if (
      !/^[A-Za-z0-9_-]+$/.test(cloudName) ||
      !/^[A-Za-z0-9_-]+$/.test(apiKey) ||
      (usePreset && !/^[A-Za-z0-9_-]+$/.test(uploadPreset))
    )
      return res
        .status(503)
        .json({ error: "Configuración de Cloudinary inválida." });
    try {
      const identity = await fetchImpl(
        "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" +
          WEB_API_KEY,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
        },
      );
      if (!identity.ok)
        return res.status(401).json({ error: "La sesión ha caducado." });
      const user = (await identity.json()).users?.[0];
      if (!user?.localId || user.disabled)
        return res.status(401).json({ error: "La sesión no es válida." });
      let claims = {};
      try {
        claims = JSON.parse(user.customAttributes || "{}");
      } catch (_) {}
      let authorized =
        String(user.email || "").toLowerCase() === LEGACY_ADMIN_EMAIL ||
        claims.admin === true ||
        claims.role === "admin" ||
        claims.role === "owner";
      if (!authorized) {
        const profile = await fetchImpl(
          "https://firestore.googleapis.com/v1/projects/" +
            PROJECT_ID +
            "/databases/(default)/documents/adminUsers/" +
            encodeURIComponent(user.localId),
          { headers: { Authorization: "Bearer " + token } },
        );
        if (profile.ok) {
          const fields = (await profile.json()).fields || {};
          authorized =
            fields.active?.booleanValue === true &&
            ["admin", "owner"].includes(fields.role?.stringValue);
        }
      }
      if (!authorized)
        return res
          .status(403)
          .json({
            error: `Solo los administradores pueden subir ${mediaLabel}.`,
          });
      const params = { folder, timestamp: Math.floor(now() / 1000) };
      if (usePreset) params.upload_preset = uploadPreset;
      const signature = crypto
        .createHash("sha1")
        .update(
          Object.keys(params)
            .sort()
            .map((k) => k + "=" + params[k])
            .join("&") + apiSecret,
        )
        .digest("hex");
      return res.status(200).json({ cloudName, apiKey, params, signature });
    } catch (error) {
      console.error("sign-event-image", error);
      return res
        .status(503)
        .json({ error: `No se pudo autorizar el ${mediaLabel}.` });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
