// Adjudicate the recurring unresolved codes before certification.
//
// THE POINT IS NOT TO SOLVE THEM. A code can be genuine and still unresolved, and most of
// these will stay that way. The question per item is only: is this definitely a code, and does
// it belong in this section?
//
// Outcomes: CERTIFIED_CODE_UNRESOLVED | CERTIFIED_CODE_INTERPRETED | EMPHASIS | ENTITY_ALIAS |
//           DATE_OR_ORDINARY_NUMBER | STATEMENT_OR_LABEL | NOT_A_CODE | NEEDS_CONTEXT
//
// The detector is frozen; this only re-files what it found. Boundary rules stand: ordinary
// bracketed words are Emphasis, ordinary dates are not codes, ALL CAPS alone is not a code, and
// no interpretation is attached without evidence already in the corpus.
//
// AUDIT ONLY — no production write, no deploy.
//
//   node scripts/adjudicate-codes.mjs [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { KNOWN_MEANINGS } from './lib/codes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')

// Bracket contents that are an ordinary English word in caps — a label, not notation.
const LABEL_WORD = /^\[(ACCESS|SAMPLE|EXAMPLE|NOTE|IMPORTANT|WARNING|UPDATE|CORRECTION|REMINDER|PENDING|ONGOING|OPTIONAL|REDACTED|EXPAND|MIRROR|KNOWINGLY|POWER REMOVED|HUMAN PSYCHE)\]$/i
// Empty or punctuation-only brackets carry nothing at all.
const EMPTY_BRACKET = /^\[[\s.,;:_-]*\]$/
// A single lowercase letter in brackets is a typographic device, not a code.
const TYPOGRAPHIC = /^\[[a-z]\]$/

export function adjudicate(code, entityAliases) {
  const t = (code.sourceTexts?.[0] ?? '').trim()
  const inner = t.replace(/^\[|\]$/g, '').trim()

  if (KNOWN_MEANINGS[code.key] || KNOWN_MEANINGS[t]) {
    return { outcome: 'CERTIFIED_CODE_INTERPRETED', why: 'the corpus itself establishes the meaning through repeated equivalent usage' }
  }
  if (EMPTY_BRACKET.test(t)) return { outcome: 'NOT_A_CODE', why: 'empty or punctuation-only brackets carry no notation' }
  if (TYPOGRAPHIC.test(t)) return { outcome: 'NOT_A_CODE', why: 'a single lowercase letter in brackets is a typographic device' }
  if (LABEL_WORD.test(t)) return { outcome: 'STATEMENT_OR_LABEL', why: 'an ordinary word in brackets used as a label rather than as notation' }
  if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(t)) return { outcome: 'DATE_OR_ORDINARY_NUMBER', why: 'a date, not a cipher' }

  // A bracketed token naming a certified entity STAYS A CODE, cross-linked to Entities.
  //
  // The two sections answer different questions: Entities asks who is referenced, Codes asks
  // how Q marked the reference. "HRC" and "[HRC]" are not the same analytical object — dropping
  // the second would lose the notation choice entirely. This is the same cross-section overlap
  // already allowed between Questions and Directives: counted once in each, never twice within
  // either.
  if (code.codeType === 'bracketed_token' && entityAliases.has(inner.toUpperCase())) {
    return {
      outcome: 'CERTIFIED_CODE_UNRESOLVED',
      linkedEntity: inner.toUpperCase(),
      why: `bracketed notation around "${inner}", which is also certified in Entities — counted in both, cross-linked`,
    }
  }

  // Everything that survives is genuine notation whose meaning the corpus does not establish.
  // A leading sign or hash is part of the notation, not a disqualifier: [-48], [+2] and [#2]
  // are Q's offset and counter markers, and requiring an alphanumeric first character sent all
  // seven of them to NEEDS_CONTEXT.
  if (code.codeType === 'bracketed_token' && /^[+#-]?[A-Z0-9][A-Z0-9 _.:#\/&+-]*$/.test(inner)) {
    return { outcome: 'CERTIFIED_CODE_UNRESOLVED', why: 'structured bracketed notation — genuine, meaning not established' }
  }
  if (code.codeType === 'coded_phrase') {
    return { outcome: 'CERTIFIED_CODE_UNRESOLVED', why: 'a named phrase used as a codeword — genuine, meaning not established' }
  }
  if (code.codeType === 'numeric_symbolic') {
    return { outcome: 'CERTIFIED_CODE_UNRESOLVED', why: 'a symbolic numeric form — genuine, meaning not established' }
  }
  if (code.codeType === 'obfuscated_shorthand') {
    return { outcome: 'CERTIFIED_CODE_UNRESOLVED', why: 'underscore obfuscation — genuine, expansion not established' }
  }
  if (code.codeType === 'operational_marker') {
    return { outcome: 'CERTIFIED_CODE_UNRESOLVED', why: 'a status or phase marker — genuine, referent not established' }
  }
  return { outcome: 'NEEDS_CONTEXT', why: 'code-like but the type is not established from the token alone' }
}

