// Cloudflare Web Analytics — public-site only, no consent banner needed.
//
// Chosen over Google Analytics by owner ruling (2026-08-28): Cloudflare's beacon is cookieless
// and collects no personal data — no cross-site tracking, no fingerprinting, nothing stored on
// the visitor's device — which is why no consent prompt is required and visitors are never
// interrupted. The GA4 + cookie-banner implementation this replaces lived for one day
// (see DEVLOG 2026-08-27) and never shipped with a real audience.
//
// The beacon handles SPA route changes on its own (it hooks history.pushState by default), so
// unlike GA there is no router wiring: one script injection covers every page view.
//
// IS_PUBLIC_SITE keeps this out of the desktop/dev workbench build entirely — the owner's own
// sessions are never counted, and the token tree-shakes out of that build's JS.
import { IS_PUBLIC_SITE } from './appMode'

const TOKEN = import.meta.env.VITE_CF_ANALYTICS_TOKEN as string | undefined

/** Inject the Cloudflare beacon. No-ops off the public site or when no token is configured. */
export function initCloudflareAnalytics() {
  if (!IS_PUBLIC_SITE || !TOKEN) return
  const s = document.createElement('script')
  s.defer = true
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }))
  document.head.appendChild(s)
}
