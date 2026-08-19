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

const BASE = process.env.QDROPS_BASE ?? 'http://localhost:5173'
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
  const p = await b.page(`${BASE}${path}`, { viewport })
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

await check('desktop /posts', { width: 1440, height: 900 }, '/posts', String.raw`/^\/post\//`)
await check('phone /posts',   { width: 390, height: 844 },  '/posts', String.raw`/^\/post\//`)
await check('desktop /pics',  { width: 1440, height: 900 }, '/pics',  String.raw`/^\/post\//`)

console.log(process.exitCode ? '\nSCROLL RESTORATION PROOF: FAILED' : '\nSCROLL RESTORATION PROOF: GREEN')
