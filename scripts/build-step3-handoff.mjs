// Build a SELF-CONTAINED review document for the open Step 3 decisions.
//
// The reader has no access to this repository, so every row carries its own evidence: the drop
// number, the sentence, the categories in conflict, and the lines around it in the drop. A
// reviewer who has to ask "what does #1155 actually say?" cannot answer the question being put.
//
//   node scripts/build-step3-handoff.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'occurrence-ledger-dryrun.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const abbrev = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'abbreviation-span-repairs.json'), 'utf8'))

const L = []
const p = (...xs) => L.push(...xs)

/** The drop, with the sentence in question marked, so a reviewer can see how Q used the line. */
function dropContext(postNum, sentenceText, radius = 3) {
  const post = byNum.get(postNum)
  if (!post) return ['(drop not found)']
  const lines = runtimeText(post.text).split('\n').map(l => l.trim())
  const idx = lines.findIndex(l => l.includes(sentenceText.slice(0, 40)))
  const from = Math.max(0, idx - radius), to = Math.min(lines.length, idx + radius + 1)
  return lines.slice(from, to).map((l, i) => (from + i === idx ? `>>> ${l}` : `    ${l}`))
}

p('# Q Drops — Step 3 review pack')
p('')
p('Self-contained. You do not need the repository: every decision below carries its own evidence.')
p('')
p('---')
p('')
p('## What this project is')
p('')
p('A research tool over the 4,966 "Q" posts (2017-2020). Every drop is decomposed into what it')
p('asked, claimed, predicted and named, so any phrase can be traced across the archive. The')
p('classifications are *certified*: each one is an adjudicated record with provenance, not a')
p('runtime guess. The owner rules; the code materialises the ruling.')
p('')
p('Local build is ahead of production and **not deployed**. Production is untouched.')
p('')
p('## The layer model (settled, 2026-08-21)')
p('')
p('| layer | kinds | rule |')
p('|---|---|---|')
p('| **primary** | Claim, Prediction, Question, Directive | one adjudicated category per complete sentence |')
p('| **inline** | Named Entity, `[Bracket]` | may overlap a primary span; renders *above* it |')
p('| **review** | Context, Emphasis, theme anchor | a disposition, not a competing sentence colour |')
p('')
p('An occurrence is keyed `postNum | kind | startOffset | endOffset`, never by its text. Repeated')
p('wording therefore stays separate: `"Fantasy land."` written four times in drop #111 is four')
p('distinct occurrences, not one.')
p('')
p('## Constraints any proposal must respect')
p('')
p('1. **Q\'s literal wording is never rewritten.** A span is taken from the drop, never retyped.')
p('2. **Quoted/source material stays separate from Q-authored.** Pasted news must never be')
p('   certified as Q asserting it.')
p('3. **In-post repeats are real.** Identical wording in one drop is multiple occurrences.')
p('4. **No automatic category-precedence rule.** "Claim always beats Directive" is explicitly')
p('   rejected; a conflict needs an adjudicated answer or a stated shape rule.')
p('5. **Certified counts only move with a recorded reason**, asserted at the line that checks them.')
p('6. Two overlaps are **deliberate** and must survive: the directive+question pair (a line that is')
p('   grammatically an instruction and functionally a request for an answer), and nested named')
p('   entities (`US` inside `US Military`), which each keep their own hover explanation.')
p('')
p('---')
p('')

// ── DECISION 1 ──────────────────────────────────────────────────────────────
const needs = (dry.multiPrimary ?? []).filter(m => !m.certifiedOverlap)
const byCombo = {}
for (const m of needs) { const k = m.kinds.join(' + '); (byCombo[k] ??= []).push(m) }

p('# DECISION 1 — 117 sentences carry two primary categories')
p('')
p('Each of these sentences is certified in **two** primary sections at once. Under the layer model')
p('exactly one may be primary. The other must either be withdrawn, or re-expressed as a')
p('non-competing layer.')
p('')
p('A further **220** sentences carry the directive+question pair. Those are a *certified,*')
p('*deliberate* overlap and are **not** in scope here.')
p('')
p('| combination | count |')
p('|---|---|')
for (const [k, v] of Object.entries(byCombo)) p(`| ${k} | ${v.length} |`)
p('')
p('### The question for you')
p('')
p('Is there a **shape rule** that resolves each group, or must these be ruled row by row? For')
p('example one candidate rule is *"a line beginning `Expect ...` is a Prediction, not a Directive"*.')
p('If a shape rule is right, state it precisely enough to be executed and to be checked afterwards.')
p('If a group has no clean rule, say so — row-by-row adjudication is an acceptable answer.')
p('')
p('Also: when a sentence genuinely is both — an instruction that also asserts a fact — should the')
p('loser be **withdrawn entirely**, or retained as a non-painting secondary attribute (the way the')
p('directive+question pair is retained as a relationship edge)?')
p('')

