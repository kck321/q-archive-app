// Browser proof: Back returns you to where you were, not to the top.
//
// The archive pages are thousands of rows long, so landing at the top after Back means
// re-scrolling past hundreds of posts to find your place. This asserts the real thing a
// reader does: scroll deep, open a drop, press Back, and still be where you were.
//
// It runs at BOTH breakpoints on purpose. The scroll container differs — <main> owns the
// scrollbar on desktop (`lg:overflow-y-auto`), the document owns it on phones — and the bug
// this gate was written for only ever showed on desktop, because the save and the restore
// were both aimed at the document while <main> was the element actually moving.
import { launch } from './lib/browser.mjs'
import { resolveBase } from './lib/pipeline.mjs'

const BASE = resolveBase(process.argv.slice(2))
const fail = m => { console.error(`FAIL: ${m}`); process.exitCode = 1 }
const ok = m => console.log(`ok: ${m}`)

const b = await launch()
console.log(`browser on :${b.port} (${b.reused ? 'warm' : 'cold'}) against ${BASE}`)

// Read/write whichever element actually scrolls — the same question the component asks.
const SCROLLER = `(() => {
  const m = document.querySelector('main')
  if (m) { const oy = getComputedStyle(m).overflowY; if (oy === 'auto' || oy === 'scroll') return m }
  return document.scrollingElement || document.documentElement
})()`

async function check(label, viewport, path, linkPattern) {
  const p = await b.page(`${BASE}${path}`, viewport)
  // Wait for a list long enough to scroll.
  await p.waitFor(`${SCROLLER}.scrollHeight > ${SCROLLER}.clientHeight + 800`, { timeout: 60000 })
  await p.evaluate(`${SCROLLER}.scrollTop = 1500`)
  await p.waitFor(`${SCROLLER}.scrollTop > 1400`, { timeout: 10000 })
  const before = Number(await p.evaluate(`${SCROLLER}.scrollTop`))
  if (!(before > 1400)) { fail(`${label}: could not scroll (got ${before})`); await p.close(); return }

  // Navigate into a drop the way a reader does, then come back.
  const clicked = await p.evaluate(`(() => {
    const a = [...document.querySelectorAll('a')].find(x => ${linkPattern}.test(x.getAttribute('href') || ''))
    if (!a) return false
    a.click(); return true
  })()`)
  if (!clicked) { fail(`${label}: found no link matching ${linkPattern}`); await p.close(); return }

  await p.waitFor(`location.pathname !== ${JSON.stringify(path.split('?')[0])}`, { timeout: 20000 })
  await p.evaluate(`history.back()`)
  await p.waitFor(`location.pathname === ${JSON.stringify(path.split('?')[0])}`, { timeout: 20000 })

  // Give the restorer its retry window (it re-applies until the list is tall enough).
  const restored = await p.waitFor(`${SCROLLER}.scrollTop > ${Math.floor(before * 0.8)}`, { timeout: 15000 })
  const after = Number(await p.evaluate(`${SCROLLER}.scrollTop`))
  if (restored) ok(`${label}: Back restored ${after}px (was ${before}px)`)
  else fail(`${label}: Back landed at ${after}px, expected ~${before}px`)
  await p.close()
}

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, touch: false }
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
await check('desktop /posts', DESKTOP, '/posts', String.raw`/^\/post\//`)
await check('phone /posts',   PHONE, '/posts', String.raw`/^\/post\//`)
await check('desktop /pics',  DESKTOP, '/pics',  String.raw`/^\/post\//`)

