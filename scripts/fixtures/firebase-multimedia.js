// Browser QA only: no external identity or Firestore calls. This file is never loaded by the site.
window.fixture = {writes: [], mode: 'success'};
(() => {
 const snapshot = {exists:false,empty:true,docs:[],data:()=>({})};
 function reference(path) {
  const ref={path};
  for(const method of ['collection','doc'])ref[method]=id=>reference(path+'/'+id);
  for(const method of ['where','orderBy','limit'])ref[method]=()=>ref;
  ref.get=async()=>snapshot;ref.onSnapshot=()=>()=>{};
  for(const method of ['set','update','delete','add'])ref[method]=async data=>{if(method==='update'&&window.fixture.failSave)throw Error('Guardado rechazado de prueba');window.fixture.writes.push({path,method,data});return{id:'fixture'};};
  return ref;
 }
 const db=reference('');db.batch=()=>({set(){},update(){},delete(){},commit:async()=>{}});
 const auth={currentUser:{uid:'fixture',email:'fixture@example.com',getIdToken:async()=> 'fixture-token'},setPersistence:async()=>{},onAuthStateChanged(){},signOut:async()=>{}};
 const authApi={Auth:{Persistence:{NONE:'none',SESSION:'session'}},GoogleAuthProvider:class{setCustomParameters(){}},EmailAuthProvider:{}};
 const authFunction=Object.assign(()=>auth,authApi),firestoreFunction=Object.assign(()=>db,{FieldValue:{serverTimestamp:()=> 'fixture-time',delete:()=>null},Timestamp:{fromDate:d=>d}});
 window.firebase={initializeApp:()=>({auth:()=>auth,firestore:()=>db}),auth:authFunction,firestore:firestoreFunction};
})();
