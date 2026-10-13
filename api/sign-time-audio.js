"use strict";
const { createHandler } = require("./sign-event-image");
function createTimeAudioHandler(options = {}) {
  return createHandler({
    ...options,
    folder: "visitaloja/time/audio",
    usePreset: false,
    mediaLabel: "audio",
  });
}
module.exports = createTimeAudioHandler();
module.exports.createHandler = createTimeAudioHandler;
