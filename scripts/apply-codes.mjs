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

// ── The unhighlighted-sentence queue, ruled by the owner (2026-08-20) ────────
//
// 15 lines the owner ruled to be Q's bracket notation. Seven were already certified codes; the
// other eight are the shape the detector deliberately routed away as bracket EMPHASIS - multi-word
// lower-case phrases like "[We hear you]", "[Impossible to defend]", "[Less than 10]". The owner
// has now ruled them notation, and an owner ruling outranks a detector verdict.
//
// THE PAINT WAS NEVER THE PROBLEM HERE. bracketSpansIn() marks anything in [..] red on both
// surfaces regardless of certification, so all fifteen already showed red in the drop body. What
// this adds is SECTION MEMBERSHIP: they now appear in Codes & Brackets, which is where a reader
// goes to see the notation gathered up.
//
// The detector's own excludedBracketEmphasis tally is left EXACTLY as the audit recorded it. That
// number is the history of a decision the detector made, not a live population, and rewriting it
// would erase the record of what was overruled. The movement is reported as its own submetric.
const QUEUE = path.join(OUT, 'unhighlighted-owner-rulings.json')
const bracketRulings = (fs.existsSync(QUEUE)
  ? JSON.parse(fs.readFileSync(QUEUE, 'utf8')).rulings ?? [] : []).filter(r => r.section === 'brackets')
const byNormKey = new Map(codes.map(c => [c.normalizedKey, c]))
const haveOcc = new Set(occurrences.map(o => `${o.postNum}|${o.normalizedKey}`))
let ruledOccurrences = 0, ruledNewCodes = 0, ruledAlready = 0
for (const r of bracketRulings) {
  for (const token of r.sourceText.match(/\[[^\]]*\]/g) ?? []) {
    const k = `${r.postNum}|${token}`
    if (haveOcc.has(k)) { ruledAlready++; continue }
    haveOcc.add(k)
    occurrences.push({
      sourceText: token,
      codeType: 'bracketed_token',
      normalizedKey: token,
      postNum: r.postNum,
      postId: r.postId,
      context: [r.sourceText],
      interpretedMeaning: null, interpretationConfidence: null, interpretationBasis: null,
      resolved: false,
      provenance: `owner ruling ${r.ruledOn} - unhighlighted-sentence queue`,
    })
    ruledOccurrences++
    const existing = byNormKey.get(token)
    if (existing) {
      existing.recurrenceCount = (existing.recurrenceCount ?? 0) + 1
      if (!existing.posts.includes(r.postNum)) existing.posts.push(r.postNum)
      continue
    }
    const row = {
      normalizedKey: token,
      sourceTexts: [token],
      codeType: 'bracketed_token',
      recurrenceCount: 1,
      posts: [r.postNum],
      interpretedMeaning: null, interpretationConfidence: null, interpretationBasis: null,
      resolved: false,
      linkedEntityId: null,
      provenance: `owner ruling ${r.ruledOn} - unhighlighted-sentence queue`,
    }
    codes.push(row)
    byNormKey.set(token, row)
    ruledNewCodes++
  }
}

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
    // Occurrences the DETECTOR excluded and the OWNER ruled back in. Reported beside the
    // detector's tally rather than subtracted from it, so both decisions stay legible.
    ruledIntoCodesByOwner: ruledOccurrences,
  },
  typeInfo: CODE_TYPE_INFO,
  codes,
}

// ── QA gate ─────────────────────────────────────────────────────────────────
const invented = codes.filter(c => c.interpretedMeaning && !KNOWN_MEANINGS[c.normalizedKey])
const missingBasis = codes.filter(c => c.interpretedMeaning && !c.interpretationBasis)
const checks = [
  // 1,949 + 8 ruled in from the unhighlighted-sentence queue = 1,957. Seven of the 15 bracket
  // rulings named a token already certified at that post and add nothing.
  ['code occurrences = 1,957', out.totals.occurrences === 1957, out.totals.occurrences],
  ['bracket rulings applied = 15', bracketRulings.length === 15 && ruledOccurrences + ruledAlready === 15,
    `${ruledOccurrences} new + ${ruledAlready} already certified`],
  // +8: each ruled token is a wording Codes did not hold.
  ['distinct codes = 747', out.totals.distinctCodes === 747, out.totals.distinctCodes],
  // +4 posts gain their first certified code.
  ['posts = 856', out.totals.posts === 856, out.totals.posts],
  ['interpreted = 7', out.totals.interpreted === 7, out.totals.interpreted],
  // +8, and deliberately: a bracket ruled to BE notation is not a bracket whose meaning is known.
  ['unresolved = 740', out.totals.unresolved === 740, out.totals.unresolved],
  ['cross-linked to Entities = 32', linked.length === 32, linked.length],
  ['no interpretation without evidence', invented.length === 0, `${invented.length} invented`],
  ['every interpretation states its basis', missingBasis.length === 0, `${missingBasis.length} unstated`],
  // UNCHANGED ON PURPOSE. This is the detector's record of what it routed away, not a live
  // population; the eight the owner overruled are reported as ruledIntoCodesByOwner instead.
  ['bracket-emphasis tally untouched', out.totals.excludedBracketEmphasis.occurrences === 769, out.totals.excludedBracketEmphasis.occurrences],
  ['owner ruled 8 back into Codes', out.totals.ruledIntoCodesByOwner === 8, out.totals.ruledIntoCodesByOwner],
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
