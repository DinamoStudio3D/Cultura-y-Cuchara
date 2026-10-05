(function(global){
'use strict';
// Legacy compatibility shim.
// Audio uploads are handled by js/cloudinary-audio-uploader.js, which now
// routes authenticated admin uploads through /api/upload-admin-audio to GitHub.
// This file intentionally does not register change listeners so it cannot
// intercept the current uploader or leave the UI stuck at 0%.
global.VisitaLojaAdminAudioBridge=Object.freeze({mode:'github-endpoint'});
})(window);
