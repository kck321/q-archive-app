// The reader's acronym info box: does it appear, and does it say the RIGHT thing in THIS drop?
//
// The whole risk of this feature is confident mislabelling. BO is Barack Obama in #36 and Bruce
// Ohr in #1828; RT is Rex Tillerson in #947 and "real time" in #220. A box that shows the most
// common reading everywhere would be worse than no box at all, so every case below asserts the
// meaning, not merely that something popped up.
//
//   node scripts/test-term-info.mjs [baseUrl] [--fresh]
import { launch } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

// post, token, the meaning that must appear, and how it is rendered there
const CASES = [
  [36, 'BO', 'Barack Obama', 'entity'],
  [1828, 'BO', 'Bruce Ohr', 'entity'],
  [1296, 'BO', 'Board Owner', 'entity'],
  [947, 'RT', 'Rex Tillerson', 'entity'],
  [220, 'RT', 'real time', 'notation'],
  [1109, 'RT', 'retweet', 'notation'],
  [4171, 'MI', 'Michigan', 'entity'],
  [10, 'MI', 'Military Intelligence', 'entity'],
  [620, 'SIS', 'MI6', 'entity'],
  [436, 'DNI', 'Director of National Intelligence', 'entity'],
  // The seven-token batch: every token below carries more than one meaning in the corpus, which
  // is the only reason the box has to be post-scoped at all.
  [1828, 'CM', 'Cheryl Mills', 'entity'],
  [474, 'CM', 'CodeMonkey', 'entity'],
  [1151, 'SS', 'Supreme Court', 'entity'],
  [30, 'SS', 'United States Secret Service', 'entity'],
  [1828, 'WASH', 'Washington Free Beacon', 'entity'],
  [524, 'WASH', 'Washington, D.C.', 'entity'],
  // Joined two-word name: the highlight and the box both cover "WASH POST", not just "WASH".
  [2401, 'WASH POST', 'Washington Post', 'entity'],
  [1317, 'BC', 'Bill Clinton', 'entity'],
  [874, 'JA', 'Julian Assange', 'entity'],
  [493, 'PP', 'Planned Parenthood', 'entity'],
  [120, 'WL', 'WikiLeaks', 'entity'],
  // Office vs officeholder, and two people sharing a token inside one drop.
  [1990, 'DAG', 'Deputy Attorney General', 'entity'],
  [67, 'JK', 'Jared Kushner', 'entity'],
  [1317, 'JK', 'John Kerry', 'entity'],
  [571, 'JB', 'Jeff Bezos', 'entity'],
  [1828, 'JB', 'James Baker', 'entity'],
  [534, 'NYC', 'New York City', 'entity'],
  [1148, 'RBG', 'Ruth Bader Ginsburg', 'entity'],
  [484, 'AWAN', 'Imran Awan', 'entity'],
  [4137, 'HCQ', 'Hydroxychloroquine', 'entity'],
]

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${got}`) }
console.log(`\nREADER INFO BOX  (${mode}${browser.reused ? ', reused' : ''})\n`)

for (const [postNum, token, meaning, kind] of CASES) {
  const page = await browser.page(`${BASE}/post/${postNum}`)
  await page.waitFor(`document.body.innerText.length > 500 ? 1 : 0`, { timeout: 60000 })
  // WAIT FOR THE TARGET, NOT FOR THE BODY. glossary.json is fetched after first paint, so the
  // info-box wrappers appear a beat later. Querying on body-ready found whichever page happened to
  // win the race and reported the other nine as broken — the feature was fine, the test was early.
  await page.waitFor(`[...document.querySelectorAll('span.relative.inline-block')]
    .some(w => (w.innerText || '').trim() === ${JSON.stringify(token)}) ? 1 : 0`, { timeout: 20000 })

  // Find the token's hover target and PRESS it — press, not hover, because the owner asked for
  // both and a touch device never fires mouseenter.
  //
  // PRESS THE AFFORDANCE, NOT THE WRAPPER. The trigger became a real <button> inside the wrapper
  // span when the tooltip moved to the shared HoverCard primitive, and a click dispatched on the
  // wrapper never reaches it — events bubble up, not down. This test went red on all 88 checks
  // while the feature worked, because it was pressing a millimetre of nothing around the word.
  const opened = await page.evaluate(`(() => {
    const wraps = [...document.querySelectorAll('span.relative.inline-block')]
    const hit = wraps.find(w => (w.innerText || '').trim() === ${JSON.stringify(token)})
    if (!hit) return 'NO TARGET'
    const target = hit.querySelector('button') ?? hit
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return 'clicked'
  })()`)
  if (opened !== 'clicked') {
    check(false, `#${postNum} ${token} has an info-box target`, opened)
    await page.close()
    continue
  }

  const shown = await page.waitFor(`(() => {
    const wraps = [...document.querySelectorAll('span.relative.inline-block')]
    const hit = wraps.find(w => (w.innerText || '').trim().startsWith(${JSON.stringify(token)}))
    if (!hit) return 0
    const t = hit.innerText || ''
    return t.length > ${token.length} ? t : 0
  })()`, { timeout: 8000 })

  const text = String(shown || '')
  check(text.includes(meaning), `#${postNum} ${token} reads "${meaning}"`, text.replace(/\s+/g, ' ').slice(0, 64) || 'nothing shown')
  // A gloss must never claim to be a certified entity, and vice versa.
  const claimsEntity = /·\s*entity/i.test(text)
  check(kind === 'entity' ? claimsEntity : !claimsEntity, `#${postNum} ${token} is labelled ${kind}`,
    claimsEntity ? 'entity' : 'not an entity')

  // ON SCREEN, fully. The box existed and read correctly all along; it opened half outside the
  // window, which made it useless exactly where Q writes most of his acronyms — at line ends and
  // at the top of a drop. Assert the rectangle, not the text.
  // Built by concatenation, not a nested template: a `${...}` inside a template that is itself
  // inside a template is how three earlier assertions in this project silently became literals.
  const box = await page.evaluate('(() => {' +
    '  const want = ' + JSON.stringify(meaning) + ';' +
    '  const b = [...document.querySelectorAll("span.fixed")].find(x => (x.innerText || "").includes(want));' +
    '  if (!b) return "NO BOX";' +
    '  const r = b.getBoundingClientRect();' +
    '  const inside = r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;' +
    '  return inside ? "on screen" : ("OFF SCREEN l=" + Math.round(r.left) + " t=" + Math.round(r.top) +' +
    '    " r=" + Math.round(r.right) + "/" + window.innerWidth + " b=" + Math.round(r.bottom) + "/" + window.innerHeight);' +
    '})()')
  check(box === 'on screen', `#${postNum} ${token} box is fully on screen`, box)

  await page.close()
}

await browser.close()
console.log(failed ? `\n  ${failed} check(s) FAILED\n` : `\n  every acronym explains itself, correctly for the drop it is in\n`)
process.exit(failed ? 1 : 0)
