// Prove the "read the drops here" control opens the actual posts, IN POST ORDER, under the chips.
//
// OWNER REQUEST: "when I click on themes within the post analysis I like how it shows all the
// posts. But I want it to also open the post below all the post numbers in order so I can scan
// through them."
//
//   node scripts/test-inline-drop-reader.mjs [baseUrl] [--fresh]
import { launch, ROWS_READY } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${got}`) }

console.log(`\nINLINE DROP READER — THEMES TAB  (${mode}${browser.reused ? ', reused' : ''})\n`)
const started = Date.now()

const mark = (l) => console.log(`    · ${l.padEnd(34)} ${((Date.now() - started) / 1000).toFixed(1)}s`)
const page = await browser.page(`${BASE}/analysis?tab=themes`)
mark('tab opened')
const ready = await page.waitFor(ROWS_READY, { timeout: 60000 })

const READER_BUTTON = `[...document.querySelectorAll('button')].find(b => (b.textContent ?? '').indexOf('read ') >= 0 && (b.textContent ?? '').indexOf('drop') >= 0)`

mark(ready ? 'rows rendered' : 'rows NEVER rendered')
const label = ready ? await page.evaluate(`(() => { const b = ${READER_BUTTON}; return b ? b.textContent.trim() : '' })()`) : ''
check(Boolean(label), 'the row offers a "read drops" control', label || 'MISSING')

if (label) {
  await page.evaluate(`(() => { const b = ${READER_BUTTON}; b?.click(); return true })()`)
  // Wait for the panel to actually contain drops, rather than for a guessed number of seconds.
  await page.waitFor(`document.querySelectorAll('[data-drop-reader] div.bg-q-panel').length > 1`, { timeout: 45000 })

  mark('drops opened')
  const state = await page.evaluate(`(() => {
    const panel = document.querySelector('[data-drop-reader]')
    const cards = panel ? [...panel.querySelectorAll('div.bg-q-panel')] : []
    // parseInt, not a regex: see the note in test-alias-visibility.mjs.
    const nums = cards.map(c => parseInt(((c.innerText ?? '').split('#')[1] ?? '').trim(), 10)).filter(n => Number.isFinite(n))
    const closeLabel = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').indexOf('close drops') >= 0)?.textContent ?? null
    return JSON.stringify({ bodies: panel ? panel.querySelectorAll('pre').length : 0, nums, closeLabel })
  })()`)
  const s = JSON.parse(state)
  const ascending = s.nums.every((n, i) => i === 0 || n >= s.nums[i - 1])
  check(s.bodies > 0, 'clicking it renders drop bodies inline', `${s.bodies} drop bodies`)
  check(Boolean(s.closeLabel), 'the control flips to a close action', s.closeLabel ?? 'NOT TOGGLED')
  check(s.nums.length > 1 && ascending, 'the drops are rendered in post order',
    `${s.nums.length} drops: ${s.nums.slice(0, 8).join(', ')}${s.nums.length > 8 ? '…' : ''}`)
}

await page.close()
await browser.close()
console.log(`\n  ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(failed ? `  ${failed} check(s) FAILED\n` : '  the drops open inline, in post order\n')
process.exit(failed ? 1 : 0)
