"use strict";
const { createHandler: adminHandler } = require("./sign-event-image");
function createTimeAudioHandler(options = {}) {
  return async function(req, res) {
    const purpose = req.query?.purpose ?? "time";
    if (purpose !== "time" && purpose !== "story") {
      res.setHeader("Cache-Control", "no-store");
      return res.status(400).json({error:"Destino de audio no válido."});
    }
    return adminHandler({...options, folder: purpose === "story" ? "visitaloja/stories/audio" : "visitaloja/time/audio",
      usePreset:false, mediaLabel:"audio"})(req, res);
  };
}
module.exports = createTimeAudioHandler();
module.exports.createHandler = createTimeAudioHandler;
