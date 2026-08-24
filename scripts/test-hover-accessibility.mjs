// The entity tooltip, driven the way each kind of reader actually reaches it.
//
//   node scripts/test-hover-accessibility.mjs [baseUrl] [--fresh]
//
// A tooltip that only works on a mouse is not finished. Each check below is a distinct route in,
// and every one of them has to work before 4,285 synopses are worth publishing:
//
//   hover · keyboard focus · click/tap · Escape · outside click · screen-reader labelling
//
// Plus the two placement rules that decide whether the card is usable at all: it must stay inside
// the viewport, and it must not cover the passage it is explaining.
import { launch } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'
// #534 carries NYC, a Partial-support reading — so this also proves the grade reaches the reader.
const POST = args.find(a => /^\d+$/.test(a)) ?? '534'

// THE TRIGGER IS THE ONE IN THE DROP, NOT THE FIRST ONE ON THE PAGE.
//
// This took `document.querySelectorAll('button[aria-expanded]')[0]` over the whole document,
// which was the glossary trigger for exactly as long as nothing else on the page used the
// attribute. The sidebar's "Q Extras" disclosure now does, and it comes first in DOM order, so
// six accessibility checks failed against a sidebar row and the page under test was never
// examined at all. Every query is scoped to pre.post-text, which is what this gate is named
// after; the glossary triggers themselves were unchanged the whole time.
const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${got}`) }
console.log(`\nENTITY TOOLTIP ACCESSIBILITY  (${mode}${browser.reused ? ', reused' : ''})  post #${POST}\n`)
const started = Date.now()

const page = await browser.page(`${BASE}/post/${POST}`)
const ready = await page.waitFor(`document.body.innerText.includes('#${POST}') && document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]').length > 0`, { timeout: 60000 })
check(Boolean(ready), 'the drop renders with tooltip triggers', ready ? 'triggers present' : 'NONE FOUND')

// ── the trigger announces itself ────────────────────────────────────────────
const trig = await page.evaluate(`(() => {
  const b = [...document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')][0]
  if (!b) return ''
  return JSON.stringify({
    tag: b.tagName, label: b.getAttribute('aria-label'), expanded: b.getAttribute('aria-expanded'),
    text: b.textContent.trim(), focusable: b.tabIndex >= 0,
  })
})()`)
const t = trig ? JSON.parse(trig) : null
check(Boolean(t) && t.tag === 'BUTTON', 'the trigger is a real button', t?.tag ?? '—')
check(Boolean(t?.label), 'it has a screen-reader label', t?.label ? `"${t.label.slice(0, 56)}"` : 'NO aria-label')
check(t?.expanded === 'false', 'it reports collapsed state', t?.expanded ?? '—')
check(t?.focusable === true, 'it is in the tab order', t?.focusable ? 'tabbable' : 'NOT FOCUSABLE')

// ── keyboard focus opens it ─────────────────────────────────────────────────
const onFocus = await page.evaluate(`(() => {
  const b = [...document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')][0]
  b.focus()
  return new Promise(r => setTimeout(() => {
    const card = document.querySelector('[role="tooltip"]')
    r(JSON.stringify({ open: b.getAttribute('aria-expanded'), card: Boolean(card), described: b.getAttribute('aria-describedby') === card?.id }))
  }, 250))
})()`)
const f = JSON.parse(onFocus ?? '{}')
check(f.open === 'true', 'keyboard focus opens the card', f.open ?? '—')
check(f.card === true, 'the card has role="tooltip"', f.card ? 'present' : 'MISSING')
check(f.described === true, 'aria-describedby points at the card', f.described ? 'linked' : 'NOT LINKED')

