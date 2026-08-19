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

const RETRY_MS = 4000            // generous: the analysis list is ~500ms of work plus render
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
        const deadline = performance.now() + RETRY_MS
        let settled = 0
        const restore = () => {
          if (Math.abs(el.scrollTop - target) > 2) {
            el.scrollTop = target
            settled = 0
          } else {
            settled++
          }
          if (settled < SETTLE_FRAMES && performance.now() < deadline) {
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
      // Runs BEFORE the next page's layout body — scrollTop is still ours here.
      if (raf) cancelAnimationFrame(raf)
      positions.current[key] = el.scrollTop
      savePositions(positions.current)
    }
  }, [key, navType, containerRef])

  return null
}