// ── The archive replaces its own URL, end to end ─────────────────────────────
//
// PostArchive syncs its search state with `setUrlParams({}, { replace: true })`, a REPLACE onto the
// SAME scroll key. That used to cancel an in-flight Back restoration and reset the reader to the
// top. The RULE is proved deterministically by scripts/test-scroll-navigation-policy.mjs; this is
// the integration half — that the rule is actually wired to a real browser, a real router and the
// real <main>, in one document.
//
// It is NOT a differentiator. Whether it catches the old implementation depends on winning the same
// race the policy test removed, so it is not asked to. /pics is deliberately absent: QPostPics
// issues no navigation at all, so it cannot produce this REPLACE and has no place in a check named
// for it. /pics keeps the ordinary restoration check above.
async function archiveReplaceIntegration(path, linkPattern) {
  const p = await b.page(`${BASE}${path}`, DESKTOP)
  await p.waitFor(`${SCROLLER}.scrollHeight > ${SCROLLER}.clientHeight + 800`, { timeout: 60000 })

  // The harness must be driving the element the app actually scrolls, or this proves nothing.
  const sameEl = await p.evaluate(`${SCROLLER} === document.querySelector('main')`)
  if (String(sameEl) !== 'true') { fail(`${path}: the harness is not driving the app's <main>`); await p.close(); return }

  // And a full document load would exercise none of the routing, so prove one document throughout.
  await p.evaluate(`window.__scrollProofDoc = (window.__scrollProofDoc || Math.random().toString(36).slice(2))`)
  const doc0 = await p.evaluate(`window.__scrollProofDoc`)

  // Ordinary reader pacing on purpose. Forcing the scroll and the click into one task is what
  // made this shape of check flaky — it turns the gate into a race for the restore loop to win.
  // The archive issues its same-key REPLACE on every visit regardless, so ordinary pacing still
  // exercises it; the deterministic proof of the rule lives in the policy test, not here.
  await p.evaluate(`${SCROLLER}.scrollTop = 1500`)
  await p.waitFor(`${SCROLLER}.scrollTop > 1400`, { timeout: 10000 })
  const before = Number(await p.evaluate(`${SCROLLER}.scrollTop`))
  const clicked = await p.evaluate(`(() => {
    const a = [...document.querySelectorAll('a')].find(x => ${linkPattern}.test(x.getAttribute('href') || ''))
    if (!a) return 'none'
    a.click(); return 'ok'
  })()`)
  if (clicked !== 'ok') { fail(`${path} (archive REPLACE): found no link matching ${linkPattern}`); await p.close(); return }

  await p.waitFor(`location.pathname !== ${JSON.stringify(path)}`, { timeout: 20000 })
  await p.evaluate(`history.back()`)
  await p.waitFor(`location.pathname === ${JSON.stringify(path)}`, { timeout: 20000 })

  const restored = await p.waitFor(`${SCROLLER}.scrollTop > 1200`, { timeout: 15000 })
  const after = Number(await p.evaluate(`${SCROLLER}.scrollTop`))
  const doc1 = await p.evaluate(`window.__scrollProofDoc`)

  if (doc0 !== doc1 || !doc1) fail(`${path} (archive REPLACE): the navigation left the document — this run proves nothing`)
  else if (restored) ok(`${path} (archive REPLACE): Back restored ${after}px in one document, through the archive's own same-key replacement`)
  else fail(`${path} (archive REPLACE): Back landed at ${after}px, expected ~${before}px`)
  await p.close()
}

// The phone checks above are only controls if they genuinely exercise the document scroller.
async function phoneUsesDocumentScroller(path) {
  const p = await b.page(`${BASE}${path}`, PHONE)
  await p.waitFor(`document.querySelector('main') !== null`, { timeout: 60000 })
  const out = JSON.parse(await p.evaluate(`(() => {
    const m = document.querySelector('main')
    const oy = getComputedStyle(m).overflowY
    return JSON.stringify({ overflowY: oy, mainScrolls: oy === 'auto' || oy === 'scroll' })
  })()`))
  if (out.mainScrolls) fail(`phone ${path}: <main> owns the scrollbar (overflowY ${out.overflowY}) — the phone control is not testing the document`)
  else ok(`phone ${path}: the document owns the scrollbar (<main> overflowY ${out.overflowY})`)
  await p.close()
}

await archiveReplaceIntegration('/posts', String.raw`/^\/post\//`)
await phoneUsesDocumentScroller('/posts')
await phoneUsesDocumentScroller('/pics')

// ── One scrollbar, not two ───────────────────────────────────────────────────
//
// On desktop <main> owns the scrollbar and the document must not scroll at all. A second bar
// appeared on exactly the pages carrying a month chart, because MonthFilter's aria-live region
// is `sr-only` — position:absolute — and <main> was not a positioning context, so its containing
// block was <body>. That put a 1x1 invisible element at the page's full content depth, escaping
// main's overflow and giving the document ~21px of scrollable height: a full-length second
// scrollbar for one pixel of content. <main> is now `relative`, which contains it.
async function noDoubleScrollbar(path) {
  const p = await b.page(`${BASE}${path}`, DESKTOP)
  await p.waitFor(`document.querySelector('main') !== null`, { timeout: 60000 })
  await p.waitFor(`${SCROLLER}.scrollHeight > ${SCROLLER}.clientHeight + 200`, { timeout: 60000 }).catch(() => {})
  const out = await p.evaluate(`(() => {
    const de = document.documentElement, m = document.querySelector('main')
    return JSON.stringify({ over: de.scrollHeight - de.clientHeight, mainScrolls: m.scrollHeight > m.clientHeight + 1 })
  })()`)
  const o = JSON.parse(out)
  if (o.over > 1) fail(`${path}: document scrolls ${o.over}px as well as <main> — two scrollbars`)
  else ok(`${path}: one scrollbar (document overflow ${o.over}px, main scrolls ${o.mainScrolls})`)
  await p.close()
}
for (const r of ['/posts', '/analysis?tab=claims', '/analysis?tab=namedEntities', '/analysis?tab=themes', '/pics'])
  await noDoubleScrollbar(r)

console.log(process.exitCode ? '\nSCROLL RESTORATION PROOF: FAILED' : '\nSCROLL RESTORATION PROOF: GREEN')
