import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Remember where you were on every page, and put you back there when you go Back.
//
// The app scrolls inside <main>, not the window, so the browser's own scroll restoration
// never applies — Back would otherwise dump you at the top of a list thousands of rows long.
//
// ── The ordering bug this had to get right ───────────────────────────────────
// The save used to live in a passive useEffect cleanup. React runs those AFTER layout
// effects, so on every navigation the sequence was:
//     1. layout effect body for the NEW page sets scrollTop = 0
//     2. passive cleanup for the OLD page reads scrollTop … and saves 0
// Every position was recorded as zero, so Back always landed at the top. The save now
// happens in the LAYOUT effect cleanup, which runs before the next layout body — the
// element still holds the position we actually want.
//
// ── Async content ────────────────────────────────────────────────────────────
// Pages fetch and render thousands of rows after mount, so at restore time the container
// is usually still short and scrollTop silently clamps. We re-apply across animation
// frames until it sticks, then confirm it holds for a few frames before stopping.

// Budget measured from the last time the page STOPPED GROWING, not from the restore starting.
//
// A fixed deadline is the wrong instrument: it asks "has enough time passed?" when the question
// is "has the content arrived yet?". /pics reloads ~1,870 tiles from IndexedDB on Back, and until
// they render the container is too short for the target, so scrollTop silently clamps to 0. A flat
// 4s expired mid-load often enough to fail roughly one run in three. Every frame in which
// scrollHeight changes resets this budget, so a slow page gets all the patience it needs while a
// genuinely unreachable position still gives up promptly.
const RETRY_MS = 4000            // quiet time to keep trying AFTER the page stops growing
const MAX_MS = 20000             // absolute cap, so a page that never settles cannot spin forever
const SETTLE_FRAMES = 5          // frames the position must hold before we stop re-applying
const STORAGE_KEY = 'q-scroll-positions'

function loadPositions(): Record<string, number> {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

function savePositions(map: Record<string, number>) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map)) } catch { /* private mode */ }
}

// Which element is actually scrolling right now.
//
// On desktop the app scrolls inside <main>. On phones the DOCUMENT scrolls instead, so the
// browser can hide its address bar — which means the position has to be read from and
// written to the document, and the scroll event listened for on window. Reading the wrong
// one silently records 0 for every page, which is the same bug this file already fixed once.
function scroller(containerRef: RefObject<HTMLElement | null>): {
  el: HTMLElement
  target: HTMLElement | Window
} {
  // Ask the CSS whether this element scrolls — NOT whether its content currently overflows.
  //
  // A height test (scrollHeight > clientHeight) is a question about DATA, and it gets asked at
  // the worst possible moment: the layout effect fires once the new route has mounted but before
  // its thousands of rows arrive, so <main> is still short and the test answers "this does not
  // scroll". Both the save and the restore were then aimed at the document — while on desktop
  // <main> is the element actually scrolling. Writing scrollTop to a document that does not
  // scroll does nothing, and reading it back gives 0, so every position was stored as 0 and Back
  // always landed at the top. The same failure this file was written to fix, through another door.
  //
  // overflowY comes from the STYLESHEET (`lg:overflow-y-auto`), so it is already right on the
  // first frame and stays right while the list is still loading.
  const el = containerRef.current
  if (el) {
    const oy = getComputedStyle(el).overflowY
    if (oy === 'auto' || oy === 'scroll') return { el, target: el }
  }
  const doc = (document.scrollingElement ?? document.documentElement) as HTMLElement
  return { el: doc, target: window }
}

export default function ScrollRestoration({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const location = useLocation()
  const navType = useNavigationType()
  const key = location.pathname + location.search
  const positions = useRef<Record<string, number>>(loadPositions())

  // Keep the stored position current while the page is on screen, so a refresh or a
  // browser-level restore has something to work with too.
  useEffect(() => {
    const { el, target } = scroller(containerRef)
    if (!el) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        positions.current[key] = el.scrollTop
      })
    }
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      target.removeEventListener('scroll', onScroll)
    }
  }, [key, containerRef])

  useLayoutEffect(() => {
    const { el } = scroller(containerRef)
    if (!el) return

    let raf = 0
    if (navType === 'POP') {
      const target = positions.current[key] ?? 0
      if (target > 0) {
        let deadline = performance.now() + RETRY_MS
        const hardStop = performance.now() + MAX_MS
        let lastHeight = el.scrollHeight
        let settled = 0
        const restore = () => {
          // Still filling in? Then we have not had our chance yet — reset the budget.
          if (el.scrollHeight !== lastHeight) {
            lastHeight = el.scrollHeight
            deadline = performance.now() + RETRY_MS
          }
          if (Math.abs(el.scrollTop - target) > 2) {
            el.scrollTop = target
            settled = 0
          } else {
            settled++
          }
          const now = performance.now()
          if (settled < SETTLE_FRAMES && now < deadline && now < hardStop) {
            raf = requestAnimationFrame(restore)
          }
        }
        raf = requestAnimationFrame(restore)
      } else {
        el.scrollTop = 0
      }
    } else {
      // Opening something new always starts at the top.
      el.scrollTop = 0
    }

    return () => {
      // Runs BEFORE the next page's layout body — but NOT before React has swapped the DOM.
      //
      // By the time this fires, the incoming route's markup is already committed, so this
      // container is as tall as the NEW page. When the new page is shorter than the old scroll
      // offset (leaving a 100,000px picture grid for a single drop, say) the browser clamps
      // scrollTop to 0, and reading it here records a 0 that the reader never chose. That is an
      // artifact of the swap, not a position — and it is what made Back land at the top of /pics
      // roughly one time in three while the analysis pages, being shorter, usually got away
      // with it.
      //
      // The scroll listener above already tracked the real position while the page was live, so
      // trust that when the element now reads 0. A reader who genuinely sat at the top has 0
      // recorded there too, so nothing is lost by preferring it.
      if (raf) cancelAnimationFrame(raf)
      const atUnmount = el.scrollTop
      const tracked = positions.current[key]
      positions.current[key] = atUnmount > 0 ? atUnmount : (tracked ?? 0)
      savePositions(positions.current)
    }
  }, [key, navType, containerRef])

  return null
}
