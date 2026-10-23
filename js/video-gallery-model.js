(function(root){
 'use strict';
 function source(value){
  try{const url=new URL(String(value||'').trim());if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
   const host=url.hostname.toLowerCase();let id='';
   if(host==='youtu.be')id=url.pathname.slice(1).replace(/\/$/,'');
   else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))id=url.pathname==='/watch'?url.searchParams.get('v'):(url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)||[])[1];
   if(id&&/^[\w-]{11}$/.test(id))return{type:'youtube',url:'https://www.youtube.com/watch?v='+id,thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',embed:'https://www.youtube-nocookie.com/embed/'+id+'?playsinline=1&rel=0&autoplay=1'};
   if(/\.(mp4|webm)$/i.test(url.pathname)&&!/(^|\.)youtube(-nocookie)?\.com$|(^|\.)youtu\.be$/.test(host))return{type:'file',url:url.href};
  }catch(_){}return null;
 }
 function image(value){try{const u=new URL(String(value||''),'https://www.visitaloja.com/');return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch(_){return '';}}
 const text=(v,max)=>String(v||'').trim().slice(0,max);
 function normalize(data={}){return{active:data.active===true,title:text(data.title,100)||'Loja en video',description:text(data.description,350)||'Historias, sabores y lugares para descubrir desde otra mirada.',items:(Array.isArray(data.items)?data.items:[]).slice(0,30).map((x,i)=>({id:text(x.id,80)||'video-'+i,title:text(x.title,160),description:text(x.description,350),url:text(x.url,2000),thumbnail:x.thumbnail?image(x.thumbnail):'',credit:text(x.credit,140),published:x.published===true}))};}
 function validate(data){if(!Array.isArray(data.items)||data.items.length>30)return 'Puedes configurar hasta 30 videos.';for(let i=0;i<data.items.length;i++){const x=data.items[i];if(!String(x.title||'').trim())return 'Escribe el título del video '+(i+1)+'.';if(!source(x.url))return 'Revisa el enlace del video '+(i+1)+': usa YouTube o un archivo HTTPS MP4/WebM.';if(x.thumbnail&&!image(x.thumbnail))return 'Revisa la miniatura del video '+(i+1)+'.';}return '';}
 const api={source,image,normalize,validate};if(typeof module==='object'&&module.exports)module.exports=api;else root.VisitaLojaVideos=api;
})(typeof window==='object'?window:globalThis);
