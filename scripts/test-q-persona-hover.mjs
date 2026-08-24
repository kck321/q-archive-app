// WHAT "Q" MEANS ON A DROP THAT DOES NOT WRITE THE EQUATION.
//
//   node scripts/test-q-persona-hover.mjs [baseUrl] [--fresh]
//
// OWNER RULING 2026-08-24 (UPDATED report, sheet 6):
//   "q does = alice in the pertaining post but any other post i would make the hover synopsis
//    that q is a group of people less than 10 or how ever q explains it somewhere in the post"
//
// #74 and #78 WRITE "Q = Alice". The other 73 drops carrying the designation inherit it, and a
// reader hovering "Q" on #2519 was shown only Alice's global line — "“Alice” is a person in this
// archive." — which says nothing about what the label is doing there.
//
// Asserted on the CARD a reader opens, not on the JSON, because the two-layer hover is exactly the
// thing that can be right in the file and invisible on screen: the global line and the post line
// are rendered from different lookups.
import { launch, DROP_READY } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

/** Open the info card on the first standalone "Q" in the drop body and read it.
 *
 * CLICK ONLY. The trigger opens on mouseenter, focus OR click, and click TOGGLES — so dispatching
 * a synthetic mouseenter and then clicking opens the card and immediately closes it again. React
 * delegates enter/leave through mouseout/mouseover anyway, so the synthetic event is not what a
 * reader's pointer does either. The card is found through aria-describedby, which is the same
 * handle a screen reader follows. */
const OPEN_Q_CARD = `(async () => {
  const host = [...document.querySelectorAll('pre[class*="post-text"]')].pop()
  if (!host) return 'NO BODY'
  const t = el => (el.textContent ?? '').trim()
  const btn = [...host.querySelectorAll('button')].find(e => /^[^A-Za-z0-9]*Q[^A-Za-z0-9]*$/.test(t(e)))
  if (!btn) return 'NO Q TARGET'
  btn.click()
  await new Promise(r => setTimeout(r, 300))
  const id = btn.getAttribute('aria-describedby')
  const card = id ? document.getElementById(id) : null
  return JSON.stringify({ label: btn.getAttribute('aria-label') ?? '', card: card ? t(card) : 'CARD DID NOT OPEN' })
})()`

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} ${String(got).slice(0, 90)}`) }
console.log(`\nQ IS THE DESIGNATION, EXCEPT WHERE Q WRITES THE EQUATION  (${mode}${browser.reused ? ', reused' : ''})\n`)

// Three drops that INHERIT the equation, and the two that state it.
const INHERITS = [2519, 1697, 958]
const STATES = [74, 78]

for (const n of [...INHERITS, ...STATES]) {
  const page = await browser.page(`${BASE}/post/${n}`)
  try {
    await page.waitFor(DROP_READY, { timeout: 60000 })
    const raw = await page.waitFor(OPEN_Q_CARD, { timeout: 25000 }).catch(e => 'ERR ' + e.message)
    const got = typeof raw === 'string' && raw.startsWith('{') ? JSON.parse(raw) : { label: '', card: String(raw) }
    const text = `${got.label} ${got.card}`
    if (INHERITS.includes(n)) {
      check(/is the designation itself/.test(text), `#${n} the card says Q is the designation`, text.slice(0, 80))
      check(/less than 10 people/.test(text), `#${n}   and quotes what Q says it stands for`, /less than 10 people/.test(text) ? "“(less than 10 people) only three are non-military.”" : text.slice(0, 80))
      check(/written by Q on #74 and #78, not here/.test(text), `#${n}   and says where the equation IS written`, /not here/.test(text) ? 'ok' : text.slice(0, 80))
    } else {
      check(!/is the designation itself/.test(text), `#${n} STATES the equation — keeps its own reading`, text.slice(0, 80))
      check(/Alice/.test(text), `#${n}   the card still reads Alice`, /Alice/.test(text) ? 'ok' : text.slice(0, 80))
    }
  } finally { await page.close() }
}

await browser.close()
console.log(`\n  ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}\n`)
process.exit(failed === 0 ? 0 : 1)
