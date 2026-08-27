// Google Analytics 4 — public-site only, consent-gated.
//
// gtag.js is never injected until the visitor accepts (via CookieConsent.tsx). That is
// stronger than Google's own "Consent Mode" pattern, which loads the script and restricts
// what it sends by default — here, before consent, nothing loads and nothing is sent at all.
// IS_PUBLIC_SITE keeps this out of the desktop/dev workbench build entirely: the owner's own
// editing sessions are never tracked, and CAN_EDIT-gated code that never ships to the public
// bundle (see appMode.ts) means the measurement ID and this whole module tree-shake out of the
// desktop build's JS too, not just its behavior.
import { IS_PUBLIC_SITE } from './appMode'

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
const CONSENT_KEY = 'qdrops-analytics-consent'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export type ConsentChoice = 'granted' | 'denied'

/** The visitor's stored choice, or null if they have never been asked. */
export function storedConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(CONSENT_KEY)
  return v === 'granted' || v === 'denied' ? v : null
}

/** Whether analytics can run at all — a measurement ID is configured and this is the public build. */
export function analyticsAvailable(): boolean {
  return IS_PUBLIC_SITE && Boolean(MEASUREMENT_ID)
}

let initialized = false

/** Load gtag.js and configure it. Safe to call more than once — only the first call does anything. */
function loadGtag() {
  if (initialized || !MEASUREMENT_ID) return
  initialized = true
  window.dataLayer = window.dataLayer ?? []
  window.gtag = function gtag(...args: unknown[]) { window.dataLayer!.push(args) }
  window.gtag('js', new Date())
  // Manual pageviews: a React Router route change is not a browser navigation, so GA's own
  // automatic pageview (fired once, at script load) would never see any page after the first.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false })
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(s)
}

/** Record the visitor's choice and act on it immediately. */
export function setConsent(choice: ConsentChoice) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CONSENT_KEY, choice)
  if (choice === 'granted') loadGtag()
}

/** Called once on app start: resume tracking if the visitor already granted consent before. */
export function initAnalyticsIfConsented() {
  if (!analyticsAvailable()) return
  if (storedConsent() === 'granted') loadGtag()
}

/** One page view. Call on every route change — the initial load and every client-side navigation. */
export function trackPageview(path: string, title?: string) {
  if (!initialized || !window.gtag) return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: window.location.href,
  })
}

/**
 * A custom event, for whatever future instrumentation the site needs beyond pageviews —
 * a search performed, a chip clicked, the highlight toggle flipped. No-ops silently before
 * consent or when no measurement ID is configured, so call sites never need to guard this.
 */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  if (!initialized || !window.gtag) return
  window.gtag('event', name, params)
}
