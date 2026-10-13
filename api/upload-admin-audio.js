"use strict";
// Retained for old clients. Historical audio now uses sign-time-audio.
// Never allow this deprecated route to create commits or deploy production.
function createHandler() {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Método no permitido." });
    }
    return res.status(410).json({
      error: "Esta subida antigua ya no está disponible. Abre el administrador actualizado y utiliza Subir audio en Loja en el Tiempo.",
    });
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.config = { api: { bodyParser: false } };
