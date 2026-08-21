// The readable companion to audit/occurrence-ledger-dryrun.json.
//
// A 3,000-row JSON is not something anyone reads before approving a change, and this change — a
// replacement that removes superseded spans across every category — is meant to be read before it
// is run. Reads the dry-run artifact and writes a manifest a person can actually review.
//
//   node scripts/report-occurrence-ledger.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const r = JSON.parse(fs.readFileSync(path.join(OUT, 'occurrence-ledger-dryrun.json'), 'utf8'))

const countBy = (rows, f) => rows.reduce((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m }, {})
const L = []
const p = (...xs) => L.push(...xs)
const q = s => '`' + String(s).replace(/\|/g, '\\|') + '`'

p('# Step 3A — occurrence ledger, dry run', '')
p('**Nothing in `public/data` was changed by this run.** This describes what 3B would do.', '')
p('## The model', '')
p('| layer | kinds | rule |', '|---|---|---|')
p('| primary | Claim, Prediction, Question, Directive | one adjudicated category per complete sentence |')
p('| inline | Named Entity, Bracket | may overlap a primary span, renders above it |')
p('| review | Context, Emphasis, theme anchor | a disposition, not a competing sentence colour |', '')
p('An occurrence is keyed `postNum | kind | start | end` into the runtime body — never by its text.')
p('Repeated wording stays separate because it is separate ranges: `"Fantasy land."` four times in #111 is four keys.', '')

p('## Totals', '', '```')
for (const [k, v] of Object.entries(r.totals)) {
  if (typeof v === 'object') continue
  p(`${k.padEnd(30)} ${v}`)
}
p('```', '')

const rep = r.replacements ?? []
const toReplace = rep.filter(x => !x.deliberate)
p(`## ${toReplace.length} partial primary spans replaced by their full sentence`, '')
p(`${rep.length - toReplace.length} more are partial ON PURPOSE — a directive-wrapped question counts its embedded span so the`)
p('Directive relationship survives. Those are excluded from the replacement set.', '')
p('```')
for (const [k, v] of Object.entries(r.findings.partialPrimarySpans.byKind)) p(`${k.padEnd(12)} ${v}`)
p('```', '', 'First 20:', '')
p('| sentence | post | kind | the partial span |', '|---|---|---|---|')
for (const x of toReplace.slice(0, 20)) p(`| ${q(x.sentenceId)} | #${x.postNum} | ${x.kind} | ${JSON.stringify(x.partial)} |`)
p('')

const mp = r.multiPrimary ?? []
const needs = mp.filter(m => !m.certifiedOverlap)
p(`## ${needs.length} sentences need an adjudicated winner`, '')
p(`${mp.length - needs.length} more carry the **certified directive+question overlap** and need no action — a line that is`)
p('grammatically an instruction and functionally a request for an answer is deliberately in both sections.', '')
p('| combination | count |', '|---|---|')
for (const [k, v] of Object.entries(countBy(needs, m => m.kinds.join(' + ')))) p(`| ${k} | ${v} |`)
p('', 'First 15:', '')
p('| sentence | post | categories | text |', '|---|---|---|---|')
for (const m of needs.slice(0, 15)) p(`| ${q(m.sentenceId)} | #${m.postNum} | ${m.kinds.join(' + ')} | ${JSON.stringify(m.spans[0].text)} |`)
p('')

const ov = r.sameCategoryOverlap ?? []
const primaryOv = ov.filter(o => o.layer === 'primary')
p(`## ${primaryOv.length} same-category overlaps in the primary layer`, '')
p(`${ov.filter(o => o.deliberate).length} more sit in the inline/review layers and overlap **by design** — nested entities each keep`)
p('their own hover explanation (collapsing them was built, measured and reverted), and an acrostic')
p('spreads its emphasis across a line. Those are reported but not swept up.', '')
p('| sentence | post | kind | nested | span A | span B |', '|---|---|---|---|---|---|')
for (const o of primaryOv.slice(0, 20)) p(`| ${q(o.sentenceId)} | #${o.postNum} | ${o.kind} | ${o.nested} | ${JSON.stringify(o.a)} | ${JSON.stringify(o.b)} |`)
p('')

const cc = r.contextCollision ?? []
p(`## ${cc.length} review-layer collisions become a disposition`, '')
p('A Context or Emphasis span sitting on exactly the characters of a primary span stops being a')
p('second category and becomes `reviewDisposition`, which does not paint.', '')
p('| pairing | count |', '|---|---|')
for (const [k, v] of Object.entries(countBy(cc, c => `${c.reviewKind} → ${c.primaryKind}`))) p(`| ${k} | ${v} |`)
p('', 'First 20:', '')
p('| sentence | post | review | primary | text |', '|---|---|---|---|---|')
for (const c of cc.slice(0, 20)) p(`| ${q(c.sentenceId)} | #${c.postNum} | ${c.reviewKind} | ${c.primaryKind} | ${JSON.stringify(c.text)} |`)
p('')

p('## Conflict queue — nothing here is auto-resolved', '')
p(`- **${r.totals.crossingSentenceBoundary}** spans cross a sentence boundary. Per the ruling they are not cut automatically.`)
const unByKind = countBy(r.unlocated ?? [], u => u.kind)
p(`- **${r.totals.unlocated}** spans could not be placed in the runtime body — ${unByKind.namedEntities ?? 0} named entities whose canonical and registered spellings do not appear literally in the drop.`)
p(`- **${r.totals.duplicateKeys}** duplicate occurrence keys: two records claiming the same post, kind and range.`)
p('')

fs.writeFileSync(path.join(OUT, 'occurrence-ledger-dryrun.md'), L.join('\n') + '\n')
console.log(`wrote audit/occurrence-ledger-dryrun.md (${L.length} lines)`)
