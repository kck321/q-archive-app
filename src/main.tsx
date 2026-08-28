import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initCloudflareAnalytics } from './lib/cloudflareAnalytics'

// Cookieless visitor counting on the public site — no-op in dev and the desktop build.
initCloudflareAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support for the installed app. Registered after load so it never competes with
// the first paint or the initial data seed.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // FORCE THE FRESHNESS CHECK. register() alone does not reliably re-check an
      // already-registered worker for new bytes — browsers throttle the automatic check to
      // roughly once every 24 hours, and installed/standalone PWAs (the home-screen-icon case)
      // are the least likely to hit that window on their own. A visitor who opens the app once
      // a day forever could sit behind a stale service worker indefinitely, holding stale
      // /data/*.json in its cache-first store even though index.html and the JS bundle are
      // fetched network-first and would otherwise look current.
      //
      // update() bypasses that throttle and asks the browser to re-fetch /sw.js right now, byte
      // for byte, so a deploy reaches an already-installed app on its very next open rather than
      // waiting on the browser's own schedule.
      reg.update().catch(() => {})
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {})
      })
    }).catch(() => { /* unsupported or blocked */ })
  })

  // Reload once when a new build takes over.
  //
  // The worker claims open pages, but those pages keep running the JavaScript they already
  // downloaded — including the old SEED_VERSION, which is what decides whether to re-seed
  // IndexedDB from the new bundle. So a deploy took two refreshes: one to activate the worker,
  // another to run the new code. Every "I still don't see it" this week has had correct data
  // sitting on the server behind exactly that.
  //
  // Guarded by sessionStorage so a page can only self-reload once per tab session — a reload
  // loop would be far worse than a stale tab.
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type !== 'SW_ACTIVATED') return
    const seen = sessionStorage.getItem('sw-reloaded')
    if (seen === e.data.version) return
    sessionStorage.setItem('sw-reloaded', e.data.version)
    location.reload()
  })
}

// Ask the browser not to evict our storage.
//
// Everything that makes the app fast lives in IndexedDB: the 7.5 MB archive plus ~4.8 MB of
// computed indexes. By default a browser may clear that under storage pressure, which would
// mean re-downloading the bundle and rebuilding the indexes from scratch. Installed apps are
// usually granted this without a prompt; on the open web it may be declined, which is fine —
// the app just rebuilds if it ever happens.
if (navigator.storage?.persist) {
  navigator.storage.persisted()
    .then(already => already || navigator.storage.persist())
    .catch(() => { /* not supported — nothing to do */ })
}
