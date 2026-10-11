(function(root){
 'use strict';
 function image(value){if(!String(value||'').trim())return '';try{const url=new URL(String(value||''),location.origin);return url.protocol==='https:'&&(!value||!String(value).startsWith('//'))?url.href:'';}catch(_){return '';}}
 function clean(data={}){return {tagline:String(data.tagline||'').slice(0,120),description:String(data.description||'').slice(0,4000),highlights:String(data.highlights||'').slice(0,1500),cover:image(data.cover),coverCredit:String(data.coverCredit||'').slice(0,180),version:Number(data.version)||0};}
 const api={image,clean};root.VisitaLojaCantonContent=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
