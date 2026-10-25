/* Keep the map usable immediately; fetch its background when it is needed. */
(function(root){
 'use strict';
 function mount(layer,map,container){
  let loaded=false,observer=null;
  function load(){
   if(loaded)return;
   loaded=true;observer?.disconnect();map.off?.('movestart',load);
   layer.addTo(map);
   if(container)container.dataset.mapTiles='loaded';
  }
  if(!container||typeof root.IntersectionObserver!=='function'){load();return load;}
  container.dataset.mapTiles='waiting';
  try{
   observer=new root.IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))load();},{rootMargin:'450px 0px'});
   observer.observe(container);
   map.once?.('movestart',load);
  }catch(_){load();}
  return load;
 }
 root.VisitaLojaMapTileLoading={mount};
})(window);
