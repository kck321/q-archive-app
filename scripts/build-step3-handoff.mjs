// Build the Step 3 review pack and its row-level companions.
//
// The reader has no access to this repository, so every row carries its own evidence: the drop
// number, the occurrence key, the exact offsets, the sentence, and the lines around it.
//
//   node scripts/build-step3-handoff.mjs
//
// THREE CORRECTIONS FROM THE 2026-08-21 OUTSIDE REVIEW, each of which had produced a real defect:
//
//   1. CONTEXT WAS FOUND BY TEXT, NOT BY OFFSET. `lines.findIndex(l => l.includes(text))` returns
//      the FIRST matching line — so on #111, where Q writes "Fantasy land." four times, three of
//      the four occurrences were shown the context of the first. A pack that says repeated wording
//      is separate occurrences cannot then locate them by wording. Context now comes from the
//      occurrence's own start/end offsets.
//   2. THE SIGNATURE FILTER REMOVED EVERY STANDALONE "Q" LINE, not only the terminal one. 15 drops
//      carry a standalone Q inside the body, and the ruling is explicit that a meaningful Q is
//      included and only the trailing signature is excluded. Now positional.
//   3. THE Q-AUTHORED COUNTS WERE NOT SOURCE-AWARE. They regex'd the rendered text, so greentext
//      excerpts and pasted articles counted as Q writing the word. Now filtered through
//      sourceLines(), the archive's own source-boundary detector.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor, occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const dry = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'occurrence-ledger-dryrun.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const abbrev = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'abbreviation-span-repairs.json'), 'utf8'))
const entitiesDoc = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))

const sentenceCache = new Map()
const sentencesOf = postNum => {
  if (!sentenceCache.has(postNum)) sentenceCache.set(postNum, sentencesFor(byNum.get(postNum)?.text, postNum))
  return sentenceCache.get(postNum)
}

/**
 * The drop around a CHARACTER RANGE, with the covered lines marked.
 *
 * Offsets, never text. See correction 1 in the module note.
 */
function contextAt(postNum, start, end, radius = 3) {
  const post = byNum.get(postNum)
  if (!post) return ['(drop not found)']
  const text = runtimeText(post.text)
  const lines = []
  let at = 0
  for (const raw of text.split('\n')) {
    lines.push({ raw: raw.trim(), start: at, end: at + raw.length })
    at += raw.length + 1
  }
  const first = lines.findIndex(l => l.end > start)
  const last = lines.findIndex(l => l.start >= end)
  const hiFrom = first < 0 ? 0 : first
  const hiTo = last < 0 ? lines.length - 1 : Math.max(hiFrom, last - 1)
  const from = Math.max(0, hiFrom - radius)
  const to = Math.min(lines.length, hiTo + radius + 1)
  return lines.slice(from, to)
    .map((l, i) => (from + i >= hiFrom && from + i <= hiTo ? `>>> ${l.raw}` : `    ${l.raw}`))
}

/** Context for a sentence id — resolved through the ledger, so it is the right occurrence. */
function contextForSentence(postNum, sentenceId, radius = 3) {
  const s = sentencesOf(postNum).find(x => x.sentenceId === sentenceId)
  if (!s) return ['(sentence not found)']
  return contextAt(postNum, s.start, s.end, radius)
}
const sentenceTextOf = (postNum, sentenceId) =>
  sentencesOf(postNum).find(x => x.sentenceId === sentenceId)?.text ?? ''

// ── CSV ──────────────────────────────────────────────────────────────────────
const csvCell = v => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const writeCsv = (file, headers, rows) => {
  const out = [headers.join(',')]
  for (const r of rows) out.push(headers.map(h => csvCell(r[h])).join(','))
  fs.writeFileSync(path.join(ROOT, file), out.join('\n') + '\n')
  console.log(`  ${file.padEnd(38)} ${rows.length} rows`)
}

