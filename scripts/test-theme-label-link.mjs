// Clicking a theme's NAME in the list must land on that theme filtered, with its drops open.
//
//   node scripts/test-theme-label-link.mjs [baseUrl] [--fresh]
import { launch, ROWS_READY } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${got}`) }
console.log(`\nTHEME LABEL IS THE WAY IN  (${mode}${browser.reused ? ', reused' : ''})\n`)
const started = Date.now()

const page = await browser.page(`${BASE}/analysis?tab=themes`)
await page.waitFor(ROWS_READY, { timeout: 60000 })

// The first theme name in the unfiltered list — whatever it happens to be.
const first = await page.evaluate(`(() => {
  const a = [...document.querySelectorAll('a[href*="tab=themes&q="]')][0]
  return a ? JSON.stringify({ text: a.textContent.trim(), href: a.getAttribute('href') }) : ''
})()`)
check(Boolean(first), 'the theme name is a link, not dead text', first ? JSON.parse(first).text : 'STILL A SPAN')

if (first) {
  const { text } = JSON.parse(first)
  await page.evaluate(`(() => { [...document.querySelectorAll('a[href*="tab=themes&q="]')][0].click(); return true })()`)
  const filtered = await page.waitFor(`location.search.indexOf('q=') > -1 ? 1 : 0`, { timeout: 20000 })
  check(Boolean(filtered), 'it navigates to that theme, filtered', decodeURIComponent(await page.evaluate('location.search')))

  const opened = await page.waitFor(`document.querySelectorAll('div.mt-2.mb-3.border-t div.bg-q-panel').length > 1`, { timeout: 45000 })
  const nums = await page.evaluate(`(() => {
    const panel = document.querySelector('div.mt-2.mb-3.border-t')
    const cards = panel ? [...panel.querySelectorAll('div.bg-q-panel')] : []
    return JSON.stringify(cards.map(c => parseInt(((c.innerText ?? '').split('#')[1] ?? '').trim(), 10)).filter(n => Number.isFinite(n)))
  })()`)
  const list = JSON.parse(nums)
  const ascending = list.every((n, i) => i === 0 || n >= list[i - 1])
  check(Boolean(opened) && list.length > 1 && ascending, `"${text}" opens its drops oldest first`, `${list.length}: ${list.slice(0, 6).join(', ')}…`)
}

await page.close()
await browser.close()
console.log(`\n  ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(failed ? `  ${failed} check(s) FAILED\n` : '  the name opens the theme\n')
process.exit(failed ? 1 : 0)
