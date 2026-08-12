// Directives certification — full-corpus pass.
//
// The frozen auditor derived 1,461 directives from a ~40-verb whitelist, and the earlier
// adjudication only covered the units where it and the stored actionRequests disagreed. That
// leaves the corpus itself unaudited, so this re-derives from every Q-authored unit using the
// shared mood detector, exactly as Questions was done.
//
// ORDER MATTERS, and getting it wrong is what a first pass at this got wrong:
//
//   Running imperativeMood() over the raw corpus reports 2,780 "imperatives" — but 279 of
//   them open with "Do" ("Do you believe in coincidences?") and 31 with "Have" ("Have the
//   puppet masters traveled to this island?"). Those are interrogatives. `do` and `have` are
//   base-form verbs, so mood detection alone cannot tell them apart. The earlier adjudicator
//   never saw the problem because it tested /\?$/ BEFORE calling imperativeMood.
//
//   So the certified Questions dataset is consulted FIRST here. A unit already certified as a
//   question is settled; mood is never asked about it.
//
// Questions are frozen. Nothing in this script writes to public/data. AUDIT ONLY.
//
//   node scripts/certify-directives.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key, unitsFor, SEGMENTATION_RISK, STARTS_TRUNCATED } from './lib/segment.mjs'
import { imperativeMood, familyOf, learnVerbsFromCorpus } from './lib/imperative.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const qs = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8'))

const certifiedQ = new Map()
for (const q of qs) {
  if (q.editorialNormalization) continue
  certifiedQ.set(`${q.postNum}|${key(q.text)}`, q)
  // A directive-wrapped question is certified under its embedded span; the enclosing unit is
  // the directive, so index that too or the wrapper looks unclassified.
  if (q.directiveSource) certifiedQ.set(`${q.postNum}|${key(q.directiveSource)}`, q)
}

// An imperative that requests INFORMATION is both: it instructs the reader, and the deliverable
// is an answer. "List the Billionaires." is already certified as a question — so it stays a
// question and gains a directive cross-link, rather than being counted twice or reclassified
// out of a frozen dataset.
const INFO_REQUEST_IMPERATIVE = /^(define|list|identify|explain|describe|clarify|compare|reconcile|name)\b/i

// Verb vocabulary learned from Q's own writing, so the detector is not limited to a hand-list.
const LEARNED = learnVerbsFromCorpus(posts.map(p => clean(p.text ?? '')))
console.log(`learned ${LEARNED.size} verbs from the corpus (infinitive / modal evidence, 2+ sightings)`)

const stored = new Map()
for (const p of posts) for (const r of p.actionRequests ?? []) stored.set(`${p.postNum}|${key(r)}`, r)

const rows = []
const tally = {}
const bump = k => { tally[k] = (tally[k] ?? 0) + 1 }

