"use strict";
const { createHandler: createAdminHandler } = require("./sign-event-image");
function createHandler(options = {}) {
  return async (req, res) => {
    const { placeId, purpose } = req.body || {};
    if (req.method !== "POST") {
      res.setHeader("Cache-Control", "no-store");
      return res.status(405).json({ error: "Método no permitido." });
    }
    if (typeof placeId !== "string" || !/^[A-Za-z0-9_-]{1,180}$/.test(placeId) ||
        typeof purpose !== "string" || !/^(logo|hero|gallery)$/.test(purpose)) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(400).json({ error: "Destino de imagen inválido." });
    }
    // The shared handler verifies the Firebase identity and general admin role.
    // New draft IDs are allowed; publication and gallery limits are checked on save.
    return createAdminHandler({ ...options, folder: `visitaloja/places/${placeId}/${purpose}`,
      mediaLabel: "imágenes de paradas" })(req, res);
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