if (process.argv.includes('--selftest')) {
  const ents = new Set(['MUELLER', 'RR', 'JC', 'LL', 'DC', 'AS'])
  const cases = [
    [{ sourceTexts: ['C_A'], key: 'C_A', codeType: 'obfuscated_shorthand' }, 'CERTIFIED_CODE_INTERPRETED'],
    [{ sourceTexts: ['[CLAS 1-99]'], key: '[CLAS 1-99]', codeType: 'bracketed_token' }, 'CERTIFIED_CODE_UNRESOLVED'],
    [{ sourceTexts: ['[D]'], key: '[D]', codeType: 'bracketed_token' }, 'CERTIFIED_CODE_UNRESOLVED'],
    [{ sourceTexts: ['[MUELLER]'], key: '[MUELLER]', codeType: 'bracketed_token' }, 'CERTIFIED_CODE_UNRESOLVED'],
    [{ sourceTexts: ['[RR]'], key: '[RR]', codeType: 'bracketed_token' }, 'CERTIFIED_CODE_UNRESOLVED'],
    [{ sourceTexts: ['RED OCTOBER'], key: 'RED OCTOBER', codeType: 'coded_phrase' }, 'CERTIFIED_CODE_UNRESOLVED'],
    [{ sourceTexts: ['[ACCESS]'], key: '[ACCESS]', codeType: 'bracketed_token' }, 'STATEMENT_OR_LABEL'],
    [{ sourceTexts: ['[  ]'], key: '[ ]', codeType: 'bracketed_token' }, 'NOT_A_CODE'],
    [{ sourceTexts: ['[s]'], key: '[S]', codeType: 'bracketed_token' }, 'NOT_A_CODE'],
    [{ sourceTexts: ['1=1'], key: '1=1', codeType: 'numeric_symbolic' }, 'CERTIFIED_CODE_UNRESOLVED'],
    [{ sourceTexts: ['[-48]'], key: '[-48]', codeType: 'bracketed_token' }, 'CERTIFIED_CODE_UNRESOLVED'],
    [{ sourceTexts: ['[#2]'], key: '[#2]', codeType: 'bracketed_token' }, 'CERTIFIED_CODE_UNRESOLVED'],
  ]
  let bad = 0
  for (const [c, want] of cases) {
    const r = adjudicate(c, ents)
    const ok = r.outcome === want
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${r.outcome.padEnd(28)}${c.sourceTexts[0]}`)
  }
  console.log(bad ? `\n${bad} case(s) wrong\n` : '\nall cases correct\n')
  process.exit(bad ? 1 : 0)
}

// ── run ──────────────────────────────────────────────────────────────────────
const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'codes-audit.json'), 'utf8'))
const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8'))
const entityAliases = new Set()
for (const e of entities.entities) {
  entityAliases.add(e.canonical.toUpperCase())
  for (const a of e.aliases) entityAliases.add(String(a.text).toUpperCase())
}

const recurring = audit.codes.filter(c => c.recurrenceCount >= 2)
const decisions = recurring.map(c => {
  const r = adjudicate(c, entityAliases)
  return {
    sourceText: c.sourceTexts[0], allSpellings: c.sourceTexts, normalizedKey: c.key,
    codeType: c.codeType, recurrenceCount: c.recurrenceCount, posts: c.posts.length,
    outcome: r.outcome, why: r.why,
    linkedEntityId: r.linkedEntity ?? null,
    interpretedMeaning: c.interpretedMeaning ?? null,
    provenance: 'Codes adjudication v1',
  }
})

const tally = {}
for (const d of decisions) tally[d.outcome] = (tally[d.outcome] ?? 0) + 1
const certified = decisions.filter(d => d.outcome.startsWith('CERTIFIED_CODE'))
const toResolve = decisions.filter(d => d.outcome === 'CERTIFIED_CODE_UNRESOLVED')

// Recompute the section totals after re-filing.
const rejected = new Set(decisions.filter(d => !d.outcome.startsWith('CERTIFIED_CODE')).map(d => d.normalizedKey))
const keptOccurrences = audit.occurrences.filter(o => !rejected.has(o.normalizedKey))
const keptCodes = audit.codes.filter(c => !rejected.has(c.key))
const byType = {}
for (const o of keptOccurrences) byType[o.codeType] = (byType[o.codeType] ?? 0) + 1

const totals = {
  reviewed: decisions.length,
  byOutcome: tally,
  finalOccurrences: keptOccurrences.length,
  finalDistinctCodes: keptCodes.length,
  finalPosts: new Set(keptOccurrences.map(o => o.postNum)).size,
  finalByType: byType,
  interpreted: keptCodes.filter(c => c.resolved).length,
  unresolved: keptCodes.filter(c => !c.resolved).length,
  toResolutionCenter: toResolve.length,
  movedToEmphasis: (tally.EMPHASIS ?? 0) + (tally.STATEMENT_OR_LABEL ?? 0),
  rejectedAsNonCode: (tally.NOT_A_CODE ?? 0) + (tally.DATE_OR_ORDINARY_NUMBER ?? 0),
  crossLinkedToEntities: decisions.filter(d => d.linkedEntityId).length,
}
fs.writeFileSync(path.join(OUT, 'codes-adjudicated.json'), JSON.stringify({ scope: 'recurring unresolved codes', productionChanged: false, totals, decisions }, null, 1))

const md = ['# Codes & Brackets — adjudicating the recurring codes\n']
md.push('**The point is not to solve them.** A code can be genuine and still unresolved, and most of these stay that way. The question per item is only whether it is definitely a code and whether it belongs here. **No production write, no deploy.**\n')
md.push('\n## Outcome\n')
md.push('| Outcome | Count |')
md.push('|---|---|')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n} |`)
md.push('\n## Final section totals after re-filing\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Code occurrences | **${totals.finalOccurrences.toLocaleString()}** |`)
md.push(`| Distinct codes | ${totals.finalDistinctCodes.toLocaleString()} |`)
md.push(`| Posts containing codes | ${totals.finalPosts.toLocaleString()} |`)
md.push(`| Interpreted | ${totals.interpreted} |`)
md.push(`| Genuine but unresolved | ${totals.unresolved.toLocaleString()} |`)
md.push(`| Routed to the Resolution Center | ${totals.toResolutionCenter} |`)
md.push(`| Moved to Emphasis / labels | ${totals.movedToEmphasis} |`)
md.push(`| Cross-linked to Entities | ${totals.crossLinkedToEntities} |`)
md.push(`| Rejected as non-code | ${totals.rejectedAsNonCode} |`)
md.push('\n### Final type distribution\n')
md.push('| Type | Occurrences |')
md.push('|---|---|')
for (const [k, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) md.push(`| ${k.replace(/_/g, ' ')} | ${n.toLocaleString()} |`)
for (const oc of Object.keys(tally)) {
  const list = decisions.filter(d => d.outcome === oc)
  md.push(`\n## ${oc} (${list.length})\n`)
  md.push('| Code | Type | × | Posts | Why |')
  md.push('|---|---|---|---|---|')
  for (const d of list.sort((a, b) => b.recurrenceCount - a.recurrenceCount).slice(0, 60)) {
    md.push(`| \`${d.sourceText}\` | ${d.codeType.replace(/_/g, ' ')} | ${d.recurrenceCount} | ${d.posts} | ${d.why} |`)
  }
  if (list.length > 60) md.push(`\n_…and ${list.length - 60} more in the JSON._`)
}
fs.writeFileSync(path.join(OUT, 'codes-adjudicated.md'), md.join('\n') + '\n')

console.log('\nCODES ADJUDICATION\n')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)
console.log('\n  FINAL SECTION TOTALS')
console.log(`    occurrences     : ${totals.finalOccurrences.toLocaleString()}`)
console.log(`    distinct codes  : ${totals.finalDistinctCodes.toLocaleString()}`)
console.log(`    posts           : ${totals.finalPosts.toLocaleString()}`)
console.log(`    interpreted     : ${totals.interpreted}`)
console.log(`    unresolved      : ${totals.unresolved.toLocaleString()}`)
console.log(`    to /resolve     : ${totals.toResolutionCenter}`)
console.log(`    to Emphasis     : ${totals.movedToEmphasis}`)
console.log(`    to Entities     : ${totals.crossLinkedToEntities}`)
console.log(`    rejected        : ${totals.rejectedAsNonCode}`)
console.log('\n→ audit/codes-adjudicated.md\n')
