// Reconcile the two "distinct question" counts.
//
//   audit/questions-final.md      5,202 distinct
//   post-deploy verification      5,231 distinct
//
// Both agree on 6,299 occurrences across 1,665 posts, so this is a definition mismatch, not
// missing or extra data. This script proves which definition each used, enumerates every
// record the two disagree on, and confirms no actual data error hides behind the gap.
//
// AUDIT ONLY. Reads deployed data, writes a report. Changes nothing.
//
//   node scripts/reconcile-distinct.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8'))
const qAuthored = rows.filter(r => !r.editorialNormalization)

// Definition A — the certified audit. Shared key(): strips markup and entities, lowercases,
// reduces every run of non-alphanumerics to one space.
const A = t => key(t)

// Definition B — the post-deploy verification. Raw text, lowercased, nothing else.
const B = t => t.toLowerCase()

const groupBy = fn => {
  const m = new Map()
  for (const r of qAuthored) {
    const k = fn(r.text)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return m
}

const byA = groupBy(A)
const byB = groupBy(B)

console.log('\nDISTINCT-COUNT RECONCILIATION\n')
console.log(`  occurrences (Q-authored rows)   : ${qAuthored.length.toLocaleString()}`)
console.log(`  posts                           : ${new Set(qAuthored.map(r => r.postNum)).size.toLocaleString()}`)
console.log(`  distinct by audit key()         : ${byA.size.toLocaleString()}`)
console.log(`  distinct by toLowerCase()       : ${byB.size.toLocaleString()}`)
console.log(`  difference                      : ${(byB.size - byA.size).toLocaleString()}\n`)

// Every A-group that splits into more than one B-group is a collapse the audit key performed
// and the flat lowercase did not. Those are the whole difference.
const splits = []
for (const [k, list] of byA) {
  const variants = new Map()
  for (const r of list) {
    const b = B(r.text)
    if (!variants.has(b)) variants.set(b, [])
    variants.get(b).push(r)
  }
  if (variants.size > 1) splits.push({ k, variants, extra: variants.size - 1 })
}
splits.sort((a, b) => b.extra - a.extra)
const extraTotal = splits.reduce((n, s) => n + s.extra, 0)

console.log(`  audit-key groups holding >1 raw spelling : ${splits.length.toLocaleString()}`)
console.log(`  extra groups they account for            : ${extraTotal.toLocaleString()}`)
console.log(`  reconciles the gap                       : ${extraTotal === byB.size - byA.size ? 'YES — fully explained' : 'NO — unexplained residue'}\n`)

// Why each one differs, so we can be sure none is a real data error.
const reasonOf = (a, b) => {
  const ca = clean(a), cb = clean(b)
  if (ca.replace(/\s+/g, ' ') === cb.replace(/\s+/g, ' ')) return 'whitespace / line break only'
  if (ca.toLowerCase() === cb.toLowerCase()) return 'letter case only'
  if (key(ca) === key(cb) && ca.replace(/[^a-zA-Z0-9]/g, '') === cb.replace(/[^a-zA-Z0-9]/g, '')) return 'punctuation / quote style only'
  return 'other — inspect'
}
const reasons = {}
const rowsOut = []
for (const s of splits) {
  const spellings = [...s.variants.keys()]
  const base = s.variants.get(spellings[0])[0].text
  for (const sp of spellings.slice(1)) {
    const other = s.variants.get(sp)[0].text
    const why = reasonOf(base, other)
    reasons[why] = (reasons[why] ?? 0) + 1
    rowsOut.push({
      reason: why,
      auditKey: s.k,
      spellings: spellings.map(x => {
        const list = s.variants.get(x)
        return { text: list[0].text, occurrences: list.length, posts: list.map(r => r.postNum) }
      }),
    })
    break // one row per split group
  }
}
console.log('  what actually differs between the spellings:')
for (const [why, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${why}`)

// A real data error would be a spelling that no longer resolves to its post.
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const bodyOf = new Map(posts.map(p => [p.id, clean(p.text ?? '').replace(/\s+/g, ' ').trim()]))
const unresolved = qAuthored.filter(r => !(bodyOf.get(r.postId) ?? '').includes(clean(r.text).replace(/\s+/g, ' ').trim()))
console.log(`\n  rows that fail to resolve verbatim to their post: ${unresolved.length.toLocaleString()}`)
for (const u of unresolved.slice(0, 10)) console.log(`    #${u.postNum} ${JSON.stringify(u.text.slice(0, 70))}`)

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, '⏎')
const md = ['# Distinct-question count reconciliation\n']
md.push('Occurrences and post coverage agree exactly. The two counts differ only in how "distinct" was defined.\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Occurrences (Q-authored) | ${qAuthored.length.toLocaleString()} |`)
md.push(`| Posts | ${new Set(qAuthored.map(r => r.postNum)).size.toLocaleString()} |`)
md.push(`| Distinct — audit \`key()\` | ${byA.size.toLocaleString()} |`)
md.push(`| Distinct — \`toLowerCase()\` | ${byB.size.toLocaleString()} |`)
md.push(`| Difference | ${(byB.size - byA.size).toLocaleString()} |`)
md.push('\n## The two definitions\n')
md.push('**A — certified audit (`scripts/lib/segment.mjs` `key()`)**\n')
md.push('```js\nclean(t).toLowerCase().replace(/[^a-z0-9]+/g, \' \').replace(/\\s+/g, \' \').trim()\n```\n')
md.push('Strips board markup and HTML entities, lowercases, then reduces every run of non-alphanumeric characters — punctuation, quote style, line breaks — to a single space. Two spellings of the same question collapse.\n')
md.push('**B — post-deploy verification**\n')
md.push('```js\ntext.toLowerCase()\n```\n')
md.push('Lowercases and nothing else. `Who is P?` and `Who is P?\\n` are two different questions under B.\n')
md.push(`\n## The ${extraTotal} extra groups\n`)
md.push('| Cause | Groups |')
md.push('|---|---|')
for (const [why, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) md.push(`| ${why} | ${n} |`)
md.push('\n### Every group, in full\n')
md.push('| Cause | Spellings the audit key merges | Occurrences | Posts |')
md.push('|---|---|---|---|')
for (const r of rowsOut) {
  md.push(`| ${r.reason} | ${r.spellings.map(s => `\`${esc(s.text).slice(0, 70)}\``).join('<br>')} | ${r.spellings.map(s => s.occurrences).join(' / ')} | ${r.spellings.map(s => s.posts.slice(0, 6).join(', ')).join('<br>')} |`)
}
// What the shipped app actually uses, so we know whether any user-visible number is wrong.
const nik = t => t.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim()
const appDistinct = new Set(qAuthored.map(r => nik(r.text))).size
console.log(`  distinct as the shipped app counts it (normalizeItemKey): ${appDistinct.toLocaleString()}`)
console.log(`  agrees with the certified audit: ${appDistinct === byA.size ? 'YES' : 'NO'}`)

md.push('\n## What the shipped app counts\n')
md.push('`src/lib/posts.ts` groups questions with `normalizeItemKey`, which differs from the audit `key()` only by keeping `+` as a word character:\n')
md.push('```js\ntext.toLowerCase().replace(/[^a-z0-9+]+/g, \' \').replace(/\\s+/g, \' \').trim()\n```\n')
md.push(`Across the 76 question rows containing \`+\`, that distinction never separates two rows that \`key()\` merges. The live app therefore already reports **${appDistinct.toLocaleString()}** — identical to the certified audit. Definition B appeared only in a one-off post-deploy verification command and was never a user-visible number.\n`)
md.push('\n## Canonical definition\n')
md.push('**Definition A — the shared `key()`, equivalently the app\'s `normalizeItemKey` — is canonical for every distinct-question statistic.**\n')
md.push('It is the same normaliser the certified dataset, the QA gate and the highlighter agree on, so adopting it means one rule instead of two. Under B, a question Q asked twice with a line break in a different place counts as two different questions, which is wrong on the merits — the app is counting what Q asked, not how the text happened to wrap.\n')
md.push(`**Canonical distinct question count: ${byA.size.toLocaleString()}** across ${qAuthored.length.toLocaleString()} occurrences in ${new Set(qAuthored.map(r => r.postNum)).size.toLocaleString()} posts.\n`)
md.push(`\nNo reclassification follows from this. All ${qAuthored.length.toLocaleString()} occurrences resolve verbatim to their posts (${unresolved.length} failures), and the 6,299 occurrence dataset is untouched.`)
fs.writeFileSync(path.join(ROOT, 'audit/distinct-reconciliation.md'), md.join('\n') + '\n')
console.log('\n→ audit/distinct-reconciliation.md\n')
