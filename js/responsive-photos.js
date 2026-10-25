/* Deterministic display variants; the source URL remains the full photograph. */
(function(root){
 'use strict';
 const widths={'centro-loja-torre-reloj':1440,'jipiro-pagoda-laguna':1800,'jipiro-laguna':1800,'atardecer-loja':1800,'panoramica-loja-blanco-negro':1800,'hecho-en-loja-talento':1440};
 const fallbacks=new WeakMap();
 function sources(src){
  try{
   const base=new URL(root.location.href),url=new URL(src,base);
   if(url.protocol==='https:'&&url.hostname==='res.cloudinary.com'&&!url.username&&!url.password&&!url.search&&!url.hash){
    // Only untransformed, versioned public upload URLs returned by our uploader.
    const cloud=url.pathname.match(/^\/([a-zA-Z0-9_-]+)\/image\/upload\/(v[0-9]+\/[a-zA-Z0-9_./%-]+\.(?:webp|jpg|jpeg|png|avif))$/);
    if(cloud)return [640,1280,1920].map(width=>url.origin+'/'+cloud[1]+'/image/upload/c_limit,w_'+width+'/f_auto/q_auto:best/'+cloud[2]+' '+width+'w').join(', ');
   }
   if(url.origin!==base.origin||url.search||url.hash)return '';
   const match=url.pathname.match(/^\/assets\/photos\/([a-z0-9-]+)\.webp$/),name=match?.[1];
   if(!widths[name])return '';
   return '/assets/photos/responsive/'+name+'-640.webp 640w, /assets/photos/responsive/'+name+'-1280.webp 1280w, /assets/photos/'+name+'.webp '+widths[name]+'w';
  }catch(_){return '';}
 }
 function set(image,src,sizes='100vw'){
  const candidates=sources(src);
  const previous=fallbacks.get(image);if(previous)image.removeEventListener?.('error',previous);
  fallbacks.delete(image);
  image.removeAttribute('srcset');image.removeAttribute('sizes');
  if(candidates){
   image.setAttribute('sizes',sizes);image.setAttribute('srcset',candidates);
   const fallback=event=>{
    if(fallbacks.get(image)!==fallback)return;
    image.removeEventListener?.('error',fallback);fallbacks.delete(image);
    if(image.getAttribute('src')!==src||!image.getAttribute('srcset'))return;
    event.stopImmediatePropagation?.();
    image.removeAttribute('srcset');image.removeAttribute('sizes');image.src=src;
   };
   image.addEventListener?.('error',fallback,{once:true});fallbacks.set(image,fallback);
  }
  image.src=src;return image;
 }
 root.VisitaLojaResponsivePhotos={sources,set};
})(window);
