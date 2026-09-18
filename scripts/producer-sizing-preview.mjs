// Local browser regression fixture. No Shopify/network credentials or remote assets.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {inspectSvg} from '../apps/worker/src/producer-svg.js';
const css=readFileSync(new URL('../extensions/eu-store-guard/assets/eu-store-guard.css',import.meta.url),'utf8');
const cases=['viewBox="0 0 400 320"','viewBox="0 0 5 4"','viewBox="0 0 99991 99989"','viewBox="0 0 100 100" width="800" height="200"','viewBox="10 10 400 320"'];
const fixtures=cases.map(attrs=>{
  const bytes=new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}><rect width="100%" height="100%" fill="#126f85"/></svg>`);
  return {bytes,...inspectSvg(bytes)};
});
const page=()=>`<!doctype html><html lang="es"><meta charset="utf-8"><title>GARAN v16 · prueba de tamaño</title><style>${css}body{font:16px system-ui;padding:24px}section{border:1px solid #ccc;padding:12px;margin:12px 0}img{background:#eee}pre{white-space:pre-wrap}</style><h1>Prueba local de tamaño GARAN</h1><p>CSS del repositorio; medidas antes y después de cargar cada SVG.</p><pre id="result">Prueba en curso</pre>${[320,1024].map(container=>`<section style="width:${container}px"><h2>Contenedor ${container}px</h2>${fixtures.map((f,i)=>['esg-garan__asset','esg-garan__nested-asset'].map(cls=>`<img class="${cls}" width="${f.width}" height="${f.height}" data-file="${i}" data-container="${container}" alt="Caso ${i}">`).join('')).join('')}</section>`).join('')}<script>
const results=[];
Promise.all([...document.images].map(img=>new Promise(resolve=>{
 const before=img.getBoundingClientRect();
 img.onload=()=>{const after=img.getBoundingClientRect();const expected=img.className.endsWith('nested-asset')?160:180;const pass=Math.abs(before.width-expected)<.1&&Math.abs(after.width-expected)<.1&&Math.abs(before.height-after.height)<.1;results.push({case:img.dataset.file,container:img.dataset.container,kind:img.className,before:[before.width,before.height],after:[after.width,after.height],pass});resolve();};
 img.onerror=()=>{results.push({pass:false,error:'load'});resolve();};img.src='/svg/'+img.dataset.file;
}))).then(()=>{document.getElementById('result').textContent=results.filter(x=>x.pass).length+'/'+results.length+' comprobaciones correctas\\n'+JSON.stringify(results,null,2);});
</script></html>`;
const server=createServer((req,res)=>{
 const match=/^\/svg\/(\d+)$/.exec(req.url);
 if(match&&fixtures[+match[1]]){res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store'});res.end(fixtures[+match[1]].bytes);return;}
 res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'});res.end(page());
});
server.listen(8766,'127.0.0.1',()=>console.log('Local sizing fixture: http://127.0.0.1:8766'));
