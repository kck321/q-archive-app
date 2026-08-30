// Close the recall gap: apply items already classified on ONE post to every other post
// whose text contains them.
//
// The analysis pass ran per post, so the same sentence got picked up on one drop and missed
// on another. "Nothing to see here." is a stored claim on one post and unhighlighted on the
// next. Measured: 1,589 unhighlighted lines are already classified somewhere in the archive
// — 24% of the whole highlighting gap, recoverable with no API calls at all.
//
// Rules that keep this honest:
//   - whole-LINE matches only. Substring matching is what made "US" match "rUSsia"; here it
//     would splice a claim out of the middle of an unrelated sentence.
//   - an item must already exist on a real post; nothing new is invented.
//   - items shorter than 4 characters, or that are pure punctuation/numbers, are skipped —
//     "No." as a claim would land on hundreds of posts.
//   - a line already covered by that post's own items is left alone.
//
//   node scripts/backfill-analysis.mjs [--apply]     (default is a dry run)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createResolver } from './lib/questionIdentity.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const apply = process.argv.includes('--apply')
const identity = createResolver(ROOT, { step: 'backfill-analysis.mjs' })

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))

const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const clean = t => (t ?? '').replace(MARKUP, '')
const norm = t => clean(t).toLowerCase().replace(/\s+/g, ' ').replace(/[?.!,;:'"‘’“”]+$/, '').trim()

const ANALYSIS_CATS = ['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks']

// ── what is already known, and where it came from ────────────────────────────
const known = new Map()   // normalised text -> { cat, text, sources:Set<postId>, cats:Set }
const remember = (cat, text, postId) => {
  const k = norm(text)
  if (!k) return
  const cur = known.get(k)
  if (cur) { cur.sources.add(postId); cur.cats.add(cat); return }
  known.set(k, { cat, text: clean(text).trim(), sources: new Set([postId]), cats: new Set([cat]) })
}
for (const p of posts) {
  for (const c of ANALYSIS_CATS) for (const it of p.postAnalysis?.[c] ?? []) remember(c, it, p.id)
  for (const it of p.actionRequests ?? []) remember('requests', it, p.id)
}

// Questions live in their own collection and are keyed to a post, so they are backfilled by
// inserting new question rows rather than by editing the post.
const questionText = new Map()   // normalised -> { text, sources:Set<postId> }
for (const q of questions) {
  const k = norm(q.text ?? '')
  if (!k) continue
  const cur = questionText.get(k)
  if (cur) cur.sources.add(q.postId)
  else questionText.set(k, { text: clean(q.text).trim(), sources: new Set([q.postId]) })
}

// ── eligibility ──────────────────────────────────────────────────────────────
// Short or generic lines would carpet the archive. "No." as a claim is noise, not signal.
const STOP = new Set(['q', 'q+', 'yes', 'no', 'true', 'false', 'boom', 'wwg1wga', 'more', 'next', 'soon', 'why', 'who', 'what', 'when', 'where', 'how'])
function eligible(k) {
  if (k.length < 4) return false
  if (STOP.has(k)) return false
  if (!/[a-z]{3}/.test(k)) return false          // needs real words, not "1 2 3" or "+++"
  if (k.split(' ').length < 2 && k.length < 8) return false
  return true
}

// Corroboration. A single classification can simply be wrong — the archive has "Bad actor."
// stored as a QUESTION and "Godspeed." as a REQUEST. Propagating those multiplies the error
// across hundreds of posts. So an item only travels if either the same call was made
// independently on 2+ different posts, or it is long enough to be unambiguous on its own.
const CORROBORATED = 2
const LONG_ENOUGH = 4      // words
function trustworthy(entry, k) {
  // Where the archive itself disagrees — the same line filed as a claim on one post and a
  // theme on another — there is no decision to propagate, so leave the line alone.
  if (entry.cats && entry.cats.size > 1) return false
  return entry.sources.size >= CORROBORATED || k.split(' ').length >= LONG_ENOUGH
}

// Every identity the input already holds, so a proposal can never become a second row under one.
const idsInInput = new Set(questions.map(q => String(q.id)))
let alreadyPresent = 0

const qByPost = new Map()
for (const q of questions) {
  if (!q?.postId) continue
  if (!qByPost.has(q.postId)) qByPost.set(q.postId, new Set())
  qByPost.get(q.postId).add(norm(q.text ?? ''))
}

// ── the pass ─────────────────────────────────────────────────────────────────
const added = {}
const newQuestions = []
let postsTouched = 0, linesFilled = 0
const examples = []

for (const p of posts) {
  const text = clean(p.text ?? '')
  if (!text) continue

  // Everything this post already carries, so we only fill genuine holes.
  const own = new Set()
  for (const c of ANALYSIS_CATS) for (const it of p.postAnalysis?.[c] ?? []) own.add(norm(it))
  for (const it of p.actionRequests ?? []) own.add(norm(it))
  const ownQ = qByPost.get(p.id) ?? new Set()

  let touched = false
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    const k = norm(line)
    if (!k || !eligible(k)) continue
    if (own.has(k) || ownQ.has(k)) continue

    // Does this post's own analysis already cover the line as part of a longer item?
    let coveredByLonger = false
    for (const o of own) if (o.length > k.length && o.includes(k)) { coveredByLonger = true; break }
    if (coveredByLonger) continue

    const qHit = questionText.get(k)
    if (qHit && !known.has(k) && trustworthy(qHit, k)) {
      // A ROW OFFERED HERE IS A PROPOSAL, AND AN UNREGISTERED PROPOSAL IS NOT WRITTEN AT ALL.
      //
      // WAS `bf-${p.postNum}-${newQuestions.length}` — a running counter over every drop, so a
      // backfilled row's id depended on how many other drops happened to be backfilled first. The
      // raw Firestore dump and the certified bundle disagree about that, and all three surviving
      // bf-* rows moved between the two paths (bf-2211-19 came back as bf-2211-0).
      //
      // The commit that removed the counter replaced it with a content-addressed
      // `bf-uncertified-…` id, reasoning that apply-questions.mjs rebuilds questions.json from the
      // certified artifact a step later and discards every proposal anyway. True — until the chain
      // stops in between. An export that dies on a quota error, a failing gate, a Ctrl-C, all leave
      // public/data/questions.json on disk holding identities that no registry ever issued.
      //
      // So resolveProposal() returns an id only when the registry ALREADY knows this wording, and
      // null otherwise. null means the row is not written and gets no id of any kind; the proposal
      // is recorded in audit/question-identity-proposals.jsonl for review. The counters below still
      // move, because what this script tells the reader about a drop's coverage has not changed.
      const id = identity.resolveProposal({ postId: p.id, postNum: p.postNum, text: qHit.text,
        site: 'analysis-backfill' })
      // AND NEVER A SECOND ROW UNDER AN IDENTITY THE INPUT ALREADY HOLDS.
      //
      // `ownQ` compares the DROP LINE against the stored wording, so a certified span that is only
      // part of its line does not look like coverage and the hole detector offers it again. While
      // proposals carried their own `bf-…` ids that produced a harmless duplicate row which
      // apply-questions.mjs discarded. Now that a known proposal resolves to the REAL canonical id,
      // appending it puts two rows under one id in questions.json — and the later one wins the
      // metadata lookup, which silently reset six rows on three drops (#3721, #3858, #3905) to
      // status "unanswered" with a default createdAt.
      //
      // A question the archive already holds is not a hole. Backfill fills holes.
      if (id !== null && !idsInInput.has(id)) {
        newQuestions.push({ id, postId: p.id, postNum: p.postNum, text: qHit.text, status: 'unanswered', backfilled: true })
        idsInInput.add(id)
      } else if (id !== null) {
        alreadyPresent++
      }
      ownQ.add(k)
      added.questions = (added.questions ?? 0) + 1
      linesFilled++; touched = true
      if (examples.length < 12) examples.push([p.postNum, 'questions', line])
      continue
    }

    const hit = known.get(k)
    if (!hit || !trustworthy(hit, k)) continue
    if (hit.cat === 'requests') {
      p.actionRequests = [...(p.actionRequests ?? []), hit.text]
      p.hasRequests = true
    } else {
      p.postAnalysis ??= {}
      p.postAnalysis[hit.cat] = [...(p.postAnalysis[hit.cat] ?? []), hit.text]
    }
    own.add(k)
    added[hit.cat] = (added[hit.cat] ?? 0) + 1
    linesFilled++; touched = true
    if (examples.length < 12) examples.push([p.postNum, hit.cat, line])
  }
  if (touched) postsTouched++
}

console.log(`distinct classified items available : ${known.size.toLocaleString()}`)
console.log(`posts gaining items                 : ${postsTouched.toLocaleString()}`)
console.log(`lines newly categorised             : ${linesFilled.toLocaleString()}\n`)
for (const [c, n] of Object.entries(added).sort((a, b) => b[1] - a[1])) console.log(`   ${c.padEnd(20)} ${String(n).padStart(5)}`)
console.log('\nexamples:')
for (const [n, c, l] of examples) console.log(`   #${String(n).padEnd(5)} ${c.padEnd(18)} ${l.slice(0, 66)}`)

// Checked even on a dry run: a backfilled row that CONTRADICTS a known identity is a finding, and
// a dry run is exactly where it should surface.
identity.assertResolved()
const proposalFile = identity.writeProposals()
if (alreadyPresent) console.log(`
   ${alreadyPresent} proposal(s) name a question the archive already holds (not re-added)`)
if (identity.proposals.length) {
  console.log(`\n   ${identity.proposals.length} proposed question(s) were NOT written to questions.json`)
  console.log(`   (no identity assigned; recorded for review in ${path.relative(ROOT, proposalFile)})`)
}

if (!apply) { console.log('\n(dry run — pass --apply to write)'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'posts.json'), JSON.stringify(posts))
fs.writeFileSync(path.join(DATA, 'questions.json'), JSON.stringify([...questions, ...newQuestions]))
console.log(`\nwrote posts.json and questions.json (+${newQuestions.length} question rows)`)