// ── 242 boundary crossings ───────────────────────────────────────────────────
writeCsv('STEP3-242-BOUNDARY-CROSSINGS.csv',
  ['occurrenceKey', 'postNum', 'kind', 'layer', 'start', 'end', 'sentencesTouched', 'sentenceIds',
    'spanText', 'sentenceTexts', 'allSentencesSameLine', 'context'],
  (dry.crossingRows ?? []).map(r => ({
    ...r,
    sentenceIds: r.sentenceIds.join(' '),
    spanText: r.text,
    sentenceTexts: r.sentenceTexts.join(' ⏎ '),
    // If every touched sentence sits on one line, the span is two sentences of one line joined —
    // a different problem from a span running across a line break.
    allSentencesSameLine: (() => {
      const ss = sentencesOf(r.postNum).filter(s => r.sentenceIds.includes(s.sentenceId))
      const t = runtimeText(byNum.get(r.postNum)?.text ?? '')
      const lineOf = off => t.slice(0, off).split('\n').length
      return ss.length ? new Set(ss.map(s => lineOf(s.start))).size === 1 : false
    })(),
    context: contextAt(r.postNum, r.start, r.end, 2).join(' ⏎ '),
  })))

// ── 645 unlocated entities ───────────────────────────────────────────────────
const aliasesOf = new Map()
for (const e of entitiesDoc.entities ?? []) {
  aliasesOf.set(String(e.canonical).toLowerCase(), (e.aliases ?? []).map(a => a.text))
}
writeCsv('STEP3-645-UNLOCATED-ENTITIES.csv',
  ['postNum', 'kind', 'identity', 'aliasesAttempted', 'aliasCount', 'postText'],
  (dry.unlocated ?? []).map(u => ({
    postNum: u.postNum, kind: u.kind, identity: u.text,
    aliasesAttempted: (aliasesOf.get(String(u.text).toLowerCase()) ?? []).join(' | '),
    aliasCount: (aliasesOf.get(String(u.text).toLowerCase()) ?? []).length,
    postText: runtimeText(byNum.get(u.postNum)?.text ?? '').replace(/\n/g, ' ⏎ ').slice(0, 900),
  })))

// ── 148 duplicate occurrence keys ────────────────────────────────────────────
writeCsv('STEP3-148-DUPLICATE-KEYS.csv',
  ['occurrenceKey', 'postNum', 'kind', 'start', 'end', 'identicalText', 'textA', 'textB', 'context'],
  (dry.duplicateRows ?? []).map(d => ({ ...d, context: contextAt(d.postNum, d.start, d.end, 1).join(' ⏎ ') })))

// ── Q / QAnon / Anons candidates ─────────────────────────────────────────────
//
// Every candidate, INCLUDED and EXCLUDED, with the reason — the ruling asks for excluded
// candidates to be reported rather than silently dropped.
const QCANDS = []
const CLEAN = t => runtimeText(t ?? '')

