// A theme chip should land on that theme's row with its drops ALREADY OPEN, oldest first, and
// keep opening more as you scroll — no second click, no "+25 more" hunting.
//
//   node scripts/test-theme-auto-open.mjs [baseUrl] [--fresh]
import { launch, ROWS_READY } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'
const THEME = args.find(a => !a.startsWith('http') && !a.startsWith('--')) ?? 'Media & Information'

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${got}`) }
console.log(`\nTHEME → DROPS OPEN  (${mode}${browser.reused ? ', reused' : ''})\n`)
const started = Date.now()

// Exactly the URL a theme chip in a post links to.
const page = await browser.page(`${BASE}/analysis?tab=themes&q=${encodeURIComponent(THEME)}`)
await page.waitFor(ROWS_READY, { timeout: 60000 })

const READ_PANEL = `document.querySelectorAll('div.mt-2.mb-3.border-t div.bg-q-panel').length`
const opened = await page.waitFor(`${READ_PANEL} > 1`, { timeout: 45000 })
check(Boolean(opened), 'drops open without a second click', opened ? 'auto-opened' : 'STILL CLOSED')

const first = await page.evaluate(`(() => {
  const panel = document.querySelector('div.mt-2.mb-3.border-t')
  const cards = panel ? [...panel.querySelectorAll('div.bg-q-panel')] : []
  const nums = cards.map(c => parseInt(((c.innerText ?? '').split('#')[1] ?? '').trim(), 10)).filter(n => Number.isFinite(n))
  return JSON.stringify({ count: nums.length, nums: nums.slice(0, 6), last: nums[nums.length - 1] ?? null })
})()`)
const f = JSON.parse(first)
const ascending = f.nums.every((n, i) => i === 0 || n >= f.nums[i - 1])
check(f.count > 1 && ascending, 'oldest first', `${f.count} open: ${f.nums.join(', ')}…`)

// Scroll to the bottom: the sentinel should mount the next batch with no click.
await page.evaluate(`(() => { window.scrollTo(0, document.body.scrollHeight); return true })()`)
const grew = await page.waitFor(`${READ_PANEL} > ${f.count}`, { timeout: 30000 })
const after = await page.evaluate(`(() => JSON.stringify({ count: document.querySelectorAll('div.mt-2.mb-3.border-t div.bg-q-panel').length }))()`)
check(Boolean(grew), 'scrolling opens more without clicking', `${f.count} → ${JSON.parse(after).count}`)

await page.close()
await browser.close()
console.log(`\n  ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(failed ? `  ${failed} check(s) FAILED\n` : '  a theme opens its drops, oldest first, and keeps opening as you scroll\n')
process.exit(failed ? 1 : 0)
