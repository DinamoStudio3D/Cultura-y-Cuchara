"use strict";

const crypto = require("node:crypto");

const PROJECT_ID = "cultura-y-cuchara";
const WEB_API_KEY = "AIzaSyAfPB59mntjuK7Yi8H-Bn9fUGdpJzTrRYE";
const PLACE_ID = /^[A-Za-z0-9_-]{1,180}$/;
const PURPOSE = /^(logo|hero|gallery)$/;

function publicIdFromCloudinaryUrl(url, cloudName) {
  if (typeof url !== "string" || !url) return null;
  let parsed;
  try { parsed = new URL(url); } catch (_) { return null; }
  if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") return null;
  const prefix = `/${cloudName}/image/upload/`;
  if (!parsed.pathname.startsWith(prefix)) return null;
  let rest = decodeURIComponent(parsed.pathname.slice(prefix.length));
  rest = rest.replace(/^v\d+\//, "");
  const dot = rest.lastIndexOf(".");
  if (dot > rest.lastIndexOf("/")) rest = rest.slice(0, dot);
  return rest || null;
}

function createHandler({ fetchImpl = fetch, env = process.env, now = Date.now } = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (env.VERCEL_ENV === "preview") return res.status(503).json({ error: "La limpieza Cloudinary está desactivada en esta Preview aislada." });
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
    const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization || "")?.[1];
    if (!token) return res.status(401).json({ error: "Debes iniciar sesión." });
    const { placeId, purpose, url } = req.body || {};
    if (!PLACE_ID.test(placeId || "") || !PURPOSE.test(purpose || "") || typeof url !== "string") {
      return res.status(400).json({ error: "Imagen inválida." });
    }
    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) return res.status(503).json({ error: "Cloudinary aún no está configurado." });

    try {
      const identity = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token })
      });
      if (!identity.ok) return res.status(401).json({ error: "La sesión ha caducado." });
      const user = (await identity.json()).users?.[0];
      if (!user?.localId || user.disabled) return res.status(401).json({ error: "La sesión no es válida." });

      const merchantUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/missionRewardMerchants/${encodeURIComponent(user.localId)}`;
      const merchantResponse = await fetchImpl(merchantUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!merchantResponse.ok) return res.status(403).json({ error: "Negocio no autorizado." });
      const fields = (await merchantResponse.json()).fields || {};
      const active = fields.active?.booleanValue === true;
      const placeIds = (fields.placeIds?.arrayValue?.values || []).map(value => value.stringValue);
      if (!active || !placeIds.includes(placeId)) return res.status(403).json({ error: "Negocio no autorizado para esta parada." });

      const publicId = publicIdFromCloudinaryUrl(url, cloudName);
      const expectedPrefix = `visitaloja/places/${placeId}/${purpose}/`;
      if (!publicId || !publicId.startsWith(expectedPrefix)) {
        return res.status(200).json({ skipped: true });
      }

      const timestamp = Math.floor(now() / 1000);
      // Every signed request parameter (except api_key/signature/file/cloud_name)
      // must be part of Cloudinary's canonical string, alphabetically ordered.
      const toSign = `invalidate=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash("sha1").update(toSign).digest("hex");
      const form = new URLSearchParams({
        invalidate: "true",
        public_id: publicId,
        timestamp: String(timestamp),
        api_key: apiKey,
        signature
      });
      const destroy = await fetchImpl(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString()
      });
      const result = await destroy.json().catch(() => ({}));
      if (!destroy.ok || !["ok", "not found"].includes(result.result)) {
        console.error("cloudinary-destroy", destroy.status, result.error?.message || result.result || "unknown");
        return res.status(502).json({ error: "No se pudo limpiar la imagen anterior." });
      }
      return res.status(200).json({ deleted: result.result === "ok", notFound: result.result === "not found" });
    } catch (error) {
      console.error("delete-merchant-image", error);
      return res.status(503).json({ error: "No se pudo limpiar la imagen anterior." });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.publicIdFromCloudinaryUrl = publicIdFromCloudinaryUrl;

