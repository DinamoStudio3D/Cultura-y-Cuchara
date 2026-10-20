'use strict';
function run(code){
 const classes=new Set(['hidden']),bodyClasses=new Set(),listeners={},attrs={};let calls=0,shows=0;
 const dialog={open:false,classList:{contains:c=>classes.has(c)},setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],addEventListener:(k,fn)=>listeners[k]=fn,showModal(){this.open=true;shows++},close(){this.open=false}};
 const root={document:{getElementById:()=>dialog,body:{classList:{add:c=>bodyClasses.add(c),remove:c=>bodyClasses.delete(c)}}},closeModal:()=>{calls++;classes.add('hidden');root.VisitaLojaPromoDialog.close()}};
 new Function('window',code)(root);const api=root.VisitaLojaPromoDialog;
 classes.delete('hidden');api.open();api.open();if(shows!==1||!bodyClasses.has('vl-promo-open'))throw Error('open once/scroll lock');
 let prevented=false;listeners.cancel({preventDefault(){prevented=true}});if(!prevented||calls!==1||dialog.open||bodyClasses.size)throw Error('escape cleanup');
 classes.delete('hidden');api.open();listeners.click({target:{}});if(calls!==1)throw Error('inside click');
 listeners.click({target:dialog});if(calls!==2||bodyClasses.size)throw Error('backdrop close');
 dialog.showModal=undefined;classes.delete('hidden');api.open();if(attrs['data-fallback']!=='true')throw Error('fallback');
 api.close();if(attrs['data-fallback']||bodyClasses.size)throw Error('fallback cleanup');
 return '6 announcement lifecycle checks passed';
}

if(require.main===module)console.log(run(require('node:fs').readFileSync(require('node:path').join(__dirname,'../js/promo-dialog.js'),'utf8')));
module.exports=run;
