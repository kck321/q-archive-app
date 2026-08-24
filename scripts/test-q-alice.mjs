// THE Q RULING, AT THE SURFACE THE OWNER NAMED.
//
//   node scripts/test-q-alice.mjs [baseUrl] [--fresh]
//
// "in post 74 i want the Q in this to be an entity and any other post that has Q within it that
//  isn't the signature at the bottom — Q = Alice"
//
// Three things have to hold together, and the third is the one that broke first:
//
//   1. a standalone Q that is NOT the sign-off paints as an Entity and reads "Q — Alice"
//   2. where something else covers the same characters it is SOLID, in front  (#74's "Q = Alice"
//      is a certified Claim, so the Q sits on top of one)
//   3. the SIGN-OFF Q paints nothing. The data scopes the ruling by line and character; the
//      renderer paints a certified term wherever it appears, so #74 came out with its closing Q
//      cyan — the one occurrence the ruling excludes.
import { launch, DROP_READY } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

const MARKS = `(() => {
  const host = [...document.querySelectorAll('pre[class*="post-text"]')].pop()
  if (!host) return '[]'
  return JSON.stringify([...host.querySelectorAll('mark,button')]
    .filter(el => /^[“"']?Q[”"']?$/.test((el.textContent ?? '').trim()))
    .map(el => ({
      cls: String(el.className ?? ''),
      label: el.getAttribute('aria-label') ?? el.getAttribute('title') ?? '',
    })))
})()`

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(56)} ${got}`) }
console.log(`\nQ = ALICE  (${mode}${browser.reused ? ', reused' : ''})\n`)

for (const post of [74, 1697, 2519]) {
  const page = await browser.page(`${BASE}/post/${post}`)
  try {
    await page.waitFor(DROP_READY, { timeout: 60000 })
    const marks = JSON.parse(await page.evaluate(MARKS).catch(() => '[]'))
    const glossed = marks.filter(m => /Q — Alice/.test(m.label))
    check(glossed.length > 0, `#${post} a standalone Q reads "Q — Alice"`,
      glossed.length ? `${glossed.length} target(s)` : 'NO GLOSS')
    // Nothing may carry the entity fill on the sign-off: every entity-filled Q must be one the
    // ruling covers, and the ruling covers none that are the sign-off.
    const cyan = marks.filter(m => /bg-cyan/.test(m.cls))
    const unlabelled = cyan.filter(m => !m.label)
    check(unlabelled.length === 0, `#${post} the sign-off Q carries no entity fill`,
      unlabelled.length ? `${unlabelled.length} UNLABELLED cyan mark(s)` : 'clean')
  } finally {
    await page.close()
  }
}

// #74 is the case the owner named: "Q = Alice" is a certified Claim, so the Q is an entity ON a claim.
{
  const page = await browser.page(`${BASE}/post/74`)
  try {
    await page.waitFor(DROP_READY, { timeout: 60000 })
    const marks = JSON.parse(await page.evaluate(MARKS).catch(() => '[]'))
    const solid = marks.find(m => /bg-cyan-300/.test(m.cls))
    check(Boolean(solid), '#74 the Q in "Q = Alice" is SOLID over the claim',
      solid ? solid.label || 'solid' : 'NOT SOLID')
  } finally {
    await page.close()
  }
}

console.log(failed ? `\n  ${failed} FAILED\n` : '\n  Q is Alice, on top and solid, and the sign-off is left alone\n')
await browser.close()
process.exit(failed ? 1 : 0)
