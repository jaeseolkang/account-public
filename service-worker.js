
'use strict';
const CACHE_PREFIX = 'gaegyebu-' + self.registration.scope;
const CACHE_NAME = CACHE_PREFIX + '-v4132';
const INDEX_FILES = ["./local-index.html","./index.html","./"];
const ASSETS = ['./xlsx-js-style.min.js', './jspdf.umd.min.js', './html2canvas.min.js', './manifest.json'];

function cacheIndex(cache) {
  let i = 0;
  function next() {
    if (i >= INDEX_FILES.length) return Promise.reject(new Error('앱 html 파일을 캐시에 넣지 못했습니다.'));
    const file = INDEX_FILES[i++];
    return fetch(file, { cache: 'reload' }).then(response => {
      if (!response.ok) return next();
      return Promise.all(INDEX_FILES.map(name => cache.put(name, response.clone())));
    }, next);
  }
  return next();
}

function cachedIndex() {
  return INDEX_FILES.reduce((result, file) => result.then(cached => cached || caches.match(file)), Promise.resolve(null));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all([
        cacheIndex(cache),
        ...ASSETS.map(file => fetch(file, { cache: 'reload' }).then(response => {
          if (!response.ok) throw new Error('캐시할 파일을 불러오지 못했습니다: ' + file);
          return cache.put(file, response);
        }))
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const url = new URL(event.request.url);
      const isAsset = INDEX_FILES.some(file => url.pathname.endsWith(file.slice(1))) ||
        ASSETS.some(file => url.pathname.endsWith(file.slice(1))) || url.pathname.endsWith('/');
      if (isAsset && response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    })).catch(() => cachedIndex())
  );
});
