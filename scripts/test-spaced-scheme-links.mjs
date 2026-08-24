// Q'S OWN TYPO IN AN ADDRESS STILL HAS TO PRODUCE A WORKING LINK.
//
//   node scripts/test-spaced-scheme-links.mjs [baseUrl] [--fresh]
//
// 44 drops write the scheme with a space after it — "https:// wikileaks.org/podesta-emails/629".
// Where the host then began with "www." linkify's bare-www alternative caught it anyway and the
// address was live, which is why this went unnoticed for so long. Where it did NOT, 23 addresses
// rendered as plain grey text: no anchor, no colour, nothing to click.
//
// Asserted in a browser rather than against the regex, because the regex is not what a reader
// clicks. Two things have to hold at once, and they pull in opposite directions:
//
//   the LINK TEXT is exactly what Q typed, space included — this archive never rewrites his words
//   the HREF has the space removed — a browser cannot follow one, and a dead link is worse than
//   no link because it looks like it worked
import { launch, DROP_READY } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

// One from each shape: a bare host (was dead), a www. host (was live but only half-anchored),
// and a query string that must survive intact.
const CASES = [
  { post: 866, typed: 'https:// wikileaks.org/clinton-emails/emailid/629', href: 'https://wikileaks.org/clinton-emails/emailid/629' },
  { post: 1129, typed: 'http:// thehill.com/homenews/administration/382714-clinton-advised-pompeo-to-stop-the-purge-of-state-dept', href: 'http://thehill.com/homenews/administration/382714-clinton-advised-pompeo-to-stop-the-purge-of-state-dept' },
  { post: 927, typed: 'https:// m.youtube.com/watch?v=aBv8kqKck6E&sns=em', href: 'https://m.youtube.com/watch?v=aBv8kqKck6E&sns=em' },
  { post: 676, typed: 'https:// www.fbi.gov/about/leadership-and-structure/fbi-executives/carl-ghattas', href: 'https://www.fbi.gov/about/leadership-and-structure/fbi-executives/carl-ghattas' },
]

/** Every anchor in the drop body, as text + href pairs. */
const ANCHORS = `(() => {
  const host = [...document.querySelectorAll('pre[class*="post-text"]')].pop()
  if (!host) return '[]'
  return JSON.stringify([...host.querySelectorAll('a[href]')].map(a => ({
    t: (a.textContent ?? '').replace(/\\s+/g, ' ').trim(),
    h: a.getAttribute('href') ?? '',
  })))
})()`

const browser = await launch({ mode })
let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} ${got}`) }
console.log(`\nA SPACED SCHEME STILL LINKS  (${mode}${browser.reused ? ', reused' : ''})\n`)
const started = Date.now()

for (const c of CASES) {
  const page = await browser.page(`${BASE}/post/${c.post}`)
  try {
    await page.waitFor(DROP_READY, { timeout: 60000 })
    const raw = await page.waitFor(`${ANCHORS}.length > 2 ? ${ANCHORS} : 0`, { timeout: 25000 }).catch(() => '[]')
    const anchors = JSON.parse(typeof raw === 'string' && raw.startsWith('[') ? raw : '[]')
    const want = c.typed.replace(/\s+/g, ' ').trim()
    const hit = anchors.find(a => a.t === want)
    check(Boolean(hit), `#${c.post} the address Q typed is ONE anchor`, hit ? 'anchored' : `no anchor (${anchors.length} on the drop)`)
    if (hit) check(hit.h === c.href, `#${c.post}   href has the space removed`, hit.h.slice(0, 70))
  } finally {
    await page.close()
  }
}

console.log(`\n  ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(failed ? `\n  ${failed} FAILED\n` : '\n  a spaced scheme links, and the href works\n')
await browser.close()
process.exit(failed ? 1 : 0)
