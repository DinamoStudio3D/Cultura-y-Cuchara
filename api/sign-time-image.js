'use strict';
const {createHandler} = require('./sign-event-image');
function createTimeImageHandler(options = {}) {
  return createHandler({...options, folder: 'visitaloja/time/images', mediaLabel: 'fotografías históricas'});
}
module.exports = createTimeImageHandler();
module.exports.createHandler = createTimeImageHandler;
