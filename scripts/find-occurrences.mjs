// Editorial support desk — find every occurrence of a phrase across all 4,966 drops.
//
// THE PROBLEM THIS SOLVES: the owner spots one sentence that is classified wrongly, rules on it,
// and then has to find the same wording everywhere else by hand. That does not scale past a
// handful of corrections, and it leaves the archive inconsistent — the same sentence classified
// one way in #2917 and another way in #3184.
//
// THE RULE IT MUST NOT BREAK: same wording RETRIEVES candidates; context DECIDES membership.
// This tool never classifies anything. It finds and reports, so the owner rules once on a
// complete set instead of repeatedly on fragments.
//
// It separates Q-authored occurrences from quoted material, because a phrase inside a quoted
// anon post is not Q saying it — the distinction the whole archive rests on.
//
//   node scripts/find-occurrences.mjs "Pure evil."
//   node scripts/find-occurrences.mjs "Ascension."
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const phrase = process.argv[2]
if (!phrase) { console.error('\nUsage: node scripts/find-occurrences.mjs "the exact phrase"\n'); process.exit(1) }

const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const posts = read('posts.json')
const themes = read('themes.json')
const questions = read('questions.json')
const emphasis = read('emphasis.json')

/** Loose key for retrieval only — punctuation and case are variants worth surfacing, not deciding. */
const key = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const target = key(phrase)

const qByPost = new Map()
for (const q of questions) {
  if (q.occurrences === undefined) continue
  if (!qByPost.has(q.postNum)) qByPost.set(q.postNum, [])
  qByPost.get(q.postNum).push(q.text)
}

const rows = []
for (const p of posts) {
  const body = runtimeText(p.text ?? '')
  const quoted = (p.quotedPosts ?? []).map(q => runtimeText(q.text ?? '')).join('\n')

  const inQ = body.split('\n').map(l => l.trim()).filter(l => key(l) === target || key(l).includes(target))
  const inQuoted = quoted.split('\n').map(l => l.trim()).filter(l => key(l) === target || key(l).includes(target))
  if (!inQ.length && !inQuoted.length) continue

  const a = p.postAnalysis ?? {}
  const has = (arr, t) => (arr ?? []).some(x => key(x) === key(t))
  for (const line of inQ) {
    const cls = []
    if (has(a.claims, line)) cls.push('Claim')
    if (has(a.predictions, line)) cls.push('Prediction')
    if (has(p.actionRequests, line)) cls.push('Directive')
    if ((qByPost.get(p.postNum) ?? []).some(x => key(x) === key(line))) cls.push('Question')
    if (has(a.impliedConclusions, line)) cls.push('Conclusion')
    if (has(a.verificationHooks, line)) cls.push('Checkable')
    if (has(a.emphasis, line)) cls.push('Emphasis')
    if (has(a.contextUnits, line)) cls.push('Context')
    const th = (themes.byPost?.[String(p.postNum)] ?? []).map(t => t.label)
    rows.push({
      postNum: p.postNum, where: 'Q-authored', text: line,
      exact: key(line) === target,
      classifications: cls.length ? cls.join(' + ') : '— none —',
      themes: th.join(', ') || '—',
    })
  }
  for (const line of inQuoted) {
    rows.push({
      postNum: p.postNum, where: 'QUOTED', text: line, exact: key(line) === target,
      classifications: 'n/a — quoted source, not Q\'s words', themes: '—',
    })
  }
}

rows.sort((a, b) => (b.exact - a.exact) || a.postNum - b.postNum)
const qRows = rows.filter(r => r.where === 'Q-authored')
const exact = qRows.filter(r => r.exact)
const variants = qRows.filter(r => !r.exact)
const quotedRows = rows.filter(r => r.where === 'QUOTED')

console.log(`\nOCCURRENCES OF ${JSON.stringify(phrase)}\n`)
console.log(`  Q-authored : ${qRows.length}   (${exact.length} exact, ${variants.length} variant)`)
console.log(`  quoted     : ${quotedRows.length}  — not Q's words; classify only if you rule otherwise\n`)

const table = (title, list) => {
  if (!list.length) return
  console.log(`  ${title}`)
  console.log(`  ${'post'.padEnd(7)} ${'text'.padEnd(46)} current classification`)
  for (const r of list) {
    console.log(`  #${String(r.postNum).padEnd(6)} ${JSON.stringify(r.text).slice(0, 46).padEnd(46)} ${r.classifications}`)
  }
  console.log('')
}
table('EXACT MATCHES — Q-authored', exact)
table('VARIANTS (case/punctuation/containing) — review individually', variants)
table('IN QUOTED MATERIAL — leave alone unless ruled otherwise', quotedRows)

// What a ruling would change, so the owner sees the scope before approving.
const byCls = {}
for (const r of qRows) byCls[r.classifications] = (byCls[r.classifications] ?? 0) + 1
console.log('  current spread across Q-authored occurrences:')
for (const [c, n] of Object.entries(byCls).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${c}`)
console.log('\n  Same wording retrieves candidates. Context decides membership — rule per occurrence.\n')
