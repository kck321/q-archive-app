// A QUOTED DROP IS SHOWN WITH ITS OWN LINE BREAKS, SO ITS OWN RULINGS CAN LAND.
//
//   node scripts/test-quoted-linebreaks.mjs [baseUrl] [--fresh]
//
// The `references` field was destroyed at ingest and the quoted bodies were re-scraped from
// qalerts. The re-scrape lost line breaks: 106 of the 1,320 quotes that resolve to a drop we hold
// come back as the same characters with different whitespace.
//
// #1012 is the one the owner found. It quotes #1011, whose own text reads
//
//     RUSSIA NEW THREAT.
//     COINCIDENCE?
//
// and whose certified record says exactly that — "RUSSIA NEW THREAT." is a Claim, "COINCIDENCE?"
// is a Question. The scrape ran the two together as "RUSSIA NEW THREAT.COINCIDENCE?", and
// QuotedPosts marks a resolved quote up from the DROP's analysis, so both matchers misfired at
// once: `expandToSentence` reads "." followed by a letter as "twitter.com" rather than a full
// stop and let the Claim swallow the whole line, while `UNIT_START` needs whitespace after a
// terminator so the Question could not open a unit at all. The question disappeared and the line
// painted amber end to end — on a drop where the archive holds both rulings correctly.
//
// Asserted in the browser, on the quoted block and not on the helper, because what failed was
// what a reader saw. #1011's own page is checked in the same run: it was always right, and it is
// the control that says the repair changed the QUOTE and not the ruling.
import { launch, DROP_READY } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

/** Every <mark> inside one element, as text + class pairs, plus the element's own text. */
const marksIn = (sel, last = false) => `(() => {
  const all = [...document.querySelectorAll(${JSON.stringify(sel)})]
  const host = all[${last ? 'all.length - 1' : '0'}]
  if (!host) return '0'
  return JSON.stringify({
    text: host.textContent ?? '',
    marks: [...host.querySelectorAll('mark')].map(m => ({
      t: m.textContent ?? '', c: m.getAttribute('class') ?? '', ti: m.getAttribute('title') ?? '',
    })),
  })
})()`

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(60)} ${got}`) }
console.log(`\nA QUOTED DROP KEEPS ITS LINE BREAKS  (${mode}${browser.reused ? ', reused' : ''})\n`)

// ── The quote, on #1012 ──────────────────────────────────────────────────────
{
  const page = await browser.page(`${BASE}/post/1012`)
  try {
    await page.waitFor(DROP_READY, { timeout: 60000 })
    // QuotedPosts loads its drop context ASYNCHRONOUSLY. Until that resolves the quote renders
    // through the anon fallback — entities and brackets only, three marks on this block — and the
    // drop's own text is not in play yet. Waiting on the marked-up state is what makes this a
    // measurement of the repair rather than a race against the first paint. It does NOT prejudge
    // the answer: the un-repaired render reaches the same mark count with the claim swallowing
    // the question, and the assertions below are what tell the two apart.
    await page.waitFor(`document.querySelectorAll('#quoted-894467 pre mark').length >= 6`, { timeout: 25000 })
    const raw = await page.waitFor(`${marksIn('#quoted-894467 pre')}`, { timeout: 25000 }).catch(() => '0')
    const got = raw && raw !== '0' ? JSON.parse(raw) : { text: '', marks: [] }

    check(/RUSSIA NEW THREAT\.\s*\n\s*COINCIDENCE\?/.test(got.text),
      'the quote breaks the line the way #1011 does',
      JSON.stringify(got.text.match(/RUSSIA[^\n]*\n?[^\n]*/)?.[0] ?? '(block not found)'))

    const q = got.marks.find(m => m.t.trim() === 'COINCIDENCE?')
    check(Boolean(q), 'COINCIDENCE? is marked at all', q ? q.ti || 'question' : 'no mark')
    check(Boolean(q) && /blue/.test(q.c), 'COINCIDENCE? is marked as a QUESTION (blue)', q ? q.c : '-')

    const runOn = got.marks.find(m => /THREAT\.\s*COINCIDENCE/i.test(m.t))
    check(!runOn, 'no single mark swallows the claim AND the question', runOn ? JSON.stringify(runOn.t) : 'none')

    // The entity RUSSIA is certified inside the claim and renders solid in front of it, so the
    // claim reaches the DOM as the tail " NEW THREAT." — the same two marks #1011's own page has.
    const ent = got.marks.find(m => m.t.trim() === 'RUSSIA' && /entity/.test(m.ti))
    check(Boolean(ent), 'RUSSIA is still the entity, solid, in front', ent ? ent.ti : 'no mark')
    const claim = got.marks.find(m => m.t.trim() === 'NEW THREAT.')
    check(Boolean(claim), 'the rest of the claim is still a claim', claim ? claim.c.slice(0, 40) : 'no mark')
  } finally { await page.close() }
}

// ── The control: #1011's own page, which was never wrong ─────────────────────
{
  const page = await browser.page(`${BASE}/post/1011`)
  try {
    await page.waitFor(DROP_READY, { timeout: 60000 })
    // The drop's OWN body is the last post-text block on the page; the ones before it are quotes.
    await page.waitFor(`[...document.querySelectorAll('pre[class*="post-text"]')].pop()?.querySelectorAll('mark').length >= 6`, { timeout: 25000 })
    const raw = await page.waitFor(`${marksIn('pre[class*="post-text"]', true)}`, { timeout: 25000 }).catch(() => '0')
    const got = raw && raw !== '0' ? JSON.parse(raw) : { text: '', marks: [] }
    const q = got.marks.find(m => m.t.trim() === 'COINCIDENCE?')
    check(Boolean(q) && /blue/.test(q.c), '#1011 itself still shows COINCIDENCE? as a question', q ? q.c : 'no mark')
  } finally { await page.close() }
}

await browser.close()
console.log(`\n  ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}\n`)
process.exit(failed === 0 ? 0 : 1)
