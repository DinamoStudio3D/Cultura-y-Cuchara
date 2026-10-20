'use strict';
class N{
 constructor(tag){this.tagName=tag;this.children=[];this.parentNode=null;this.className='';this.id='';}
 append(...nodes){for(const n of nodes){if(n.parentNode)n.parentNode.children.splice(n.parentNode.children.indexOf(n),1);n.parentNode=this;this.children.push(n)}}
 insertBefore(n,ref){if(n.parentNode)n.parentNode.children.splice(n.parentNode.children.indexOf(n),1);n.parentNode=this;this.children.splice(this.children.indexOf(ref),0,n)}
 before(n){this.parentNode.insertBefore(n,this)}
 after(n){const p=this.parentNode;if(n.parentNode)n.parentNode.children.splice(n.parentNode.children.indexOf(n),1);const i=p.children.indexOf(this);n.parentNode=p;p.children.splice(i+1,0,n)}
 querySelector(selector){const predicate=selector.startsWith('.')?n=>n.className.split(' ').includes(selector.slice(1)):n=>n.id===selector.slice(1);for(const c of this.children){if(predicate(c))return c;const found=c.querySelector(selector);if(found)return found}return null}
}
function run(code){
 const doc=new N('document');doc.readyState='complete';doc.createElement=t=>new N(t);doc.createComment=()=>new N('comment');doc.getElementById=id=>doc.querySelector('#'+id);
 const hero=new N('section');hero.id='inicio';doc.append(hero);const shell=new N('div');shell.className='vl-welcome-shell';hero.append(shell);
 const copy=new N('div');copy.className='vl-welcome-copy';const photo=new N('div');photo.className='vl-visible-photo-carousel';shell.append(copy,photo);
 const title=new N('h1');title.id='heroTitle';const search=new N('form');search.id='search';copy.append(title,search);
 let resize,mutate;const mq={matches:true,addEventListener:(_,fn)=>resize=fn},root={document:doc,matchMedia:()=>mq,addEventListener:()=>{}};
 class Observer{constructor(fn){mutate=fn}observe(){}}
 const init=new Function('window','MutationObserver',code);init(root,Observer);
 const frame=doc.getElementById('mobilePhotoFrame');if(photo.parentNode!==frame||title.parentNode!==frame)throw Error('mobile group');
 if(search.parentNode!==copy)throw Error('search separation');
 const credit=new N('div');credit.className='vl-managed-photo-credit';copy.append(credit);mutate();
 if(credit.parentNode!==frame)throw Error('late author grouping');
 credit.textContent='Fotografía: nuevo autor';mq.matches=false;resize();
 if(photo.parentNode!==shell||title.parentNode!==copy||credit.parentNode!==copy||!frame.hidden)throw Error('desktop restoration');
 mq.matches=true;resize();if(credit.parentNode!==frame||credit.textContent!=='Fotografía: nuevo autor')throw Error('credit preserved');
 init(root,Observer);if(shell.children.filter(n=>n.id==='mobilePhotoFrame').length!==1)throw Error('duplicate frame');
 return '6 responsive photo/credit checks passed';
}

if(require.main===module)console.log(run(require('node:fs').readFileSync(require('node:path').join(__dirname,'../js/mobile-photo-layout.js'),'utf8')));
module.exports=run;