for (const post of posts) {
  const text = CLEAN(post.text)
  const lines = text.split('\n')
  const src = sourceLines(text)
  // Correction 2: the signature is POSITIONAL. Only a standalone Q/Q+ occupying the last
  // non-empty line is a signature; an identical line earlier in the body is content.
  let lastNonEmpty = -1
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim()) { lastNonEmpty = i; break }

  let off = 0
  lines.forEach((raw, i) => {
    const lineStart = off
    off += raw.length + 1
    const l = raw.trim()
    if (!l) return
    const isSignature = i === lastNonEmpty && /^Q[+!]?$/.test(l)
    const sourceReason = src.get(i) ?? null
    const isPointer = /^(?:>|&gt;){1,2}\s*\d{5,}$/.test(l)

    const record = (term, form, matchStart, exclude) => QCANDS.push({
      postNum: post.postNum, term, form,
      start: lineStart + matchStart, end: lineStart + matchStart + form.length,
      line: l.slice(0, 200),
      included: !exclude, excludedBecause: exclude ?? '',
    })

    // QAnon first — longest match wins, so no nested Q or Anon is emitted inside it.
    const consumed = []
    for (const m of l.matchAll(/\bQ[\s-]?Anon\b/gi)) {
      consumed.push([m.index, m.index + m[0].length])
      record('QAnon', m[0], m.index,
        isSignature ? 'terminal signature' : sourceReason ? `source material — ${sourceReason}` : isPointer ? 'board pointer' : null)
    }
    const inside = at => consumed.some(([a, b]) => at >= a && at < b)

    for (const m of l.matchAll(/\bAnon(?:s|\(s\))?\b/gi)) {
      if (inside(m.index)) continue                       // the Anon of QAnon
      record('Anons', m[0], m.index,
        isSignature ? 'terminal signature' : sourceReason ? `source material — ${sourceReason}` : null)
    }

    // Q as a standalone token. The exclusion list from the ruling, each with its own reason.
    for (const m of l.matchAll(/(?<![A-Za-z0-9])Q(?![A-Za-z0-9])/g)) {
      if (inside(m.index)) continue                       // the Q of QAnon
      const before = l.slice(Math.max(0, m.index - 24), m.index)
      const after = l.slice(m.index + 1, m.index + 24)
      let why = null
      if (isSignature) why = 'terminal signature'
      else if (sourceReason) why = `source material — ${sourceReason}`
      else if (/^\s*&\s*A/i.test(after) || /Q\s*&\s*A/i.test(l.slice(Math.max(0, m.index - 2), m.index + 4))) why = 'Q&A — Q means Question'
      else if (/^:/.test(after) && /^\s*Q\s*:/.test(l)) why = 'FAQ label "Q:" — Q means Question'
      else if (/[/\\]$|[/\\]\w*$/.test(before) || /^[/\\]/.test(after)) why = 'URL or path'
      else if (/https?:\S*$/i.test(before)) why = 'inside a URL'
      else if (/!\S*$/.test(before) || /^!/.test(after)) why = 'tripcode'
      else if (/^[1-4]\b/.test(after)) why = 'quarter label (Q1–Q4)'
      else if (/^-[A-Z0-9]/.test(after)) why = 'technical code (Q-T2810C)'
      else if (/clearance|fever/i.test(after)) why = 'Q clearance / Q fever — not the persona'
      record('Q', m[0], m.index, why)
    }
  })
}
writeCsv('STEP3-Q-QANON-ANONS-CANDIDATES.csv',
  ['postNum', 'term', 'form', 'start', 'end', 'included', 'excludedBecause', 'line'], QCANDS)

// ── 117 multi-primary, as JSONL with full evidence ───────────────────────────
{
  const needs = (dry.multiPrimary ?? []).filter(m => !m.certifiedOverlap)
  const out = needs.map(m => JSON.stringify({
    sentenceId: m.sentenceId, postNum: m.postNum, categories: m.kinds,
    sentenceText: sentenceTextOf(m.postNum, m.sentenceId),
    spans: m.spans,
    context: contextForSentence(m.postNum, m.sentenceId, 3),
  }))
  fs.writeFileSync(path.join(ROOT, 'STEP3-117-MULTI-PRIMARY.jsonl'), out.join('\n') + '\n')
  console.log(`  STEP3-117-MULTI-PRIMARY.jsonl          ${out.length} rows`)
}

// ── 51 same-category overlaps, as CSV ────────────────────────────────────────
writeCsv('STEP3-51-SAME-CATEGORY.csv',
  ['sentenceId', 'postNum', 'kind', 'nested', 'spanA', 'spanB', 'sentenceText', 'context'],
  (dry.sameCategoryOverlap ?? []).filter(o => o.layer === 'primary').map(o => ({
    sentenceId: o.sentenceId, postNum: o.postNum, kind: o.kind, nested: o.nested,
    spanA: o.a, spanB: o.b,
    sentenceText: sentenceTextOf(o.postNum, o.sentenceId),
    context: contextForSentence(o.postNum, o.sentenceId, 2).join(' ⏎ '),
  })))

// ── The markdown pack ────────────────────────────────────────────────────────
const L = []
const p = (...xs) => L.push(...xs)

