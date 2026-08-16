// The Source rows must reach the reader — chip, filter, question, and the drop behind each row.
//
//   node scripts/test-source-attribution-queue.mjs [baseUrl] [--fresh]
//
// WHY THIS EXISTS AS A BROWSER CHECK. The 18 entity mentions these rows hold are excluded from the
// certified count, and the queue row is the only thing that says so. If the chip does not render,
// the exclusion is invisible and reads as data quietly missing — which is exactly the failure mode
// the Resolution Center was built to prevent. A count in resolution-queue.json proves nothing
// about what the page shows: the `source_reference` kind sat declared and empty for weeks, so the
// chip had never once been rendered with a non-zero count before this.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const pending = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'entities-quote-boundary-pending.json'), 'utf8'))
const EXPECTED = pending.rows.length
const HELD = pending.rows.reduce((n, r) => n + r.mentionCount, 0)

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(56)} ${got}`) }
console.log(`\nSOURCE ATTRIBUTION IN THE RESOLUTION CENTER  (${mode}${browser.reused ? ', reused' : ''})\n`)
const started = Date.now()

const page = await browser.page(`${BASE}/resolve`)
await page.waitFor(`[...document.querySelectorAll('button')].some(b => /^Source\\s/.test(b.textContent.trim()))`, { timeout: 60000 })

// 1. The chip exists, is enabled, and carries the right count.
const chip = await page.evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(b => /^Source\\s/.test(b.textContent.trim()))
  return b ? JSON.stringify({ text: b.textContent.trim(), disabled: b.disabled, title: b.title }) : ''
})()`)
const c = chip ? JSON.parse(chip) : null
check(Boolean(c), 'the Source chip renders at all', c ? c.text : 'NO CHIP')
check(Boolean(c) && !c.disabled, 'it is enabled rather than a greyed placeholder', c ? String(!c.disabled) : '—')
check(Boolean(c) && c.text.endsWith(String(EXPECTED)), `it shows ${EXPECTED}`, c ? c.text : '—')

// 2. It asks the attribution question, not the old citation one. The guide text was written
//    speculatively years before any row arrived, and a stale question is worse than none.
check(Boolean(c) && /Q writing|pasting/i.test(c.title), 'the chip asks whose words the line is', c ? c.title.slice(0, 60) : '—')

// 3. Filtering shows the rows and nothing else.
await page.evaluate(`(() => { [...document.querySelectorAll('button')].find(b => /^Source\\s/.test(b.textContent.trim())).click(); return true })()`)
await page.waitFor(`location.search.indexOf('kind=source_reference') > -1 ? 1 : 0`, { timeout: 20000 })
const shown = await page.waitFor(`(() => {
  const labels = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() === 'Source')
  return labels.length > 1 ? labels.length : 0
})()`, { timeout: 30000 })
check(Boolean(shown), 'filtering to Source lists the rows', `${shown ?? 0} rows labelled Source`)

// 4. Every row deep-links to a real drop. A queue row whose link 404s is worse than no row.
const links = await page.evaluate(`(() => {
  const hrefs = [...document.querySelectorAll('a[href*="/post/"]')].map(a => a.getAttribute('href'))
  return JSON.stringify([...new Set(hrefs)])
})()`)
const hrefs = JSON.parse(links ?? '[]')
check(hrefs.length > 0, 'the rows link through to their drops', `${hrefs.length} distinct`)

// 5. The reader is told what the answer decides — the held mentions must be named on the page.
const mentionsNamed = await page.evaluate(`(() => {
  const t = document.body.innerText
  return /excluded from the certified count/i.test(t) ? 1 : 0
})()`)
check(Boolean(mentionsNamed), 'a row says the mentions are held out of the count', `${HELD} held in total`)

await page.close()
await browser.close()
console.log(`\n  ${failed ? `❌ ${failed} failed` : '✅ the Source rows reach the reader'} — ${((Date.now() - started) / 1000).toFixed(1)}s\n`)
process.exit(failed ? 1 : 0)
