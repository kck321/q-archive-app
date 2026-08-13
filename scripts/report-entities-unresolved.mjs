// The entities we are NOT positive on, written out for outside review.
//
// Three genuinely different kinds of uncertainty, listed separately because they need
// different decisions:
//
//   1. NAMED BUT UNTYPED   we are sure it is a specific named thing; unsure what KIND.
//   2. UNRESOLVED ALIAS    shorthand or a shared surname; we refuse to say WHO.
//   3. LOW-CONFIDENCE TYPE it got a type, but from one weak signal.
//
//   node scripts/report-entities-unresolved.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const other = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-other-adjudicated.json'), 'utf8'))
const tail = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-tail-adjudicated.json'), 'utf8'))

const untyped = other.decisions.filter(d => !d.retyped).sort((a, b) => b.storedOccurrences - a.storedOccurrences)
const unresolved = tail.decisions.filter(d => d.outcome === 'UNRESOLVED').sort((a, b) => b.storedOccurrences - a.storedOccurrences)
const lowConf = other.decisions.filter(d => d.retyped && d.confidence === 'LOW').sort((a, b) => b.storedOccurrences - a.storedOccurrences)

const md = ['# Entities we are NOT positive on\n']
md.push('For outside review. Three different kinds of uncertainty, listed separately because each needs a different decision.\n')
md.push('\nSuggested destinations per record: **an entity type**, **Themes**, or **leave unresolved**.\n')
md.push('\n| Bucket | Count | What it means |')
md.push('|---|---|---|')
md.push(`| 1. Named but untyped | ${untyped.length} | We are confident it names a specific thing; not confident what kind |`)
md.push(`| 2. Unresolved alias | ${unresolved.length} | Shorthand or a shared surname; we refuse to say who |`)
md.push(`| 3. Low-confidence type | ${lowConf.length} | Typed from a single weak signal; worth a second opinion |`)

md.push(`\n## 1. Named, but the TYPE is not established — all ${untyped.length}\n`)
md.push('`other_named_entity` is a valid terminal category: a specific named referent was detected, but the available context does not support a more precise type with enough confidence.\n')
md.push('| # | Source text | Times stored | Suggested destination |')
md.push('|---|---|---|---|')
untyped.forEach((d, i) => md.push(`| ${i + 1} | \`${d.sourceText}\` | ${d.storedOccurrences} | |`))

md.push(`\n## 2. Ambiguous — we refuse to resolve WHO or WHAT — all ${unresolved.length}\n`)
md.push('A wrong canonicalisation here is worse than an unresolved one, so these stay as literal tokens with `contextDependent: true`.\n')
md.push('| # | Source text | Times stored | Why unresolved | Suggested destination |')
md.push('|---|---|---|---|---|')
unresolved.forEach((d, i) => md.push(`| ${i + 1} | \`${d.sourceText}\` | ${d.storedOccurrences} | ${(d.why ?? '').replace(/\|/g, '\\|').slice(0, 120)} | |`))

md.push(`\n## 3. Typed on LOW confidence — all ${lowConf.length}\n`)
md.push('These carry a type but rest on one weak signal, usually the structural name-shape fallback.\n')
md.push('| # | Source text | Times | Assigned type | Basis | Agree? |')
md.push('|---|---|---|---|---|---|')
lowConf.forEach((d, i) => md.push(`| ${i + 1} | \`${d.sourceText}\` | ${d.storedOccurrences} | ${d.finalType} | ${d.why.replace(/\|/g, '\\|').slice(0, 70)} | |`))

fs.writeFileSync(path.join(OUT, 'entities-other-unresolved.md'), md.join('\n') + '\n')
fs.writeFileSync(path.join(OUT, 'entities-other-unresolved.json'), JSON.stringify({
  generated: 'scripts/report-entities-unresolved.mjs',
  buckets: {
    namedButUntyped: { count: untyped.length, records: untyped.map(d => ({ sourceText: d.sourceText, occurrences: d.storedOccurrences })) },
    unresolvedAlias: { count: unresolved.length, records: unresolved.map(d => ({ sourceText: d.sourceText, occurrences: d.storedOccurrences, why: d.why })) },
    lowConfidenceType: { count: lowConf.length, records: lowConf.map(d => ({ sourceText: d.sourceText, occurrences: d.storedOccurrences, assignedType: d.finalType, basis: d.why })) },
  },
}, null, 1))

console.log(`\n  1. named but untyped   : ${untyped.length}`)
console.log(`  2. unresolved alias    : ${unresolved.length}`)
console.log(`  3. low-confidence type : ${lowConf.length}`)
console.log('\n→ audit/entities-other-unresolved.md  (+ .json)\n')
console.log('BUCKET 1 — named but untyped, in full:\n')
console.log(untyped.map(d => `${d.sourceText} (${d.storedOccurrences})`).join(' · '))