for (const [combo, rows] of Object.entries(byCombo)) {
  p(`## ${combo} — ${rows.length} sentences`)
  p('')
  for (const m of rows) {
    const text = m.spans[0]?.text ?? ''
    p(`**#${m.postNum}** \`${m.sentenceId}\` — *${combo}*`)
    p('')
    p('```')
    p(...dropContext(m.postNum, text))
    p('```')
    p('')
  }
}

// ── DECISION 2 ──────────────────────────────────────────────────────────────
const primaryOv = (dry.sameCategoryOverlap ?? []).filter(o => o.layer === 'primary')
p('---')
p('')
p('# DECISION 2 — 51 same-category overlaps in the primary layer')
p('')
p('Two spans of the *same* category covering overlapping characters. The owner\'s rule is that this')
p('must not happen: the fuller span should replace the fragment. Most are nested.')
p('')
p('600 further overlaps sit in the inline/review layers and overlap **by design** — they are out of')
p('scope.')
p('')
p('### The question for you')
p('')
p('Is "keep the longer span, drop the shorter" always right here? Look especially at rows where')
p('`nested` is `false` — those are partial overlaps, not containment, and a longest-wins rule may')
p('not be safe.')
p('')
p('| post | sentence | kind | nested | span A | span B |')
p('|---|---|---|---|---|---|')
for (const o of primaryOv) {
  p(`| #${o.postNum} | \`${o.sentenceId}\` | ${o.kind} | ${o.nested} | ${JSON.stringify(o.a)} | ${JSON.stringify(o.b)} |`)
}
p('')

// ── DECISION 3 ──────────────────────────────────────────────────────────────
p('---')
p('')
p('# DECISION 3 — 3 source-boundary exceptions')
p('')
p('A sentence splitter cut certified spans at abbreviations (`Mr.`, `Lt. Gen.`, `U.S.`, `Harris v.`).')
p('114 were repaired. **Three were refused**, because completing them would extend a *Q-authored*')
p('classification into text already recorded as an **editorial paraphrase** — pasted source')
p('material. Two of the three carry Q\'s `>` quote marker.')
p('')
p('Shipping a knowingly truncated highlight also violates the full-sentence rule, so neither')
p('leaving them nor completing them is currently correct.')
p('')
for (const e of abbrev.excluded?.spans ?? []) {
  p(`### #${e.postNum} — ${e.category}`)
  p('')
  p(`- **currently certified as:** ${JSON.stringify(e.truncated)}`)
  p(`- **would have become:** ${JSON.stringify(e.wouldHaveBecome)}`)
  p(`- **refused because:** ${e.why}`)
  p('')
  p('Drop context:')
  p('```')
  p(...dropContext(e.postNum, e.truncated.slice(0, 40), 2))
  p('```')
  p('')
}
p('### The question for you')
p('')
p('For each: reconstruct the full lifted sentence and store it as `quoted_source` / non-Q-authored,')
p('or withdraw the partial highlight entirely and keep a `SOURCE_BOUNDARY_EXCEPTION` record? Is')
p('there a principled way to tell which of the two applies, or is it case by case?')
p('')

// ── DECISION 4 ──────────────────────────────────────────────────────────────
p('---')
p('')
p('# DECISION 4 — the conflict queue')
p('')
p('None of these is auto-resolved. Each needs a disposition.')
p('')
p(`## ${dry.totals.crossingSentenceBoundary} spans cross a sentence boundary`)
p('')
p('A certified span that starts in one sentence and ends in another. The ruling says do **not** cut')
p('them automatically. Options: re-adjudicate to one sentence, split into two occurrences, or allow')
p('a multi-sentence span as a legitimate shape.')
p('')
const crossSamples = []
for (const post of posts) {
  if (crossSamples.length >= 12) break
  const ss = sentencesFor(post.text, post.postNum)
  const a = post.postAnalysis ?? {}
  for (const t of [...(a.claimSpans ?? a.claims ?? [])]) {
    if (crossSamples.length >= 12) break
    const rt = runtimeText(post.text)
    const at = rt.indexOf(t)
    if (at < 0) continue
    const holder = ss.find(s => at >= s.start && at + t.length <= s.end)
    if (!holder) crossSamples.push({ postNum: post.postNum, text: t })
  }
}
p('Examples:')
p('')
for (const c of crossSamples) p(`- **#${c.postNum}** ${JSON.stringify(c.text.slice(0, 150))}`)
p('')
p(`## ${dry.totals.unlocated} spans could not be located in the drop text`)
p('')
const unByKind = (dry.unlocated ?? []).reduce((m, u) => { m[u.kind] = (m[u.kind] ?? 0) + 1; return m }, {})
p('By kind: ' + JSON.stringify(unByKind))
p('')
p('Almost all are **named entities**. `namedEntities` records the canonical *identity* present in a')
p('drop, not a literal span — a post writing `BO` is recorded as `Hussein`. These resolve through an')
p('alias registry; the ones listed here did not resolve under the canonical name or any registered')
p('spelling. Examples:')
p('')
for (const u of (dry.unlocated ?? []).slice(0, 12)) p(`- **#${u.postNum}** \`${u.kind}\` ${JSON.stringify(u.text)}`)
p('')
p('### The question for you')
p('')
p('Is an entity whose spelling cannot be found in the drop a data defect (the identity should not')
p('be on that post), a *registry gap* (the spelling Q used is missing from the alias list), or a')
p('legitimate inference (Q referred to the person without naming them)? The answer decides whether')
p('these are fixed, queued for the owner, or accepted as-is.')
p('')
p(`## ${dry.totals.duplicateKeys} duplicate occurrence keys`)
p('')
p('Two records claiming the same post, kind and character range. Under the new model these are the')
p('same occurrence recorded twice.')
p('')