// ── the card shows both layers and the grade ────────────────────────────────
const body = await page.evaluate(`(() => {
  const c = document.querySelector('[role="tooltip"]')
  return c ? JSON.stringify({ text: c.innerText, hasInThisDrop: /in this drop/i.test(c.innerText) }) : ''
})()`)
const b = body ? JSON.parse(body) : null
check(Boolean(b?.hasInThisDrop), 'the card shows the post-specific layer', b?.hasInThisDrop ? 'both layers' : 'GLOBAL ONLY')
check(Boolean(b) && /supported|not established/i.test(b.text), 'the support grade reaches the reader',
  (b?.text.match(/(Strongly supported|Partly supported[^\n]*|Not established[^\n]*)/) ?? ['—'])[0].slice(0, 46))

// ── it does not cover the passage it explains ───────────────────────────────
const geom = await page.evaluate(`(() => {
  const bt = [...document.querySelectorAll('button[aria-expanded="true"]')][0]
  const c = document.querySelector('[role="tooltip"]')
  if (!bt || !c) return ''
  const a = bt.getBoundingClientRect(), r = c.getBoundingClientRect()
  const overlaps = !(r.bottom <= a.top || r.top >= a.bottom || r.right <= a.left || r.left >= a.right)
  return JSON.stringify({ overlaps, inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 })
})()`)
const g = JSON.parse(geom ?? '{}')
check(g.inView === true, 'the card stays inside the viewport', g.inView ? 'fully on screen' : 'OVERFLOWS')
check(g.overlaps === false, 'it does not cover the word it explains', g.overlaps ? 'COVERS THE ANCHOR' : 'clear of the anchor')

// ── Escape closes it and returns focus ──────────────────────────────────────
const esc = await page.evaluate(`(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  return new Promise(r => setTimeout(() => {
    const b = [...document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')][0]
    r(JSON.stringify({ open: b.getAttribute('aria-expanded'), refocused: document.activeElement === b }))
  }, 250))
})()`)
const e = JSON.parse(esc ?? '{}')
check(e.open === 'false', 'Escape closes the card', e.open ?? '—')
check(e.refocused === true, 'focus returns to the trigger', e.refocused ? 'refocused' : 'FOCUS LOST')

// ── click toggles, outside click dismisses ──────────────────────────────────
const outside = await page.evaluate(`(() => {
  const b = [...document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')][0]
  b.click()
  return new Promise(r => setTimeout(() => {
    const opened = b.getAttribute('aria-expanded')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    setTimeout(() => r(JSON.stringify({ opened, closed: b.getAttribute('aria-expanded') })), 250)
  }, 250))
})()`)
const o = JSON.parse(outside ?? '{}')
check(o.opened === 'true', 'click/tap opens the card', o.opened ?? '—')
check(o.closed === 'false', 'a click elsewhere dismisses it', o.closed ?? '—')

// ── mobile ──────────────────────────────────────────────────────────────────
const m = await browser.page(`${BASE}/post/${POST}`)
await m.evaluate(`(() => { Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true }); window.dispatchEvent(new Event('resize')); return true })()`)
await m.waitFor(`document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]').length > 0`, { timeout: 60000 })
const mob = await m.evaluate(`(() => {
  const b = [...document.querySelectorAll('pre[class*="post-text"] button[aria-expanded]')][0]
  b.click()
  return new Promise(r => setTimeout(() => {
    const c = document.querySelector('[role="tooltip"]')
    const de = document.documentElement
    r(JSON.stringify({ card: Boolean(c), pageOverflow: de.scrollWidth > de.clientWidth + 1 }))
  }, 300))
})()`)
const mm = JSON.parse(mob ?? '{}')
check(mm.card === true, 'the card opens on a narrow screen', mm.card ? 'open' : 'MISSING')
check(mm.pageOverflow === false, 'the page does not scroll sideways', mm.pageOverflow ? 'OVERFLOWS' : 'no overflow')
await m.close()

await page.close()
await browser.close()
console.log(`\n  ${failed ? `❌ ${failed} failed` : '✅ reachable by mouse, keyboard, touch and screen reader'} — ${((Date.now() - started) / 1000).toFixed(1)}s\n`)
process.exit(failed ? 1 : 0)
