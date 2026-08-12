// Apply the certified question dataset to production.
//
// Source of truth: audit/questions-final.json (auditor v2.1, frozen; reviewed and approved).
// This rewrites public/data/questions.json to contain exactly the Q-authored questions and
// nothing else.
//
// What goes in:
//   - every unit with countsTowardQQuestionTotal === true  (6,299)
//
// What comes out of Q Questions:
//   - Q_DIRECTIVE            instruction, not a question
//   - Q_STATEMENT_OR_HEADING "List of Republicans…:" is a noun, not a request
//   - SEGMENTATION_ERROR     a fragment produced by splitting
//   - REMOVE                 no Q line accounts for it
//
// What is KEPT but demoted:
//   - EDITORIAL_NORMALIZATION — a paraphrase an earlier extractor wrote. Retained so search
//     still finds "Who is Seth Rich?", but flagged editorialNormalization + neverDisplayAsQ
//     so it is never shown or counted as Q's words. It carries the exact Q wording it came
//     from in qAuthoredSource.
//
// Existing id, status and createdAt are preserved wherever the text still qualifies, so no
// classification work is lost.
//
// Idempotent: rebuilds from the certified artifact each time, so it is safe to re-run after
// an export overwrites questions.json.
//
//   node scripts/apply-questions.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = process.argv.includes('--dry')

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const existing = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const final = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/questions-final.json'), 'utf8'))

const postById = new Map(posts.map(p => [p.id, p]))
const postByNum = new Map(posts.map(p => [p.postNum, p]))

// Existing rows by post + normalised text, so ids and statuses survive.
const priorByKey = new Map()
for (const q of existing) {
  const k = `${q.postId}|${key(q.text)}`
  if (!priorByKey.has(k)) priorByKey.set(k, q)
}

let nextId = 0
const mkId = () => `qc-${(++nextId).toString(36)}`

const rows = []
const stats = { kept: 0, added: 0, editorial: 0, droppedDirective: 0, droppedHeading: 0, droppedFragment: 0, droppedRemoved: 0 }

for (const f of final.finals) {
  const post = postById.get(String(f.postNum)) ?? postByNum.get(f.postNum)
  if (!post) continue

  if (f.countsTowardQQuestionTotal) {
    const k = `${post.id}|${key(f.qSourceText)}`
    const prior = priorByKey.get(k)
    if (prior) stats.kept++; else stats.added++
    rows.push({
      id: prior?.id ?? mkId(),
      text: f.qSourceText,                       // EXACT Q wording
      status: prior?.status ?? 'unprocessed',
      postId: post.id,
      postNum: post.postNum,
      createdAt: prior?.createdAt ?? Date.parse('2026-08-12T00:00:00Z'),
      infographId: prior?.infographId ?? null,
      semanticFunction: f.semanticFunction,      // question | information_request
      grammaticalForm: f.grammaticalForm,
      certified: true,
    })
    continue
  }

  if (f.finalClass === 'EDITORIAL_NORMALIZATION') {
    const text = f.storedText ?? f.qSourceText
    const k = `${post.id}|${key(text)}`
    const prior = priorByKey.get(k)
    stats.editorial++
    rows.push({
      id: prior?.id ?? mkId(),
      text,
      status: prior?.status ?? 'unprocessed',
      postId: post.id,
      postNum: post.postNum,
      createdAt: prior?.createdAt ?? Date.parse('2026-08-12T00:00:00Z'),
      infographId: prior?.infographId ?? null,
      // Searchable, never Q's words.
      editorialNormalization: true,
      neverDisplayAsQ: true,
      qAuthoredSource: f.qSourceText ?? null,
      certified: true,
    })
    continue
  }

  if (f.finalClass === 'Q_DIRECTIVE') stats.droppedDirective++
  else if (f.finalClass === 'Q_STATEMENT_OR_HEADING') stats.droppedHeading++
  else if (f.finalClass === 'SEGMENTATION_ERROR') stats.droppedFragment++
  else if (f.finalClass === 'REMOVE') stats.droppedRemoved++
}

// ── QA: every Q-authored row must resolve to an exact span in its post ───────
const qa = { checked: 0, exact: 0, missing: [] }
for (const r of rows) {
  if (r.editorialNormalization) continue
  qa.checked++
  // Whitespace-normalised on both sides: a cross-line reconstruction joins two lines with a
  // space, so it can never appear literally in a post that has a newline there. The wording
  // must be identical; the line break must not decide whether it counts.
  const flat = t => clean(t).replace(/\s+/g, ' ').trim()
  const body = flat(postById.get(r.postId)?.text ?? '')
  if (body.includes(flat(r.text))) qa.exact++
  else qa.missing.push({ postNum: r.postNum, text: r.text })
}

const counted = rows.filter(r => !r.editorialNormalization)
console.log('\nAPPLY CERTIFIED QUESTIONS\n')
console.log(`  Q-authored rows written   : ${counted.length.toLocaleString()}`)
console.log(`    reusing an existing row  : ${stats.kept.toLocaleString()}`)
console.log(`    newly added              : ${stats.added.toLocaleString()}`)
console.log(`  editorial normalisations  : ${stats.editorial.toLocaleString()}  (searchable, never shown as Q)`)
console.log(`  total rows                : ${rows.length.toLocaleString()}   (was ${existing.length.toLocaleString()})`)
console.log('\n  removed from Q Questions:')
console.log(`    directives              : ${stats.droppedDirective.toLocaleString()}`)
console.log(`    statements / headings   : ${stats.droppedHeading.toLocaleString()}`)
console.log(`    segmentation fragments  : ${stats.droppedFragment.toLocaleString()}`)
console.log(`    removed outright        : ${stats.droppedRemoved.toLocaleString()}`)
console.log('\n  QA — every question resolves to an exact span in its post:')
console.log(`    checked                 : ${qa.checked.toLocaleString()}`)
console.log(`    exact match             : ${qa.exact.toLocaleString()}`)
console.log(`    NOT FOUND               : ${qa.missing.length.toLocaleString()}`)
for (const m of qa.missing.slice(0, 10)) console.log(`      #${m.postNum} ${JSON.stringify(m.text.slice(0, 70))}`)

if (qa.missing.length) {
  console.error('\nAborting: a certified question does not appear verbatim in its post.')
  process.exit(1)
}
if (dry) { console.log('\n--dry: questions.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'questions.json'), JSON.stringify(rows))
console.log(`\nwrote public/data/questions.json (${(fs.statSync(path.join(DATA, 'questions.json')).size / 1048576).toFixed(1)} MB)\n`)
