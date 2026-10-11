'use strict';
const {createHandler}=require('./sign-event-image');
function createPlaceGalleryImageHandler(options={}){return createHandler({...options,folder:'visitaloja/places/gallery',mediaLabel:'fotografías de lugares'});}
module.exports=createPlaceGalleryImageHandler();module.exports.createHandler=createPlaceGalleryImageHandler;
