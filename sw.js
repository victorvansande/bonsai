/* Laat de app ook zonder verbinding openen. Netwerk eerst, anders de laatste kopie. */
var CACHE="bonsai-v2";
self.addEventListener("install",function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(["./","index.html","manifest.webmanifest","icon-192.png","icon-180.png"]);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim());});
self.addEventListener("fetch",function(e){
  if(e.request.method!=="GET")return;
  e.respondWith(fetch(e.request).then(function(r){
    var copy=r.clone();
    caches.open(CACHE).then(function(c){c.put(e.request,copy);}).catch(function(){});
    return r;
  }).catch(function(){
    return caches.match(e.request,{ignoreSearch:true}).then(function(m){return m||caches.match("index.html");});
  }));
});
