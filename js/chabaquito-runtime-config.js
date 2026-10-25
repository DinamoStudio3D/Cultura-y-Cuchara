/* Only this branch preview uses the preview Worker. Public domains keep production. */
(function(){
 'use strict';
 const previewHost='visitaloja-git-improve-existing-rewards-dinamostudio3d.vercel.app';
 const isRewardPreview=window.location.hostname===previewHost;
 window.VisitaLojaChabaquitoConfig=Object.freeze({
  workerUrl:isRewardPreview?'https://visitaloja-chabaquito-preview.sukogames1996.workers.dev':'https://visitaloja-chabaquito.sukogames1996.workers.dev'
 });
})();
