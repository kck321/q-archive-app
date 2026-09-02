// A /pics RESTORATION MUST NOT DESTROY THE POSITION IT IS RESTORING TO.
//
// This is the follow-up defect, and it is NOT the /posts same-route REPLACE repair — that one is
// held by test-scroll-navigation-policy.mjs and test-scroll-restoration.mjs, and both stay green.
//
// WHAT /pics DOES THAT NO OTHER PAGE DOES
// ───────────────────────────────────────
// A restoration here is a CLIMB, not a jump. 1,870 tiles mount 100 at a time behind an
// IntersectionObserver sentinel, so on Back the container is ~9,800px tall and the saved target
// may be 150,000. The restorer writes scrollTop = target, the browser CLAMPS it to the bottom of
// what exists, that clamp brings the sentinel into view, the window grows by a batch, and it
// writes again. Measured on the editorial server: ~19 cycles, 7-8 seconds, passing through
// 27,665 / 37,185 / 46,425 / 55,665 / 65,185 / … on the way up.
//
// THE DEFECT. Every one of those writes fires a scroll event, and the passive listener recorded
// each one as the reader's position — so the climb was continuously written over the target it
// was climbing to. Leave mid-climb and the last clamped intermediate is what persists. Measured
// before the repair, interrupting 1.2s in:
//
//     reader sits at            150000
//     saved on leaving          150000   (faithful)
//     mid-climb, interrupting    55665   (600 of 1,870 tiles)
//     saved after interruption   65185
//     second Back lands at       65185   — 85,000px short
//
// And it RATCHETS: each interrupted Back saves a smaller number, so the next starts lower and has
// less climbing to do before it is interrupted again, walking the reader towards the top of the
// grid. That is "/pics occasionally lands at the top", and no timeout can fix it — the timeout
// was never the thing that was wrong.
//
// WHY THIS TEST IS DETERMINISTIC. It does not wait for a flaky race; it CAUSES the condition. The
// climb genuinely takes seconds, so interrupting it at a fixed offset is reliable, and the
// assertion is on a stored number rather than on a rendered pixel. Run against the pre-repair
// commit it fails; after it passes.
//
//   node scripts/test-pics-restore-ratchet.mjs [base] [--fresh]
import { launch } from './lib/browser.mjs'

const BASE = process.argv.find(a => a.startsWith('http')) ?? process.env.QDROPS_BASE ?? 'http://localhost:5173'
const FRESH = process.argv.includes('--fresh')

const TARGET = 150000
const INTERRUPT_MS = 1200
const BATCH = 100

const results = []
let pass = 0, fail = 0
const check = (label, ok, detail = '') => { results.push([label, ok, detail]); ok ? pass++ : fail++ }

const SAVED = `(() => { try { return JSON.parse(sessionStorage.getItem('q-scroll-positions') || '{}')['/pics'] ?? null } catch { return null } })()`
const TOP = `(() => { const d = document.scrollingElement || document.documentElement; return Math.round(d.scrollTop) })()`
const TILES = `document.querySelectorAll('img[loading="lazy"]').length`
const HEIGHT = `(() => { const d = document.scrollingElement || document.documentElement; return Math.round(d.scrollHeight) })()`
const intoDrop = `(() => {
  const a = [...document.querySelectorAll('a[href*="/post/"]')].find(x => x.getBoundingClientRect().top > 0)
  if (!a) return false
  a.click()
  return true
})()`

const b = await launch({ mode: FRESH ? 'fresh' : 'warm' })
const p = await b.page(`${BASE}/pics`)

// ── Grow the grid the way a reader does ─────────────────────────────────────────────────────────
const gridUp = await p.waitFor(`${TILES} > 50 ? true : null`, { timeout: 120000 })
check('the picture grid renders', gridUp === true)
if (!gridUp) { await p.close(); await b.close({ keepWarm: !FRESH }); report() }

