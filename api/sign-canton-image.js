'use strict';
const {createHandler}=require('./sign-event-image');
function createCantonImageHandler(options={}){return createHandler({...options,folder:'visitaloja/cantons/covers',mediaLabel:'portadas de cantones'});}
module.exports=createCantonImageHandler();module.exports.createHandler=createCantonImageHandler;
