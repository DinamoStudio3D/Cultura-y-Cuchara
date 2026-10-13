'use strict';
const {createHandler}=require('./sign-event-image');
const DESTINATIONS=Object.freeze({time:{folder:'visitaloja/time/images',mediaLabel:'fotografías históricas'},canton:{folder:'visitaloja/cantons/covers',mediaLabel:'portadas de cantones'},gallery:{folder:'visitaloja/places/gallery',mediaLabel:'fotografías de lugares'}});
function createTimeImageHandler(options={}){
 return async function(req,res){const purpose=req.query?.purpose??'time';if(typeof purpose!=='string'||!Object.hasOwn(DESTINATIONS,purpose)){res.setHeader('Cache-Control','no-store');return res.status(400).json({error:'Destino de imagen no válido.'});}return createHandler({...options,...DESTINATIONS[purpose]})(req,res);};
}
module.exports=createTimeImageHandler();module.exports.createHandler=createTimeImageHandler;
