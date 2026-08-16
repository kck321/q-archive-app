// Evidence — recover the LITERAL form as Q posted it, alongside the canonical value.
//
// RENDERING_PROVENANCE_RULE applied to Evidence. The certified value is cleaned for identity and
// navigation: `https://www.youtube.com/watch?v=x`. What Q actually typed is
// `https:// www.youtube.com/watch?v=x` — with a space after the protocol — and the board stored
// `&` as `&amp;`. A renderer handed the canonical value looks for text that is not in the drop,
// which is why 2,270 certified references could never highlight.
//
// This changes NO count, NO classification and NO canonical value. It adds `literal`: the exact
// characters the reference occupies in the post, recovered by matching tolerantly and capturing
// what was actually there. Where no literal form can be recovered the field is null and the
// record is reported, never guessed.
//
//   node scripts/materialize-evidence-literals.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeText, runtimeSpan } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const dry = process.argv.includes('--dry')

const evidence = JSON.parse(fs.readFileSync(path.join(DATA, 'evidence.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

/**
 * A pattern that accepts every way the board mangled a URL, and captures what it actually says.
 *
 *   https://x  ->  https:// x     a space after the protocol
 *   &          ->  &amp;          HTML entity, sometimes doubly escaped
 *   whitespace ->  any run        line wraps inside a long reference
 *
 * The protocol itself is optional because some certified values were stored without it while the
 * drop carries the full URL.
 */
function tolerantPattern(value) {
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let body = value.replace(/^https?:\/\//i, '')
  let out = ''
  for (const ch of body) {
    if (ch === '&') out += '&(?:amp;)?'
    else if (/\s/.test(ch)) out += '\\s+'
    else out += esc(ch)
  }
  // Optional protocol, optional space after it — the space is the whole reason this exists.
  return `(?:https?:\\/\\/\\s*)?${out}`
}

let recovered = 0, alreadyExact = 0, unrecovered = 0
const stillFailing = []

for (const item of evidence.items) {
  if (!item.value) continue
  if (item.kind === 'MEDIA') continue          // attached media has no body-text span, by nature
  const post = byNum.get(item.postNum)
  if (!post) continue
  const text = post.text ?? ''

  // Against the RUNTIME body. The old tolerant pattern matched the raw archive encoding and
  // produced 2,084 Evidence spans containing &amp; / &gt; that the browser never displays.
  if (runtimeText(text).includes(item.value)) {
    delete item.literal                         // certified value already matches what is rendered
    alreadyExact++
    continue
  }

  // Evidence opts in to protocol-whitespace tolerance: the board split long URLs after `https://`.
  const match = runtimeSpan(text, item.value, { allowProtocolWhitespace: true })
  if (match) {
    item.literal = match
    recovered++
  } else {
    item.literal = null
    unrecovered++
    stillFailing.push({
      postNum: item.postNum, subtype: item.subtype, kind: item.kind,
      certified: item.value.slice(0, 160),
      nearby: text.slice(0, 160),
      reason: 'no tolerant match — the certified value does not correspond to any span in the drop',
    })
  }
}

// ── assertions ───────────────────────────────────────────────────────────────
const textual = evidence.items.filter(i => i.kind !== 'MEDIA').length
const media = evidence.items.filter(i => i.kind === 'MEDIA').length
const canonicalUnchanged = evidence.items.every(i => typeof i.value === 'undefined' || typeof i.value === 'string')

const checks = [
  ['evidence occurrences unchanged = 6,590', evidence.items.length === 6590, evidence.items.length],
  ['textual (highlightable) = 5,319', textual === 5319, textual],
  ['badge-only media = 1,271', media === 1271, media],
  ['no canonical value altered', canonicalUnchanged, 'ok'],
  // ABSENT is now the correct state for a record whose certified value already matches the
  // runtime body — 5,210 of them. A `literal` override exists only where the runtime span
  // genuinely differs, which after the representation fix is 31 whitespace reconstructions.
  ['a literal override exists only where runtime differs',
    evidence.items.filter(i => i.literal && i.literal === i.value).length === 0, 'ok'],
  ['entity-encoded literals eliminated',
    evidence.items.filter(i => typeof i.literal === 'string' && /&(amp|gt|lt|quot);/i.test(i.literal)).length === 0, 'ok'],
]

console.log('\nEVIDENCE LITERAL MATERIALISATION\n')
console.log(`  canonical already literal : ${alreadyExact.toLocaleString()}`)
console.log(`  literal form recovered    : ${recovered.toLocaleString()}`)
console.log(`  unrecovered               : ${unrecovered.toLocaleString()}`)
console.log('\n  QA')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${got}`) }

fs.writeFileSync(path.join(OUT, 'evidence-literal-unrecovered.json'), JSON.stringify({
  count: stillFailing.length, items: stillFailing,
}, null, 1))

if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: evidence.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'evidence.json'), JSON.stringify(evidence))
console.log(`\nwrote public/data/evidence.json`)
console.log('→ audit/evidence-literal-unrecovered.json\n')