p('# Q Drops — Step 3 review pack (revision 2)')
p('')
p('Self-contained. Every decision carries its own evidence.')
p('')
p('**Revision 2 corrects three defects in revision 1**, all found by outside review:')
p('')
p('1. Context was located by matching the first 40 characters of a sentence, which returns the')
p('   FIRST matching line. On drops where Q repeats a line — `"Fantasy land."` four times in #111 —')
p('   three of four occurrences were shown the wrong context. Context is now taken from the')
p('   occurrence\'s own character offsets.')
p('2. The signature filter removed *every* standalone `Q` line. 15 drops carry a standalone `Q`')
p('   inside the body, and the ruling includes those. Signature detection is now positional.')
p('3. The `Q`/`QAnon`/`Anons` counts were not source-aware, so greentext excerpts and pasted')
p('   articles counted as Q writing the word. They now run through the archive\'s own')
p('   source-boundary detector.')
p('')
p('Row-level companions (every record, not samples):')
p('')
p('| file | contents |')
p('|---|---|')
p('| `STEP3-117-MULTI-PRIMARY.jsonl` | all 117, with sentence text and drop context |')
p('| `STEP3-51-SAME-CATEGORY.csv` | all 51 primary-layer same-category overlaps |')
p('| `STEP3-242-BOUNDARY-CROSSINGS.csv` | all 242, with every sentence each span touches |')
p('| `STEP3-645-UNLOCATED-ENTITIES.csv` | all 645, with the aliases attempted and the drop text |')
p('| `STEP3-148-DUPLICATE-KEYS.csv` | all 148, with both records\' text and whether they agree |')
p('| `STEP3-Q-QANON-ANONS-CANDIDATES.csv` | every candidate, included AND excluded, with the reason |')
p('')
p('---')
p('')
p('## What this project is')
p('')
p('A research tool over the 4,966 "Q" posts (2017-2020). Every drop is decomposed into what it')
p('asked, claimed, predicted and named. Classifications are *certified*: each is an adjudicated')
p('record with provenance, not a runtime guess. The owner rules; the code materialises the ruling.')
p('')
p('Local build is ahead of production and **not deployed**.')
p('')
p('## The layer model')
p('')
p('| layer | kinds | rule |')
p('|---|---|---|')
p('| **primary** | Claim, Prediction, Question, Directive | one *painted* category per complete sentence |')
p('| **secondary** | any other genuinely certified meaning | counted and searchable, **does not paint** |')
p('| **inline** | Named Entity, `[Bracket]` | may overlap a primary span; renders *above* it |')
p('| **review** | Context, Emphasis, theme anchor | a disposition, not a competing sentence colour |')
p('')
p('The secondary layer is new in revision 2, and it resolves a contradiction revision 1 carried:')
p('the model said "one category per sentence" while also protecting 220 directive+question pairs.')
p('Both cannot be *painted*. They can both be *certified*.')
p('')
p('## Constraints any proposal must respect')
p('')
p('1. **Q\'s literal wording is never rewritten.** A span is taken from the drop, never retyped.')
p('2. **Quoted/source material stays separate from Q-authored.**')
p('3. **In-post repeats are real.** Identical wording in one drop is multiple occurrences.')
p('4. **No automatic category-precedence rule.** A conflict needs an adjudicated answer or a')
p('   stated shape rule that can be checked afterwards.')
p('5. **Certified counts move only with a recorded reason**, asserted at the line that checks them.')
p('')
p('---')
p('')
p('# OPEN QUESTION — is Theme a primary category?')
p('')
p('Revision 1 defined the primary layer as Claim, Prediction, Question, Directive and said nothing')
p('about **Themes**, which the archive also certifies. That was an omission, not a decision.')
p('')
p('The data: themes are stored as a taxonomy label per drop (`themes`) plus a `themeAnchors` array')
p('naming the words in the drop that evidence the theme. An anchor is a *fragment* — `"God bless"`,')
p(`"convicted" — not a complete sentence. On that evidence a theme anchor behaves like an inline`)
p('annotation and a theme like a drop-level tag, and neither is a sentence-level primary category.')
p('')
p('**This needs an explicit ruling before 3B**, because if Theme *is* primary then some of the 117')
p('conflicts and some of the 1,531 review-layer collisions are the wrong shape.')
p('')
p('---')
p('')

