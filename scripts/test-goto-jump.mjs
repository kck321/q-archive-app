// A drop's header number, and the "Go to Post" box, must LAND you on that card.
//
// Three versions of this failed in three different ways, so the assertion is deliberately strict:
//   1. ?q=#8 searched the text "#8" and returned a one-post search page.
//   2. The paging loop treated "a page is loading" as "no more pages" and gave up after one page.
//   3. The card mounted and the page sat ~30 drops short, because rows above were still being
//      committed when the scroll fired.
// So: the card must exist AND be on screen. Mounted is not arrived.
//
//   node scripts/test-goto-jump.mjs [baseUrl] [--fresh]
import { launch } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(46)} ${got}`) }
console.log(`\nGOTO JUMP  (${mode}${browser.reused ? ', reused' : ''})\n`)

// #8 sits at the very start and #4900 at the very end — the worst case at each end of a paged list.
for (const n of [8, 4900, 524]) {
  const page = await browser.page(`${BASE}/posts?goto=${n}`)

  const mounted = await page.waitFor(`document.querySelector('[data-post-num="${n}"]') ? 1 : 0`, { timeout: 90000 })
  check(Boolean(mounted), `#${n} card is mounted`, mounted ? 'mounted' : 'NOT FOUND')

  const onScreen = await page.waitFor(`(() => {
    const el = document.querySelector('[data-post-num="${n}"]')
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return (r.top > -300 && r.top < window.innerHeight) ? 1 : 0
  })()`, { timeout: 25000 })
  check(Boolean(onScreen), `#${n} is scrolled into view`, onScreen ? 'on screen' : 'OFF SCREEN')

  // Which drop is actually at the top of the viewport — the symptom the owner reported was
  // "it takes me like 30 posts away", which a mounted-only assertion cannot see.
  const nearest = await page.evaluate(`(() => {
    const cards = [...document.querySelectorAll('[data-post-num]')]
    let best = null, bestD = 1e9
    for (const c of cards) {
      const d = Math.abs(c.getBoundingClientRect().top - window.innerHeight / 2)
      if (d < bestD) { bestD = d; best = c.getAttribute('data-post-num') }
    }
    return best
  })()`)
  check(String(nearest) === String(n), `#${n} is the drop at the centre of the screen`, `centre = #${nearest}`)

  await page.close()
}

await browser.close()
console.log(failed ? `\n  ${failed} check(s) FAILED\n` : '\n  the jump lands on the drop, from either end\n')
process.exit(failed ? 1 : 0)
