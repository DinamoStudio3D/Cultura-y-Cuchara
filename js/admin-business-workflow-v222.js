/* Reuse the existing administrative frame and module transition guard. */
(function(root){
 'use strict';
 const views=new Set(['overview','programs','access','clients','activity','points','promotions','birthdays','notices']);
 function open(view){
  if(!views.has(view))return false;
  if(typeof showAdminModule!=='function'||showAdminModule('fidelity')===false)return false;
  const frame=document.getElementById('fidelityFrame');if(!frame)return false;
  const workspace=frame.contentWindow?.VisitaLojaAdminFidelityWorkspace;
  if(workspace){workspace.select(view,true);return true;}
  frame.src='gestion-fidelidad.html?embed=1#'+view;
  return true;
 }
 root.VisitaLojaAdminBusinessWorkflow={open};
})(window);