const needs = (dry.multiPrimary ?? []).filter(m => !m.certifiedOverlap)
const byCombo = {}
for (const m of needs) { const k = m.kinds.join(' + '); (byCombo[k] ??= []).push(m) }

p('# DECISION 1 — 117 sentences carry two primary categories')
p('')
p('Each is certified in two primary sections at once. Under the layer model exactly one may be')
p('**painted**; the other becomes a non-painting secondary classification, or is withdrawn if it')
p('was a fragment, a splitter artifact, a duplicate or a mistake.')
p('')
p('A further **220** sentences carry the directive+question pair. Under revision 2 they are the')
p('same shape as these — one painted primary, one secondary — and are no longer treated as exempt.')
p('')
p('| combination | count |')
p('|---|---|')
for (const [k, v] of Object.entries(byCombo)) p(`| ${k} | ${v.length} |`)
p('')
p('Full rows with context: `STEP3-117-MULTI-PRIMARY.jsonl`. Reproduced below for reading.')
p('')
for (const [combo, rows] of Object.entries(byCombo)) {
  p(`## ${combo} — ${rows.length} sentences`)
  p('')
  for (const m of rows) {
    p(`**#${m.postNum}** \`${m.sentenceId}\` — *${combo}*`)
    p('')
    p('```')
    p(...contextForSentence(m.postNum, m.sentenceId))
    p('```')
    p('')
  }
}

const primaryOv = (dry.sameCategoryOverlap ?? []).filter(o => o.layer === 'primary')
p('---')
p('')
p('# DECISION 2 — 51 same-category overlaps in the primary layer')
p('')
p('Two spans of the same category covering overlapping characters. Full rows with sentence text and')
p('context: `STEP3-51-SAME-CATEGORY.csv`.')
p('')
p(`Nested (one fully contains the other): **${primaryOv.filter(o => o.nested).length}**. ` +
  `Partial overlap: **${primaryOv.filter(o => !o.nested).length}** — longest-wins is not obviously safe for these.`)
p('')
p('| post | sentence | kind | nested | span A | span B |')
p('|---|---|---|---|---|---|')
for (const o of primaryOv) p(`| #${o.postNum} | \`${o.sentenceId}\` | ${o.kind} | ${o.nested} | ${JSON.stringify(o.a)} | ${JSON.stringify(o.b)} |`)
p('')
p('**Nested named entities** (`US` inside `US Military`) are a separate matter, and revision 1 put')
p('them out of scope on the grounds that each keeps its own hover explanation. Outside review')
p('rejected that: the no-same-category-overlap rule should hold for entities too, with both')
p('identities preserved as metadata on composed atomic runs rather than as two painted spans.')
p(`There are **${(dry.sameCategoryOverlap ?? []).filter(o => o.kind === 'namedEntities').length}** such overlaps. They are in scope for Step 4, not Step 3B.`)
p('')

p('---')
p('')
p('# DECISION 3 — 3 source-boundary exceptions')
p('')
p('A splitter cut certified spans at abbreviations. 114 were repaired; **three were refused**,')
p('because completing them would extend a *Q-authored* classification into text already recorded as')
p('an editorial paraphrase. Two carry Q\'s `>` quote marker; the third sits under a `WASH POST:`')
p('header.')
p('')
for (const e of abbrev.excluded?.spans ?? []) {
  const hits = occurrencesOfSpan(byNum.get(e.postNum)?.text, e.truncated)
  p(`### #${e.postNum} — ${e.category}`)
  p('')
  p(`- **currently certified as:** ${JSON.stringify(e.truncated)}`)
  p(`- **would have become:** ${JSON.stringify(e.wouldHaveBecome)}`)
  p(`- **refused because:** ${e.why}`)
  p('')
  p('```')
  p(...(hits.length ? contextAt(e.postNum, hits[0][0], hits[0][1], 2) : ['(span not located)']))
  p('```')
  p('')
}

