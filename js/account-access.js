/* Shared Google entry point. Authentication never grants business/admin access. */
(function(root){'use strict';
const messages={
 'auth/unauthorized-domain':'Google no está autorizado en esta dirección. Administración debe añadir este dominio exacto en Firebase Authentication → Configuración → Dominios autorizados.',
 'auth/popup-blocked':'El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio y vuelve a pulsar Ingresar con Google.',
 'auth/popup-closed-by-user':'Se cerró la ventana de Google. Puedes volver a intentarlo sin perder tu progreso.',
 'auth/cancelled-popup-request':'Ya hay una ventana de acceso abierta. Completa o cierra esa ventana antes de volver a intentar.',
 'auth/account-exists-with-different-credential':'Este correo ya tiene una cuenta con otro método de acceso. Ingresa con ese método para conservar tus tarjetas y pasaporte. No crees otra cuenta.',
 'auth/credential-already-in-use':'Esta identidad ya está vinculada a otra cuenta. Ingresa con el método original; no se han combinado cuentas ni modificado tu progreso.',
 'auth/user-disabled':'Esta cuenta está deshabilitada. Consulta con la administración de VisitaLoja.',
 'auth/operation-not-supported-in-this-environment':'Abre esta página en Safari o Chrome para ingresar con Google.',
 'auth/web-storage-unsupported':'El navegador no permite guardar la sesión. Revisa sus ajustes de almacenamiento o abre la página en Safari o Chrome.',
 'auth/network-request-failed':'No se pudo conectar con Google. Revisa tu conexión e inténtalo nuevamente.',
 'auth/operation-not-allowed':'El ingreso con Google no está habilitado. Consulta con la administración.',
 'auth/too-many-requests':'Hay demasiados intentos. Espera unos minutos antes de volver a ingresar.'
};
function errorMessage(error){return messages[error?.code]||'No se pudo iniciar sesión. Revisa tu conexión y el método de acceso de tu cuenta e inténtalo nuevamente.'}
const pending=new WeakMap();
function google(auth,providerFactory){if(pending.has(auth))return pending.get(auth);let operation;try{const provider=providerFactory();provider.setCustomParameters?.({prompt:'select_account'});/* Invoke synchronously in the click event to retain browser user activation. */operation=Promise.resolve(auth.signInWithPopup(provider))}catch(error){operation=Promise.reject(error)}const work=operation.finally(()=>pending.delete(auth));pending.set(auth,work);return work}
function sameUser(auth,uid){return !!uid&&auth.currentUser?.uid===uid}
const api={google,errorMessage,sameUser};root.VisitaLojaAccountAccess=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
