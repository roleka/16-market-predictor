// Change CACHE on every release so old copies are removed.
const CACHE='16market-v1.8';
const FILES=['./','./index.html','./app.js','./model.json','./features.json','./manifest.webmanifest','./icon.svg'];

self.addEventListener('install',e=>{
  self.skipWaiting(); // activate the new version immediately
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))));
});

self.addEventListener('activate',e=>e.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const sameOrigin=new URL(e.request.url).origin===self.location.origin;

  if(sameOrigin){
    // App files: network first, so updates arrive as soon as you are online;
    // cached copy when offline.
    e.respondWith(
      fetch(e.request).then(resp=>{
        if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
        return resp;
      }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
    );
  }else{
    // CDN files (Tesseract OCR engine): cache first, they are versioned.
    e.respondWith(
      caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
        const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;
      }))
    );
  }
});
