// Apply the certified Codes & Brackets dataset.
//
// A notation layer. Q's exact characters are preserved and a detected pattern never implies its
// meaning is known — 734 of the 739 codes ship with no interpretation at all, which is the
// honest state for this section.
//
// CROSS-SECTION OVERLAP IS INTENTIONAL for the 32 bracketed entity references. Entities asks
// who is referenced; Codes asks how Q marked the reference. "HRC" and "[HRC]" are different
// analytical objects, so each is counted once in its own section and cross-linked — the same
// arrangement already used for the 228 Question <-> Directive overlaps.
//
//   node scripts/apply-codes.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CODE_TYPE_INFO, KNOWN_MEANINGS } from './lib/codes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const dry = process.argv.includes('--dry')

const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'codes-audit.json'), 'utf8'))
const adj = JSON.parse(fs.readFileSync(path.join(OUT, 'codes-adjudicated.json'), 'utf8'))

const byKey = new Map(adj.decisions.map(d => [d.normalizedKey, d]))
const rejected = new Set(adj.decisions.filter(d => !d.outcome.startsWith('CERTIFIED_CODE')).map(d => d.normalizedKey))

const codes = audit.codes.filter(c => !rejected.has(c.key)).map(c => {
  const d = byKey.get(c.key)
  const known = KNOWN_MEANINGS[c.key] ?? null
  return {
    normalizedKey: c.key,
    sourceTexts: c.sourceTexts,
    codeType: c.codeType,
    recurrenceCount: c.recurrenceCount,
    posts: c.posts,
    // Never invented. Only where the corpus itself carries the evidence.
    interpretedMeaning: known?.meaning ?? null,
    interpretationConfidence: known?.confidence ?? null,
    interpretationBasis: known?.basis ?? null,
    resolved: Boolean(known),
    linkedEntityId: d?.linkedEntityId ?? null,
    provenance: d?.provenance ?? 'Codes audit v1',
  }
})
const occurrences = audit.occurrences.filter(o => !rejected.has(o.normalizedKey))

const byType = {}
for (const o of occurrences) byType[o.codeType] = (byType[o.codeType] ?? 0) + 1
const linked = codes.filter(c => c.linkedEntityId)

const out = {
  certified: true,
  note: 'Inclusion means the pattern appears code-like or structurally significant. It does not mean its meaning is known.',
  totals: {
    occurrences: occurrences.length,
    distinctCodes: codes.length,
    posts: new Set(occurrences.map(o => o.postNum)).size,
    byType,
    interpreted: codes.filter(c => c.resolved).length,
    unresolved: codes.filter(c => !c.resolved).length,
    crossLinkedToEntities: linked.length,
    inResolutionCenter: adj.decisions.filter(d => d.outcome === 'CERTIFIED_CODE_UNRESOLVED').length,
    excludedBracketEmphasis: audit.totals.routedToEmphasis,
    excludedDates: audit.totals.excludedAsDates,
  },
  typeInfo: CODE_TYPE_INFO,
  codes,
}

// ── QA gate ─────────────────────────────────────────────────────────────────
const invented = codes.filter(c => c.interpretedMeaning && !KNOWN_MEANINGS[c.normalizedKey])
const missingBasis = codes.filter(c => c.interpretedMeaning && !c.interpretationBasis)
const checks = [
  ['code occurrences = 1,949', out.totals.occurrences === 1949, out.totals.occurrences],
  ['distinct codes = 739', out.totals.distinctCodes === 739, out.totals.distinctCodes],
  ['posts = 852', out.totals.posts === 852, out.totals.posts],
  ['interpreted = 5', out.totals.interpreted === 5, out.totals.interpreted],
  ['unresolved = 734', out.totals.unresolved === 734, out.totals.unresolved],
  ['cross-linked to Entities = 32', linked.length === 32, linked.length],
  ['no interpretation without evidence', invented.length === 0, `${invented.length} invented`],
  ['every interpretation states its basis', missingBasis.length === 0, `${missingBasis.length} unstated`],
  ['bracket-emphasis stays excluded', out.totals.excludedBracketEmphasis.occurrences === 769, out.totals.excludedBracketEmphasis.occurrences],
  ['dates stay excluded', out.totals.excludedDates.occurrences === 405, out.totals.excludedDates.occurrences],
  ['every code keeps its exact source text', codes.every(c => c.sourceTexts.length > 0), 'ok'],
]

console.log('\nAPPLY CERTIFIED CODES & BRACKETS\n')
console.log(`  occurrences     : ${out.totals.occurrences.toLocaleString()}`)
console.log(`  distinct codes  : ${out.totals.distinctCodes.toLocaleString()}`)
console.log(`  posts           : ${out.totals.posts.toLocaleString()}`)
console.log(`  interpreted     : ${out.totals.interpreted}   unresolved: ${out.totals.unresolved.toLocaleString()}`)
console.log(`  cross-linked    : ${linked.length} bracketed entity references`)
console.log('\n  QA GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(38)} ${got}`) }
if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: codes.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'codes.json'), JSON.stringify(out))
console.log(`\nwrote public/data/codes.json (${(fs.statSync(path.join(DATA, 'codes.json')).size / 1048576).toFixed(2)} MB)\n`)
