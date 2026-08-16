// Regression fixtures for the rendering coordinate system.
//
// Two rules must hold and must not bleed into each other:
//   runtimeText()  answers only "what does the browser render?"
//   runtimeSpan()  answers "where is this certified occurrence inside that text?"
//
// Protocol-whitespace tolerance is a MATCHING concession Evidence opts into. If it ever applies
// by default, every other layer starts silently matching text it should not.
//
//   node scripts/test-runtime-span.mjs
import { runtimeText, runtimeSpan } from './lib/runtimeText.mjs'

const cases = []
const check = (name, actual, expected) => cases.push({ name, ok: actual === expected, actual, expected })

// ── runtimeText: representation only ─────────────────────────────────────────
check('decodes &amp;', runtimeText('For God &amp; Country'), 'For God & Country')
check('decodes &gt;', runtimeText('SA -&gt; NK.'), 'SA -> NK.')
check('decodes &lt;', runtimeText('a &lt; b'), 'a < b')
check('strips board markup', runtimeText('https:<em>//</em>x.com'), 'https://x.com')
check('leaves plain text alone', runtimeText('Nothing to decode.'), 'Nothing to decode.')

// ── runtimeSpan: locating an occurrence ──────────────────────────────────────
check('exact match needs no override', runtimeSpan('Panic in DC.', 'Panic in DC.'), 'Panic in DC.')
check('certified value matches decoded body',
  runtimeSpan('For God &amp; Country', 'For God & Country'), 'For God & Country')
check('reconstructs across a line break',
  runtimeSpan('one\nsentence here', 'one sentence here'), 'one\nsentence here')

// ── URL tolerance: only when opted in ────────────────────────────────────────
const OPT = { allowProtocolWhitespace: true }
check('ordinary URL', runtimeSpan('see https://example.com now', 'https://example.com', OPT), 'https://example.com')
check('https:// with a space', runtimeSpan('see https:// example.com now', 'https://example.com', OPT), 'https:// example.com')
check('http:// with a space', runtimeSpan('see http:// example.com now', 'http://example.com', OPT), 'http:// example.com')
check('URL with a decoded query entity',
  runtimeSpan('go https:// x.com/a?b=1&c=2 end', 'https://x.com/a?b=1&c=2', OPT), 'https:// x.com/a?b=1&c=2')
check('URL whose entity is decoded from the raw body',
  runtimeSpan('go https:// x.com/a?b=1&amp;c=2 end', 'https://x.com/a?b=1&c=2', OPT), 'https:// x.com/a?b=1&c=2')

// ── the concession must NOT leak ─────────────────────────────────────────────
check('protocol tolerance is off by default',
  runtimeSpan('see https:// example.com now', 'https://example.com'), null)
check('tolerance does not invent a match in ordinary prose',
  runtimeSpan('The truth is coming.', 'https://example.com', OPT), null)
check('a non-URL value is unaffected by the flag',
  runtimeSpan('Panic in DC.', 'Panic in NY.', OPT), null)

const failed = cases.filter(c => !c.ok)
console.log('\nRUNTIME SPAN FIXTURES\n')
for (const c of cases) {
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`)
  if (!c.ok) console.log(`        expected ${JSON.stringify(c.expected)}\n        actual   ${JSON.stringify(c.actual)}`)
}
console.log(`\n  ${cases.length - failed.length}/${cases.length} fixtures pass\n`)
process.exit(failed.length ? 1 : 0)