for (const p of posts) {
  const lines = clean(p.text ?? '').split('\n').map(l => l.trim())
  for (const u of unitsFor(p.text ?? '')) {
    const t = u.text.trim()
    if (!t) continue
    const k = `${p.postNum}|${key(t)}`
    const isStored = stored.has(k)
    const base = {
      postNum: p.postNum, postId: p.id, qSourceText: t,
      storedAsActionRequest: isStored,
      segConfidence: u.segConfidence,
      context: { before: lines[u.startLine - 1] ?? null, after: lines[u.endLine + 1] ?? null },
    }

    // 1. Settled by the certified Questions dataset.
    const q = certifiedQ.get(k)
    if (q) {
      if (q.directiveSource && key(q.directiveSource) === key(t)) {
        bump('DIRECTIVE_WITH_EMBEDDED_QUESTION')
        rows.push({ ...base, klass: 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION', family: 'cognition', countsAsDirective: true, alsoCertifiedQuestion: true, confidence: 'HIGH', why: 'certified directive-wrapped question — the wrapper instructs, the embedded span asks' })
      } else if (INFO_REQUEST_IMPERATIVE.test(t) && imperativeMood(t, LEARNED).imperative) {
        bump('INFO_REQUEST_BOTH')
        rows.push({ ...base, klass: 'Q_QUESTION_AND_DIRECTIVE', family: 'research', countsAsDirective: true, alsoCertifiedQuestion: true, confidence: 'HIGH', why: 'information-request imperative — instructs the reader AND the deliverable is an answer. Certified as a question; gains a directive cross-link rather than being recounted.' })
      } else {
        bump('CERTIFIED_QUESTION_ONLY')
      }
      continue
    }

    // 2. Anything else ending in "?" was covered by the Questions audit and rejected there.
    if (/\?$/.test(t)) { bump('QUESTION_MARK_NOT_CERTIFIED'); continue }

    // 3. Fragments.
    if (SEGMENTATION_RISK.test(t) || STARTS_TRUNCATED.test(t)) {
      bump('SEGMENTATION_ERROR')
      if (isStored) rows.push({ ...base, klass: 'SEGMENTATION_ERROR', countsAsDirective: false, confidence: 'HIGH', why: 'fragment of a split sentence' })
      continue
    }

    // 4. Mood.
    const mood = imperativeMood(t, LEARNED)
    if (mood.undecidable) {
      bump('NEEDS_CONTEXT')
      rows.push({ ...base, klass: 'NEEDS_CONTEXT', countsAsDirective: false, confidence: 'LOW', why: mood.why })
      continue
    }
    if (!mood.imperative) {
      bump('NOT_A_DIRECTIVE')
      // Only surface the disagreements — a stored actionRequest that is not imperative.
      if (isStored) rows.push({ ...base, klass: 'Q_STATEMENT_OR_CLAIM', countsAsDirective: false, confidence: 'MEDIUM', why: `not imperative — ${mood.why}` })
      continue
    }

    const family = familyOf(t)
    // Evidence bands. A curated verb WITH a family is certifiable; anything resting on a
    // corpus-learned verb, or with no family, goes to the queue instead of the certified set.
    const certifiable = !mood.learned && family !== 'other'
    bump(certifiable ? 'DIRECTIVE_CERTIFIABLE' : mood.learned ? 'DIRECTIVE_LEARNED_VERB' : 'DIRECTIVE_UNFAMILIED')
    rows.push({
      ...base,
      klass: 'Q_DIRECTIVE',
      family,
      countsAsDirective: certifiable,
      needsAdjudication: !certifiable,
      verbEvidence: mood.learned ? 'corpus-learned' : 'curated',
      confidence: mood.learned ? 'LOW' : family === 'other' ? 'MEDIUM' : (u.segConfidence === 'HIGH' && /[.!]$/.test(t)) ? 'HIGH' : 'MEDIUM',
      why: mood.learned ? `${mood.why} — verb evidence is corpus-only, needs review`
        : family === 'other' ? `${mood.why} — no family in the agreed six`
        : `${mood.why} — ${family}`,
    })
  }
}

// ── totals ───────────────────────────────────────────────────────────────────
const directives = rows.filter(r => r.countsAsDirective)
const famTally = {}
for (const d of directives) famTally[d.family] = (famTally[d.family] ?? 0) + 1
// Queued, not counted: a curated verb that lands in no agreed family.
const unfamilied = rows.filter(d => d.klass === 'Q_DIRECTIVE' && d.needsAdjudication && d.family === 'other' && d.verbEvidence === 'curated')
const leadTally = {}
for (const d of unfamilied) {
  const w = (d.qSourceText.match(/^[A-Za-z_']+/) ?? [''])[0].toLowerCase()
  leadTally[w] = (leadTally[w] ?? 0) + 1
}
const distinct = new Set(directives.map(d => key(d.qSourceText)))
const postsWith = new Set(directives.map(d => d.postNum))
const newVsStored = directives.filter(d => !d.storedAsActionRequest)
const storedNotDirective = rows.filter(r => r.storedAsActionRequest && !r.countsAsDirective)

const totals = {
  directiveOccurrences: directives.length,
  distinct: distinct.size,
  posts: postsWith.size,
  byFamily: famTally,
  alsoCertifiedQuestions: directives.filter(d => d.alsoCertifiedQuestion).length,
  notCurrentlyStored: newVsStored.length,
  storedButNotDirective: storedNotDirective.length,
  needsContext: rows.filter(r => r.klass === 'NEEDS_CONTEXT').length,
  unfamilied: unfamilied.length,
}
fs.writeFileSync(path.join(OUT, 'directives-certified.json'), JSON.stringify({ scope: 'full-corpus directive derivation', questionsFrozen: true, productionChanged: false, totals, pipeline: tally, rows }, null, 1))

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = ['# Q Drops — Directives certification (candidate)\n']
md.push('Full-corpus pass. Questions stay frozen; **nothing written to `public/data`, nothing deployed.**\n')
md.push('\n## Why the order matters\n')
md.push('Running the mood detector over the raw corpus reports **2,780 imperatives** — but 279 open with `Do` (`Do you believe in coincidences?`) and 31 with `Have` (`Have the puppet masters traveled to this island?`). Those are interrogatives; `do` and `have` are also base-form verbs, so mood alone cannot separate them. The earlier adjudication never hit this because it tested `/\\?$/` before asking about mood.\n')
md.push('So the certified Questions dataset is consulted **first**. A unit already certified as a question is settled and mood is never asked about it.\n')
md.push('\n## Pipeline\n')
md.push('| Stage | Units |')
md.push('|---|---|')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
md.push('\n## Candidate totals\n')
md.push('| Measure | Value |')
md.push('|---|---|')
md.push(`| Directive occurrences | **${totals.directiveOccurrences.toLocaleString()}** |`)
md.push(`| Distinct (canonical \`key()\`) | ${totals.distinct.toLocaleString()} |`)
md.push(`| Posts containing a directive | ${totals.posts.toLocaleString()} |`)
md.push(`| Also a certified question (cross-linked) | ${totals.alsoCertifiedQuestions} |`)
md.push(`| Not currently stored as an actionRequest | ${totals.notCurrentlyStored.toLocaleString()} |`)
md.push(`| Stored as actionRequest but NOT a directive | ${totals.storedButNotDirective.toLocaleString()} |`)
md.push(`| Held at NEEDS_CONTEXT | ${totals.needsContext} |`)
md.push('\n### By family\n')
md.push('| Family | Count |')
md.push('|---|---|')
for (const [f, n] of Object.entries(famTally).sort((a, b) => b[1] - a[1])) md.push(`| ${f} | ${n.toLocaleString()} |`)
md.push('\n## Evidence bands\n')
md.push('A unit joins the **certified candidate** total only if its verb comes from the curated lexicon AND it lands in one of the six agreed families. Everything resting on weaker evidence is queued, not counted.\n')
md.push('| Band | Units | Counted? |')
md.push('|---|---|---|')
md.push(`| Curated verb + agreed family | ${(tally.DIRECTIVE_CERTIFIABLE ?? 0).toLocaleString()} | yes |`)
md.push(`| Directive-wrapped question | ${tally.DIRECTIVE_WITH_EMBEDDED_QUESTION ?? 0} | yes — also a certified question |`)
md.push(`| Information-request imperative | ${tally.INFO_REQUEST_BOTH ?? 0} | yes — also a certified question |`)
md.push(`| Curated verb, no agreed family | ${tally.DIRECTIVE_UNFAMILIED ?? 0} | no — queued |`)
md.push(`| Corpus-learned verb only | ${tally.DIRECTIVE_LEARNED_VERB ?? 0} | no — queued |`)
md.push(`| Stored actionRequest, not imperative | ${storedNotDirective.length.toLocaleString()} | no — queued |`)
md.push(`| Undecidable standing alone | ${tally.NEEDS_CONTEXT ?? 0} | no — queued |`)

md.push('\n## The open-vocabulary problem\n')
md.push("The frozen auditor used ~40 verbs and missed roughly 1,300 units. Hand-extending that list only moves the boundary, so the detector also learns verbs from Q's own writing: a word is a verb if a MODAL precedes it, since English modals take a bare infinitive. That recovers `READY THE MEMES.` and `DISARM.`, which no hand-list held. **111 verbs** were learned this way.\n")
md.push('Two signals had to be excluded, both caught by the output being obviously wrong:\n')
md.push('- **The infinitive marker `to` is unusable** — it is also a preposition, so `to power`, `to justice`, `to POTUS` mint nouns as verbs. Including it produced 1,793 unfamilied "directives" led by POTUS, FISA, HRC and JUSTICE, with `POTUS DECLINE>` read as a command.')
md.push('- **Modals inside questions are inverted** — `Will POTUS declassify?` puts the SUBJECT after the modal. Interrogative lines are now skipped; without that, SESSIONS and DECLAS became verbs.\n')
md.push('Residue remains, because Q writes questions without question marks. That is exactly why every corpus-learned decision is banded LOW and queued rather than certified.\n')

md.push('\n## Two decisions needed before this can be certified\n')
md.push('\n### 1. Information-request imperatives are BOTH\n')
md.push(`\`List the Billionaires.\`, \`List advantages.\`, \`List out all who have foundations.\` are already **certified questions** (\`semanticFunction: information_request\`) and are plainly also directives — they tell the reader to produce something.\n`)
md.push(`This is the mirror of the directive-wrapped case: there the wrapper instructs and the embedded span asks; here one unit does both at once. Since Questions are frozen, they are kept as certified questions and given a directive cross-link — counted once as a question, once as a directive, never twice within either total. **${totals.alsoCertifiedQuestions} units** are affected.\n`)
md.push('Confirm that reading, or say they should be directives only.\n')
md.push(`\n### 2. ${unfamilied.length} directives fit none of the six families\n`)
md.push('The agreed families are research / cognition / attention / morale / prohibition / dissemination. These do not fit:\n')
md.push('| Leading verb | Count | Example |')
md.push('|---|---|---|')
for (const [w, n] of Object.entries(leadTally).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  const ex = unfamilied.find(d => d.qSourceText.toLowerCase().startsWith(w))
  md.push(`| ${w || '(symbol)'} | ${n} | \`${esc(ex?.qSourceText ?? '').slice(0, 62)}\` |`)
}
md.push('\nThey read as **operational tasking** — `Keep open (+6 mo).`, `ADD RUDY (quiet).`, `SET UP.`, `CLEAR ALL NONS.`, `Return to SA.`, `Close to door.` — instructions about handling or state, often addressed to insiders rather than to readers. A seventh family (`operational`) would hold them cleanly. I have **not** invented one: they are parked as `other` at MEDIUM confidence pending your call.\n')
md.push('\n## Adjudication queue — stored as actionRequest, not a directive\n')
md.push(`${storedNotDirective.length.toLocaleString()} stored records do not survive the mood test.\n`)
md.push('| Post | Text | Proposed | Why | Before | After |')
md.push('|---|---|---|---|---|---|')
for (const r of storedNotDirective.slice(0, 200)) {
  md.push(`| #${r.postNum} | \`${esc(r.qSourceText).slice(0, 70)}\` | ${r.klass} | ${esc(r.why).slice(0, 54)} | \`${esc(r.context.before).slice(0, 22)}\` | \`${esc(r.context.after).slice(0, 22)}\` |`)
}
if (storedNotDirective.length > 200) md.push(`\n_…and ${(storedNotDirective.length - 200).toLocaleString()} more in the JSON._`)
fs.writeFileSync(path.join(OUT, 'directives-certified.md'), md.join('\n') + '\n')

console.log('\nDIRECTIVES CERTIFICATION (candidate)\n')
console.log('  pipeline:')
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(6)}  ${k}`)
console.log('\n  TOTALS')
console.log(`    directive occurrences : ${totals.directiveOccurrences.toLocaleString()}`)
console.log(`    distinct              : ${totals.distinct.toLocaleString()}`)
console.log(`    posts                 : ${totals.posts.toLocaleString()}`)
console.log(`    also certified Qs     : ${totals.alsoCertifiedQuestions}`)
console.log(`    not currently stored  : ${totals.notCurrentlyStored.toLocaleString()}`)
console.log(`    stored, not directive : ${totals.storedButNotDirective.toLocaleString()}`)
console.log(`    unfamilied            : ${totals.unfamilied.toLocaleString()}`)
console.log('\n  by family:')
for (const [f, n] of Object.entries(famTally).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(6)}  ${f}`)
console.log('\n→ audit/directives-certified.md\n')
