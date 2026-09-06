// Service worker for the installed Q Drops app.
//
// Makes the archive work with no connection once it has been opened, which is the whole
// point of installing it to a home screen.
//
// The caching rules are deliberately different per kind of file, because getting this wrong
// is how a PWA strands people on a months-old build with no way to update:
//
//   /assets/*   content-hashed by Vite, so a given URL can never change → cache first.
//   /data/*.json the 9.4 MB archive bundle → cache first, since it only changes on deploy
//                and re-downloading it on every launch would defeat the purpose.
//   index.html  NEVER cache-first. It names the current asset hashes, so serving a stale
//                copy pins the app to an old build forever. Network first, cache as fallback.
//
// CACHE_VERSION is bumped by the deploy script on every publish, which drops the old caches.

const CACHE_VERSION = 'qdrops-20260905-224651'
const SHELL = `${CACHE_VERSION}-shell`
const DATA = `${CACHE_VERSION}-data`

const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/icon-192-v2.png', '/icon-512-v2.png']

self.addEventListener('install', event => {
  // Take over immediately rather than waiting for every tab to close — otherwise a user who
  // never fully quits the app keeps running the old worker indefinitely.
  self.skipWaiting()
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).catch(() => {}))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)))
    await self.clients.claim()
    // Tell open pages a new build is live so they can reload THEMSELVES.
    //
    // clients.claim() puts this worker in charge of pages that are already open, but those pages
    // are still running the JavaScript they downloaded earlier — including the old SEED_VERSION,
    // which is what decides whether to re-seed IndexedDB. So a deploy needed two refreshes: one
    // to activate the worker, another to actually run the new code. In practice that read as
    // "the fix isn't live" when the data was correct and already being served.
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const c of clients) c.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION })
  })())
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Only handle our own origin. Post images live on qalerts' mirror; caching another site's
  // media here would bloat storage and serve stale copies of files we do not control.
  if (url.origin !== self.location.origin) return

  const isDoc = req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')
  const isData = url.pathname.startsWith('/data/')
  const isAsset = url.pathname.startsWith('/assets/') || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)

  if (isDoc) {
    // Network first: index.html points at the current build's hashed assets.
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        const cache = await caches.open(SHELL)
        cache.put('/index.html', fresh.clone())
        return fresh
      } catch {
        return (await caches.match('/index.html')) ?? Response.error()
      }
    })())
    return
  }

  if (isData || isAsset) {
    event.respondWith((async () => {
      const cacheName = isData ? DATA : SHELL
      const cached = await caches.match(req)
      if (cached) return cached
      try {
        const fresh = await fetch(req)
        if (fresh.ok) (await caches.open(cacheName)).put(req, fresh.clone())
        return fresh
      } catch {
        return cached ?? Response.error()
      }
    })())
  }
})
