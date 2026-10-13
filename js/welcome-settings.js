/* Shared validated presentation options; no storage or network operations. */
(function(root){
 'use strict';
 const positions=['50% 50%','50% 20%','50% 80%','20% 50%','80% 50%'];
 function normalize(s={}){
  const style=['cinematic','classic','clean'].includes(s.heroStyle)?s.heroStyle:'cinematic';
  const height=['compact','standard','immersive'].includes(s.heroHeight)?s.heroHeight:'immersive';
  const number=Number(s.heroImageOpacity),visibility=Number.isFinite(number)?Math.min(85,Math.max(25,number)):55;
  const position=typeof s.heroBgPosition==='string'&&/^\d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/.test(s.heroBgPosition)?s.heroBgPosition:'50% 50%';
  return{style,height,visibility,cardStyle:['elevated','bordered','soft'].includes(s.cardStyle)?s.cardStyle:'elevated',cornerStyle:['medium','large','extra'].includes(s.cornerStyle)?s.cornerStyle:'large',brightness:1+(visibility-55)/100,desktopPosition:position,mobilePosition:positions.includes(s.heroMobilePosition)?s.heroMobilePosition:position,cardImageFit:s.cardImageFit==='contain'?'contain':'cover'};
 }
 function apply(s={}){
  const options=normalize(s),hero=document.getElementById('inicio');
  if(hero){hero.dataset.welcomeStyle=options.style;hero.style.setProperty('--welcome-desktop-height',({compact:500,standard:580,immersive:650})[options.height]+'px');hero.style.setProperty('--welcome-mobile-height',({compact:300,standard:330,immersive:360})[options.height]+'px');hero.style.setProperty('--welcome-brightness',options.brightness);hero.style.setProperty('--welcome-mobile-position',options.mobilePosition);}
  document.documentElement.style.setProperty('--vl-card-image-fit',options.cardImageFit);
  document.documentElement.dataset.cardImageFit=options.cardImageFit;
  document.body.dataset.cardStyle=options.cardStyle;
  document.documentElement.style.setProperty('--premium-radius',({medium:'1rem',large:'1.25rem',extra:'1.75rem'})[options.cornerStyle]);
 }
 root.VisitaLojaWelcomeSettings={normalize,apply};
})(typeof window!=='undefined'?window:globalThis);
