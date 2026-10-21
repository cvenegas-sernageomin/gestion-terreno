// Service worker offline-first (cache estatico)
const CACHE='solicitud-camioneta-v18';
const ASSETS=['./','./index.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png',
  './vendor/jszip.min.js','./assets/plantilla_solicitud.xlsx','./assets/plantilla_ficha_terreno.xlsx','./assets/plantilla_rendicion_cuentas.xlsx','./assets/plantilla_memo_fondos.docx',
  './vendor/pdf.min.js','./vendor/pdf.worker.min.js','./asistente/texto.js','./asistente/resolucion.js','./asistente/boletas.js','./asistente/mapeo.js','./asistente/ui.js','./informe/index.html','./informe/app.js','./informe/template.js','./informe/jszip.min.js','./informe/icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
  const req=e.request;
  if(new URL(req.url).origin!==self.location.origin) return; // deja pasar el fetch al CSV de Google Sheets sin tocarlo
  const esDoc = req.mode==='navigate' || req.destination==='document' || req.url.endsWith('/') || req.url.endsWith('index.html');
  if(esDoc){
    e.respondWith(fetch(req).then(resp=>{if(resp.ok){const cp=resp.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return resp;})
      .catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(r=>r||fetch(req).then(resp=>{
    if(resp.ok){const cp=resp.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return resp;
  })));});
