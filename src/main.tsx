import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support for the installed app. Registered after load so it never competes with
// the first paint or the initial data seed.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* unsupported or blocked */ })
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
