"use strict";
// Reuse existing admin authentication, with a fixed destination for homepage photos.
const { createHandler } = require("./sign-event-image");
function createHomepageHandler(options = {}) {
  return createHandler({ ...options, folder: "visitaloja/homepage" });
}
module.exports = createHomepageHandler();
module.exports.createHandler = createHomepageHandler;
