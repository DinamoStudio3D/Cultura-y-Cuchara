/* Foreground media and narration temporarily suspend welcome music. */
(function(root){
 'use strict';
 if(root.VisitaLojaAudioFocus)return;
 const active=new Set(),voices=new Set(),bound=new WeakSet();let blocked=false,resumeTimer=null;
 const isWelcome=media=>media?.id==='welcomeMusic';
 function announce(value){if(blocked===value)return;blocked=value;root.dispatchEvent(new CustomEvent('visitaloja:audio-focus',{detail:{blocked:value}}));}
 function acquire(token){if(resumeTimer!==null){clearTimeout(resumeTimer);resumeTimer=null;}active.add(token);announce(true);}
 function release(token){active.delete(token);if(active.size||!blocked)return;if(resumeTimer!==null)clearTimeout(resumeTimer);resumeTimer=setTimeout(()=>{resumeTimer=null;if(!active.size)announce(false);},100);}
 function bind(media){if(!media||isWelcome(media)||bound.has(media))return;bound.add(media);media.addEventListener('play',()=>acquire(media));for(const type of ['pause','ended','error','emptied'])media.addEventListener(type,()=>release(media));}
 const prototype=root.HTMLMediaElement?.prototype,originalPlay=prototype?.play;
 if(originalPlay)prototype.play=function(...args){if(isWelcome(this))return originalPlay.apply(this,args);bind(this);acquire(this);try{const result=originalPlay.apply(this,args);result?.catch(()=>release(this));return result;}catch(error){release(this);throw error;}};
 document.addEventListener('play',event=>{const media=event.target;if(isWelcome(media)||!media?.addEventListener)return;bind(media);acquire(media);},true);
 root.VisitaLojaAudioFocus={
  hasForegroundAudio:()=>blocked,
  hold(token){acquire(token);return()=>release(token);},
  trackSpeech(utterance){if(!utterance)return;voices.add(utterance);acquire(utterance);const finish=()=>{voices.delete(utterance);release(utterance);};utterance.addEventListener('end',finish,{once:true});utterance.addEventListener('error',finish,{once:true});},
  cancelSpeech(){for(const utterance of voices)release(utterance);voices.clear();}
 };
})(window);