p('---')
p('')
p('# DECISION 4 — the conflict queue')
p('')
p('**Every row is in the companion CSVs.** Summary only here.')
p('')
p(`## ${(dry.crossingRows ?? []).length} spans crossing a sentence boundary`)
p('')
p('`STEP3-242-BOUNDARY-CROSSINGS.csv` — each row lists every sentence the span touches, and a flag')
p('for whether those sentences all sit on one line (two sentences of one line joined) or straddle a')
p('line break (a different problem).')
p('')
const sameLine = (dry.crossingRows ?? []).length
p(`## ${(dry.unlocated ?? []).length} spans that could not be located in the drop text`)
p('')
p('`STEP3-645-UNLOCATED-ENTITIES.csv` — each row carries the identity, every registered alias that')
p('was attempted, and the full drop text, so a reviewer can see whether the spelling Q used is')
p('simply missing from the registry or whether no literal reference exists at all.')
p('')
p(`## ${(dry.duplicateRows ?? []).length} duplicate occurrence keys`)
p('')
p(`\`STEP3-148-DUPLICATE-KEYS.csv\`. **${(dry.duplicateRows ?? []).filter(d => d.identicalText).length}** of them hold identical text and are safe to merge; ` +
  `**${(dry.duplicateRows ?? []).filter(d => !d.identicalText).length}** hold *different* text at the same offsets and need a decision.`)
p('')

p('---')
p('')
p('# DECISION 5 — the Q / QAnon / Anons sweep')
p('')
p('`STEP3-Q-QANON-ANONS-CANDIDATES.csv` lists **every** candidate the sweep would consider —')
p('included and excluded — with the reason for each exclusion, at exact offsets.')
p('')
const inc = QCANDS.filter(c => c.included), exc = QCANDS.filter(c => !c.included)
p('| term | candidates | included | excluded | distinct posts (included) |')
p('|---|---|---|---|---|')
for (const term of ['Q', 'QAnon', 'Anons']) {
  const all = QCANDS.filter(c => c.term === term)
  const i = all.filter(c => c.included)
  p(`| ${term} | ${all.length} | ${i.length} | ${all.length - i.length} | ${new Set(i.map(c => c.postNum)).size} |`)
}
p('')
p(`Deduplicated union of posts with at least one included occurrence: **${new Set(inc.map(c => c.postNum)).size}**.`)
p('')
p('Exclusions by reason:')
p('')
p('| reason | count |')
p('|---|---|')
const excBy = exc.reduce((m, c) => { m[c.excludedBecause] = (m[c.excludedBecause] ?? 0) + 1; return m }, {})
for (const [k, v] of Object.entries(excBy).sort((a, b) => b[1] - a[1])) p(`| ${k} | ${v} |`)
p('')
p('### The question for you')
p('')
p('These exclusions were written from the ruling plus observed cases. On a 4,966-post corpus of')
p('chan-board text — fragments, acronyms, timestamps, tripcodes, pasted headlines — what else would')
p('this get wrong, and how should each failure be detected? The CSV lets you check the actual rows')
p('rather than reason from the rule list.')
p('')

p('---')
p('')
p('# Summary of what is being asked')
p('')
p('1. Is **Theme** a primary sentence category, or a drop-level tag with inline anchors?')
p('2. Shape rules or row-by-row rulings for the 117 — and confirmation that the losing category')
p('   becomes a non-painting **secondary**, not a deletion, unless it was a genuine error.')
p('3. Whether longest-wins is safe for the 51, especially the non-nested ones.')
p('4. A disposition for the 3 source-boundary exceptions.')
p('5. Dispositions for the conflict queue, from the full CSVs.')
p('6. Failure modes still missing from the entity sweep.')
p('')

fs.writeFileSync(path.join(ROOT, 'STEP3-REVIEW-PACK.md'), L.join('\n') + '\n')
console.log(`  STEP3-REVIEW-PACK.md                   ${L.length} lines`)
