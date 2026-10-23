import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const css=read('css/site-utilities.css');
test('core public pages receive layout without executing an external CSS compiler',()=>{
 for(const page of ['index.html','negocio.html']){
  const html=read(page);assert.doesNotMatch(html,/cdn\.tailwindcss\.com|tailwind\.config\s*=/);
  const link=html.indexOf('href="css/site-utilities.css?v=1"');assert(link>0);assert(link<html.indexOf('</head>'));
 }
 for(const rule of ['.hidden{display:none}', '.fixed{position:fixed}', '.w-10{width:2.5rem}', '.h-10{height:2.5rem}'])assert(css.includes(rule),rule);
 assert.match(css,/\.svg-inline--fa\{[^}]*height:1em[^}]*width:1em/);
 assert.match(css,/\[hidden\]\{display:none!important\}/);
});
test('offline shell includes the shipped utility CSS and current mobile resources',()=>{
 const source=read('service-worker.js'),list=JSON.parse(source.match(/const LOCAL_SHELL = (\[[^;]+\]);/)[1].replace(/'/g,'"'));
 assert(list.includes('./css/site-utilities.css?v=1'));
 for(const path of list){const local=path.split('?')[0];assert(existsSync(new URL('../'+(local==='./'?'index.html':local),import.meta.url)),path)}
 const html=read('index.html');for(const resource of ['css/public-layout.css','css/mobile-ui.css','js/mobile-ui.js','js/homepage-content.js']){
  const url=html.match(new RegExp('(?:href|src)="('+resource.replaceAll('.','\\.')+'\\?v=\\d+)"'))?.[1];assert(list.includes('./'+url),resource+' must match the page version');
 }
});
