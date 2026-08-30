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
import { loadAbbrevRepairs } from './lib/abbrevRepairs.mjs'
import { createResolver } from './lib/questionIdentity.mjs'

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

// METADATA COMES FROM THE ROW THAT *IS* THIS IDENTITY, NEVER FROM WHATEVER MATCHED THE TEXT.
//
// priorByKey is a TEXT index, and on an export `existing` is the raw Firestore dump: 10,158
// documents for 6,643 certified questions. Thousands of drops therefore hold several documents
// with the same wording, `if (!priorByKey.has(k))` keeps whichever one the dump happened to list
// first, and that document then supplies status, createdAt and infographId. Which duplicate wins
// is an accident of iteration order — exactly the kind of "arbitrary document becomes the
// authority" the registry exists to end.
//
// It is not hypothetical. #1915 and #1944 match documents 5n1ZTUuUTW8PKpvHTk1Z and
// nZW8pYgbnneY3vmbsfOJ, and reading metadata off them rewrote qc-b's and qc-c's published
// createdAt from 1786492800000 to the documents' own creation instants — the only two rows that
// stopped a rebuild and an export from being byte-identical.
//
// So identity is resolved FIRST, and metadata is then read from the prior row carrying that
// canonical id. An alias supplies identity and nothing else. A row with no prior under its own id
// takes the documented defaults, which is what a rebuild already gave it.
const priorById = new Map(existing.map(q => [String(q.id), q]))

// A ROW'S ID MUST SURVIVE AN ABBREVIATION REPAIR, AND SOMETHING ELSE IS KEYED TO IT.
//
// This file words a row from audit/questions-final.json; apply-questions-final.mjs then REWRITES
// that wording where audit/abbreviation-span-repairs.json says the splitter cut it short. So on
// the next run the lookup above compares the certified artifact's short wording against a stored
// row holding the repaired one and misses.
//
// That would be harmless if an id were only an id. It is not: apply-step3b1.mjs records its
// demotions and withdrawals as `questionEdits` keyed on this id, and applies them by id at the
// end of the chain. Re-id the rows and those demotions land on whatever row inherited the number.
// Adding seven repairs on 2026-08-24 did exactly that — #1944's repaired question came back
// carrying `A-DQ-p0121-s019` and `secondaryOf: 121|directives|673|678`, demoted by an action
// belonging to a different drop, while post 121's own demotion went missing. Four drops, silently,
// and every total still looked plausible: 6,327 indexed questions became 6,323.
//
// The id no longer depends on this lookup at all — identity/question-identity-registry.json
// decides it, and the registry holds BOTH wordings as accepted signatures of the same entry, so a
// repair cannot rename anything. The walk below survives because status, createdAt and
// infographId are still carried forward from the stored row, and those genuinely are looked up by
// wording. The record that caused the rename is still the record that undoes it.
const abbrev = loadAbbrevRepairs(ROOT)
if (abbrev) {
  for (const q of existing) {
    const k = `${q.postId}|${key(q.text)}`
    // Walk the repair backwards: this stored row may BE the repaired form of a shorter certified
    // span, in which case the short form has to find it too.
    for (const r of abbrev.doc.repairs ?? []) {
      if (r.category !== 'questions') continue
      if (String(r.postNum) !== String(q.postNum)) continue
      if (key(r.full) !== key(q.text)) continue
      const short = `${q.postId}|${key(r.truncated)}`
      if (!priorByKey.has(short)) priorByKey.set(short, q)
    }
    void k
  }
}

// THE POSITIONAL COUNTER IS GONE.
//
// This was `let nextId = 0; const mkId = () => \`qc-${(++nextId).toString(36)}\``, reached
// whenever the lookup above missed. A counter makes a row's id a function of how many rows were
// written before it, so the id moved whenever the prior baseline changed — and the prior baseline
// IS different between a rebuild (this chain's own previous output) and an export (the raw
// Firestore dump). Measured on the seed-116 tree, an export moved 20 qc-* rows: #1915 and #1944
// legitimately match Firestore documents and adopt their ids, consuming two fewer counter values,
// so qc-h slid onto #2989 and #2782's CalMatters row — pinned by name in
// materialize-literal-spans.mjs — lost it.
//
// There is no fallback here on purpose. A candidate the registry does not recognise stops the
// build; it never receives a manufactured id. See scripts/lib/questionIdentity.mjs.
const identity = createResolver(ROOT, { step: 'apply-questions.mjs' })

const rows = []
const stats = { kept: 0, added: 0, editorial: 0, droppedDirective: 0, droppedHeading: 0, droppedFragment: 0, droppedRemoved: 0, withdrawnFragment: 0 }

for (const f of final.finals) {
  const post = postById.get(String(f.postNum)) ?? postByNum.get(f.postNum)
  if (!post) continue

  if (f.countsTowardQQuestionTotal) {
    // A FRAGMENT THE REPAIR RECORD HAS ALREADY ABSORBED IS NEVER GIVEN AN IDENTITY.
    //
    // The sentence splitter certified both halves of fifteen questions, and
    // audit/abbreviation-span-repairs.json records the tail of each as withdrawn — absorbed into
    // the repaired span, counted once. apply-questions-final.mjs has always deleted them a few
    // steps later; until now this file materialised them first, and they consumed the first
    // fifteen values of the qc-* counter on every run. That is how "Merkel?" came to hold qc-1
    // while the published qc-1 belongs to #1021, and why the surviving qc-* ids could never be
    // re-derived from the artifacts — they were carried forward from an older bundle, not built.
    //
    // A row that is certain to be withdrawn is not a certified question, so it gets no canonical
    // identity. The withdrawal record is the same one apply-questions-final.mjs reads, and that
    // file's "what has to be true is ABSENCE" gate still passes: the fragment is simply never
    // there to remove.
    if (abbrev?.isWithdrawn('questions', post.postNum, f.qSourceText)) { stats.withdrawnFragment++; continue }

    const k = `${post.id}|${key(f.qSourceText)}`
    const prior = priorByKey.get(k)
    if (prior) stats.kept++; else stats.added++
    const id = identity.resolve({ postId: post.id, postNum: post.postNum, text: f.qSourceText,
      incomingId: prior?.id ?? null, site: 'certified-q-authored' })
    const meta = id === null ? null : priorById.get(id) ?? null
    rows.push({
      id,
      text: f.qSourceText,                       // EXACT Q wording
      status: meta?.status ?? 'unprocessed',
      postId: post.id,
      postNum: post.postNum,
      createdAt: meta?.createdAt ?? Date.parse('2026-08-12T00:00:00Z'),
      infographId: meta?.infographId ?? null,
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
    const id = identity.resolve({ postId: post.id, postNum: post.postNum, text,
      incomingId: prior?.id ?? null, site: 'editorial-normalisation' })
    const meta = id === null ? null : priorById.get(id) ?? null
    rows.push({
      id,
      text,
      status: meta?.status ?? 'unprocessed',
      postId: post.id,
      postNum: post.postNum,
      createdAt: meta?.createdAt ?? Date.parse('2026-08-12T00:00:00Z'),
      infographId: meta?.infographId ?? null,
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

// EVERY ROW MUST HAVE RESOLVED THROUGH THE REGISTRY. Checked before the span QA below, because
// an unresolved identity is a worse failure than an unresolved span and should be the one reported.
identity.assertResolved()

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
console.log(`    absorbed tail fragments : ${stats.withdrawnFragment.toLocaleString()}  (audit/abbreviation-span-repairs.json)`)
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
