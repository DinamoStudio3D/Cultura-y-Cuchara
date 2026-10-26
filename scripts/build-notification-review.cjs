'use strict';
const fs=require('node:fs');
for(const [source,target] of [['admin-notifications.html','tests/notifications-admin-review.html'],['notifications.html','tests/notifications-user-review.html']]){
 let html=fs.readFileSync(source,'utf8').replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.2\/firebase-(app|auth|messaging)-compat\.js"><\/script>/g,'');
 html=html.replace('<script src="/js/notifications.js">','<script src="/tests/fixtures/notifications-browser.js"></script><script src="/js/notifications.js">');
 html=html.replace('<main', '<div style="padding:12px 20px;background:#fff1c9;color:#493c0c;text-align:center;font:700 14px system-ui">DEMOSTRACIÓN VISUAL · Datos ficticios · Sin Firebase, permisos ni envíos reales</div><main');
 fs.writeFileSync(target,html);
}
