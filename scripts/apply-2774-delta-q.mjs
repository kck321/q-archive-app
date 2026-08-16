// Post #2774 [0] DELTA + the body-text Q entity rule.
//
// DELTA-2774-1-16 is timing notation, not an entity: a claimed zero-minute / same-displayed-time
// interval between a Q post and a POTUS post. "(3)" is the third such match that day. Q's own
// follow-up in #2775 says the drops came "just prior", so the gloss says same DISPLAYED timestamp
// rather than claiming identical seconds were proven. The coordination reading is the post's
// CLAIMED implication and is recorded as such, not as verified fact.
//
// Q/POTUS yields TWO spans. The slash is a pairing, and merging Q with Donald Trump would invent
// an entity neither post names.
//
// SIGNATURE EXCLUSION IS STRUCTURAL, NOT POST-LEVEL. Each of these five posts contains BOTH a
// meaningful body reference to Q and a terminal bare "Q" sign-off, so suppressing the whole post
// would delete the reference and suppressing nothing would tag the signature. The rule: find the
// last non-empty line of the Q-authored body; if it is exactly "Q", it is a signature.
//
// Offsets are computed from clean(), not raw text. #2567 and #2876 carry &gt; and &amp;, and a
// raw offset would land in the wrong place once entities are decoded.
//
//   node scripts/apply-2774-delta-q.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

// High-confidence body references only. Everything else goes to the review file, unresolved.
const TARGETS = {
  2774: { note: '"(3) Q/POTUS [0] DELTA" — Q paired with POTUS in a timing comparison.' },
  2567: { note: '"Q/POTUS Twitter 0 Delta Exchanges" — Q paired with POTUS.' },
  2775: { note: '"Important to note \'Q\' drops just prior to POTUS." — Q naming itself.' },
  365:  { note: '"Q/POTUS-1" through "Q/POTUS-5" — five paired timing comparisons.' },
  2876: { note: 'Body references to \'Q\' and PRO POTUS/Q — alignment language, still the persona.' },
}
// Conventional strings that merely contain Q. None is the persona.
const NOT_PERSONA = [/10-Q/i, /AL-Q/i, /Q&A/i, /Q\s*:/, /\?q=/i, /Q\s+Clearance/i, /Q\+/]

const occ = {}
const skipped = []
for (const num of Object.keys(TARGETS).map(Number)) {
  const p = byNum.get(num)
  const lines = clean(p.text ?? '').split('\n')
  // Structural signature test: the LAST non-empty line, evaluated on the body as stored.
  let sigLine = -1
  for (let i = lines.length - 1; i >= 0; i--) { if (lines[i].trim()) { sigLine = lines[i].trim() === 'Q' ? i : -1; break } }
  const pairs = []
  lines.forEach((line, li) => {
    if (li === sigLine) { skipped.push(`#${num} line ${li} — terminal signature`); return }
    const rx = /Q/g
    let m
    while ((m = rx.exec(line)) !== null) {
      const window = line.slice(Math.max(0, m.index - 8), m.index + 12)
      if (NOT_PERSONA.some(r => r.test(window))) { skipped.push(`#${num} line ${li} — ${JSON.stringify(window)}`); continue }
      pairs.push([li, m.index])
    }
  })
  if (pairs.length) occ[num] = pairs
}

console.log('Q persona occurrences to materialise:')
for (const [n, pairs] of Object.entries(occ)) console.log(`  #${n}  ${pairs.map(([l, c]) => `${l}:${c}`).join(' ')}   ${TARGETS[n].note}`)
console.log('\nexcluded:')
for (const s of skipped) console.log('  ' + s)
const total = Object.values(occ).reduce((a, b) => a + b.length, 0)
console.log(`\ntotal occurrences: ${total}`)
if (process.argv.includes('--dry')) process.exit(0)

// ── Q entity ruling ──────────────────────────────────────────────────────────
const P = path.join(ROOT, 'audit/entities-owner-rulings.json')
const j = JSON.parse(fs.readFileSync(P, 'utf8'))
j.aliasRulings.push({
  alias: 'Q', canonical: 'Q', recount: true, ruledOn: '2026-08-16',
  createIfMissing: true, type: 'coded_alias',
  includePosts: Object.keys(occ).map(Number).sort((a, b) => a - b),
  includeOccurrences: occ,
  reasoning: 'Inside Q-authored body text, Q referring to the speaker/poster resolves to the Q persona. The TERMINAL standalone Q is a signature and is excluded structurally — the last non-empty body line — never by post-level suppression, because each of these posts contains both a body reference and a sign-off.',
  readerNote: 'The Q poster/persona speaking to the public through the imageboards. Q/POTUS is a pairing, not a combined entity: Q is not Donald Trump.',
  retrieval: `Occurrence-scoped to ${total} body references across ${Object.keys(occ).length} posts. Terminal signatures excluded. 10-Q, AL-Q, Q&A, "Q:", ?q=, Q Clearance and Q+ are held for review, not swept in.`,
  renderNote: 'RENDERING_PROVENANCE_RULE: the renderer highlights the token, the form Q wrote.',
})
fs.writeFileSync(P, JSON.stringify(j, null, 2) + '\n')

// ── DELTA notation gloss ─────────────────────────────────────────────────────
const NG = path.join(ROOT, 'audit/notation-glossary.json')
const ng = JSON.parse(fs.readFileSync(NG, 'utf8'))
ng.glosses.push({
  token: 'DELTA', kind: 'notation', posts: [2774], ruledOn: '2026-08-16',
  meaning: 'zero-minute or same-displayed-time Q/POTUS posting interval',
  detail: 'Timing notation, not a person, place, organization or operational codename. "(3)" counts the third such match reported that day. #2567 states the concept outright as "Q/POTUS Twitter 0 Delta Exchanges", and #2775 answers "3 [0] Deltas today sir". Q adds that the drops came JUST PRIOR to POTUS, so this is a same-displayed-timestamp claim, not proof of identical seconds. The posts present the matches as evidence of coordination — that is the CLAIM being recorded, not a verified fact.',
  reasoning: 'Owner ruling: RESOLVED_NON_ENTITY. Scoped to #2774 only. The "Q, DELTA" sign-offs (#756, #757, #785), "DELTA [6] CONF." (#804) and Delta Air Lines (#1176) are separate occurrences and are untouched.',
})
fs.writeFileSync(NG, JSON.stringify(ng, null, 2) + '\n')

// ── close the DELTA queue row ────────────────────────────────────────────────
const RP = path.join(ROOT, 'audit/resolution-owner-resolved.json')
const rj = JSON.parse(fs.readFileSync(RP, 'utf8'))
if (!rj.resolved.some(r => r.id === 'DELTA-2774-1-16')) {
  rj.resolved.push({ id: 'DELTA-2774-1-16', postNum: 2774, token: 'DELTA', resolvedOn: '2026-08-16',
    resolution: 'RESOLVED_NON_ENTITY — zero-minute or same-displayed-time Q/POTUS posting interval. Timing notation, not an entity. Scoped to #2774; the DELTA sign-offs and Delta Air Lines are untouched.',
    batch: 'Post #2774 [0] DELTA + body-Q entity rule' })
}
fs.writeFileSync(RP, JSON.stringify(rj, null, 2) + '\n')
console.log('\nQ ruling written · DELTA gloss written · DELTA-2774-1-16 closed')
