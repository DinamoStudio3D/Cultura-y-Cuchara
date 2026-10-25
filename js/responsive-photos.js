/* Deterministic display variants; the source URL remains the full photograph. */
(function(root){
 'use strict';
 const widths={'centro-loja-torre-reloj':1440,'jipiro-pagoda-laguna':1800,'jipiro-laguna':1800,'atardecer-loja':1800,'panoramica-loja-blanco-negro':1800,'hecho-en-loja-talento':1440};
 function sources(src){
  try{
   const base=new URL(root.location.href),url=new URL(src,base);
   if(url.origin!==base.origin||url.search||url.hash)return '';
   const match=url.pathname.match(/^\/assets\/photos\/([a-z0-9-]+)\.webp$/),name=match?.[1];
   if(!widths[name])return '';
   return '/assets/photos/responsive/'+name+'-640.webp 640w, /assets/photos/responsive/'+name+'-1280.webp 1280w, /assets/photos/'+name+'.webp '+widths[name]+'w';
  }catch(_){return '';}
 }
 function set(image,src,sizes='100vw'){
  const candidates=sources(src);
  image.removeAttribute('srcset');image.removeAttribute('sizes');
  if(candidates){image.setAttribute('sizes',sizes);image.setAttribute('srcset',candidates);}
  image.src=src;return image;
 }
 root.VisitaLojaResponsivePhotos={sources,set};
})(window);