// ── DECISION 5 ──────────────────────────────────────────────────────────────
p('---')
p('')
p('# DECISION 5 — the entity sweep, already ruled but not yet run')
p('')
p('The owner has ruled that `Q`, `QAnon` and `Anon`/`Anons` become Named Entities everywhere they')
p('occur meaningfully in **Q-authored body text**, with:')
p('')
p('- terminal standalone `Q` / `Q+` signature lines excluded')
p('- `QAnon` as one longest-match span — no nested `Q` or `Anon` inside it')
p('- `Anon`/`Anons`/`Anon(s)` folded to a single `Anons` identity, no nested `Anon`')
p('- no `Q` from `Q&A`, URLs, `/qresearch/` paths, filenames, tripcodes, or FAQ `Q:` labels')
p('- no `Anon` inside `QAnon`, `anonymous`, `anonymously`')
p('- quoted-post and image/OCR matches kept as separate evidence, never added to Q-authored totals')
p('')
p('Current raw counts in Q-authored body text (signature lines already excluded):')
p('')
p('| term | posts |')
p('|---|---|')
const strip = t => runtimeText(t ?? '').split('\n')
  .filter(l => !/^\s*(?:>|&gt;){1,2}\s*\d{5,}\s*$/.test(l.trim()))
  .filter(l => !/^\s*Q[+!]?\s*$/.test(l))
  .join('\n')
let qN = 0, anonN = 0, qanonN = 0
for (const post of posts) {
  const t = strip(post.text)
  if (/\bQAnon\b/i.test(t)) qanonN++
  if (/\bAnons?\b/i.test(t)) anonN++
  if (/(^|[^A-Za-z0-9+/])Q([^A-Za-z0-9+&]|$)/.test(t)) qN++
}
p(`| \`Q\` in body | ${qN} |`)
p(`| \`Anon\`/\`Anons\` | ${anonN} |`)
p(`| \`QAnon\` | ${qanonN} |`)
p('')
p('### The question for you')
p('')
p('The exclusion list above was written from a handful of observed cases. What *else* would a')
p('token-aware sweep get wrong on a 4,966-post corpus of chan-board text? Q writes in fragments,')
p('acronyms, timestamps, tripcodes and pasted headlines. Name the failure modes worth guarding')
p('before this runs, and say how each should be detected.')
p('')

p('---')
p('')
p('# Summary of what is being asked')
p('')
p('1. A shape rule, or row-by-row rulings, for the 117 two-category sentences — and whether the')
p('   losing category is withdrawn or retained as a non-painting attribute.')
p('2. Whether "longest span wins" is safe for the 51 same-category overlaps, especially the')
p('   non-nested ones.')
p('3. A disposition for each of the 3 source-boundary exceptions.')
p('4. How to treat the conflict queue: 242 boundary-crossing spans, 645 unlocatable entities,')
p('   148 duplicate keys.')
p('5. Failure modes to guard before the archive-wide `Q` / `QAnon` / `Anons` entity sweep.')
p('')
p('Anything that changes a certified count needs a stated reason, because every count in this')
p('archive is asserted at the line that checks it and moving one silently is the failure mode this')
p('whole process exists to prevent.')
p('')

fs.writeFileSync(path.join(ROOT, 'STEP3-REVIEW-PACK.md'), L.join('\n') + '\n')
console.log(`wrote STEP3-REVIEW-PACK.md — ${L.length} lines, ${(fs.statSync(path.join(ROOT, 'STEP3-REVIEW-PACK.md')).size / 1024).toFixed(0)} KB`)