for (let i = 0; i < 20; i++) {
  await p.evaluate(`(() => { const d = document.scrollingElement || document.documentElement; d.scrollTop = d.scrollHeight; window.dispatchEvent(new Event('scroll')); return true })()`)
  if (!await p.waitFor(`${TILES} > ${BATCH * (i + 1)} ? true : null`, { timeout: 15000, every: 200 })) break
}
await p.waitForStable(TILES, { stableFor: 3, every: 300, timeout: 30000 })
const grown = await p.evaluate(TILES)
const fullHeight = await p.evaluate(HEIGHT)
check('the whole grid can be reached by scrolling', grown > 1500 && fullHeight > TARGET,
  `${grown} tiles, ${fullHeight}px`)

// ── The reader sits deep in it, then opens a drop ───────────────────────────────────────────────
await p.evaluate(`(() => { const d = document.scrollingElement || document.documentElement; d.scrollTop = ${TARGET}; window.dispatchEvent(new Event('scroll')); return true })()`)
await new Promise(r => setTimeout(r, 800))
const sitting = await p.evaluate(TOP)
check('the reader is deep in the grid', Math.abs(sitting - TARGET) <= 50, String(sitting))

await p.evaluate(intoDrop)
await p.waitFor(`location.pathname.startsWith('/post/') ? true : null`, { timeout: 30000 })
await new Promise(r => setTimeout(r, 800))
const savedHonest = await p.evaluate(SAVED)
check('leaving /pics saves the position faithfully', savedHonest === TARGET, String(savedHonest))

// ── Back, and interrupt the climb before it arrives ─────────────────────────────────────────────
await p.evaluate('history.back(); true')
await new Promise(r => setTimeout(r, INTERRUPT_MS))
const midTop = await p.evaluate(TOP)
const midTiles = await p.evaluate(TILES)

// The premise: at this moment the restoration is genuinely still climbing. If it had already
// arrived there would be nothing to interrupt and the test would prove nothing.
check('the restoration is still climbing when interrupted',
  midTop > 0 && midTop < TARGET - 1000 && midTiles < grown,
  `at ${midTop} of ${TARGET}, ${midTiles} of ${grown} tiles`)

const left = await p.evaluate(intoDrop)
check('a drop can be opened mid-climb', left === true)
await p.waitFor(`location.pathname.startsWith('/post/') ? true : null`, { timeout: 30000 })
await new Promise(r => setTimeout(r, 900))

// ── THE ASSERTION ───────────────────────────────────────────────────────────────────────────────
const savedAfter = await p.evaluate(SAVED)
check('THE INTERRUPTED CLIMB DID NOT OVERWRITE THE SAVED POSITION',
  savedAfter === savedHonest,
  savedAfter === savedHonest ? `still ${savedAfter}` : `${savedHonest} -> ${savedAfter} (lost ${savedHonest - savedAfter}px)`)

// ── And the reader actually gets back there ─────────────────────────────────────────────────────
await p.evaluate('history.back(); true')
let last = -1, stable = 0
for (let i = 0; i < 100; i++) {
  await new Promise(r => setTimeout(r, 250))
  const t = await p.evaluate(TOP)
  if (t === last) { if (++stable >= 5) break } else { stable = 0; last = t }
}
check('a second Back lands where the reader actually was',
  Math.abs(last - TARGET) <= 200, `${last} of ${TARGET}`)

await p.close()
await b.close({ keepWarm: !FRESH })
report()

function report() {
  console.log(`\n/PICS RESTORE RATCHET — ${BASE}${FRESH ? ' (cold profile)' : ''}\n`)
  for (const [label, ok, detail] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)}${detail ? `  — ${detail}` : ''}`)
  console.log(`\n  ${pass} passed, ${fail} failed`)
  if (fail) {
    console.error('\n[X] a /pics restoration is recording its own clamped intermediates as the reader\'s position.')
    console.error('    Each interrupted Back then saves a smaller number and walks them towards the top.\n')
    process.exit(1)
  }
  console.log('')
  process.exit(0)
}
