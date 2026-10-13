/* Read-only framing preview beside existing controls; never saves or uploads. */
(function(){
 'use strict';
 const form=document.getElementById('settingsForm'),images=document.getElementById('settingsHeroImages');
 if(!form||!images)return;
 const panel=document.createElement('div');panel.className='rounded-2xl border border-gray-700 p-4 space-y-3';
 const title=document.createElement('strong');title.textContent='Vista previa del encuadre de las fotografías';panel.append(title);
 const help=document.createElement('p');help.className='text-xs text-gray-400';help.textContent='Primera imagen del carrusel. Revisa el motivo principal en escritorio y móvil antes de publicar. La composición completa se revisa en la Preview.';panel.append(help);
 const grid=document.createElement('div');grid.className='grid md:grid-cols-2 gap-4';panel.append(grid);
 const previews=['Escritorio','Móvil'].map((label,index)=>{
  const box=document.createElement('div'),caption=document.createElement('p'),image=document.createElement('img');
  caption.className='text-sm font-semibold mb-2';caption.textContent=label;
  image.id=index?'settingsHeroMobilePreview':'settingsHeroDesktopPreview';image.alt='Vista previa de encuadre en '+label.toLowerCase();image.className='w-full rounded-xl bg-black/30 object-cover';image.style.height=index?'240px':'160px';
  if(index){image.style.maxWidth='240px';image.style.margin='0 auto';}
  box.append(caption,image);grid.append(box);return image;
 });
 const status=document.createElement('p');status.className='text-xs text-gray-400';status.setAttribute('role','status');panel.append(status);
 document.getElementById('settingsHeroMobilePosition').closest('label').after(panel);
 function update(){
  const value=id=>document.getElementById(id)?.value;
  const options=window.VisitaLojaWelcomeSettings.normalize({heroBgPosition:value('settingsHeroPosition'),heroMobilePosition:value('settingsHeroMobilePosition'),heroImageOpacity:value('settingsHeroImageOpacity')});
  const source=images.value.split(/[\n,]+/).map(s=>s.trim()).find(Boolean)||'';
  const valid=window.VisitaLojaHomepage.safeUrl(source);
  for(const [index,image] of previews.entries()){
   image.style.objectPosition=index?options.mobilePosition:options.desktopPosition;
   image.style.filter='brightness('+options.brightness+')';
   const url=valid?source:window.VisitaLojaHomepage.placeholder;
   if(image.getAttribute('src')!==url){image.onerror=()=>{image.onerror=null;image.src=window.VisitaLojaHomepage.placeholder;status.textContent='No se pudo cargar la imagen. Revisa la dirección y su disponibilidad.';};image.src=url;}
  }
  status.textContent=valid?'Vista previa sin publicar cambios.':'Agrega una dirección de imagen válida para revisar su encuadre.';
 }
 for(const id of ['settingsHeroImages','settingsHeroPosition','settingsHeroMobilePosition','settingsHeroImageOpacity'])document.getElementById(id).addEventListener('input',update);
 window.VisitaLojaAdminPresentationPreview={update};update();
})();
