// Narrow re-open of Questions: the 146 "?"-terminated Q units the frozen scorer dropped.
//
// The frozen scorer is NOT changed. audit-all-questions-v2.mjs:144 subtracts 0.6 for a leading
// imperative verb while a question mark only adds 0.6, against a 0.5 threshold — so every
// "?"-terminated unit opening with ask/have/remember/think/defend/protect/note/look/hold/fight
// scored exactly 0.0 and vanished. This adjudicates those units only.
//
// The edge case that broke the old model: A DIRECTIVE CAN CONTAIN A QUESTION.
//
//   "Ask yourself, why are they panicking?"
//       primaryClass  Q_DIRECTIVE_WITH_EMBEDDED_QUESTION
//       embedded      "why are they panicking?"     <- counts toward the question total
//
// So "one unit = one primary class" is kept for the unit, while the embedded ask is captured
// separately rather than being lost. Embedded spans are SLICED BY INDEX out of the source
// string, never rebuilt, so the recorded text is exactly Q's.
//
// Classes: Q_QUESTION | Q_DIRECTIVE_WITH_EMBEDDED_QUESTION | Q_DIRECTIVE_NO_QUESTION |
//          Q_STATEMENT_OR_HEADING | SEGMENTATION_ERROR | NEEDS_CONTEXT
//
// Nothing is added merely because it contains "?". AUDIT ONLY — no production write, no deploy.
//
//   node scripts/adjudicate-uncovered-questions.mjs [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key, unitsFor, STARTS_TRUNCATED } from './lib/segment.mjs'
import { imperativeMood } from './lib/imperative.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')

// ── interrogative form ───────────────────────────────────────────────────────
const WH = 'who|what|when|where|why|how|which|whose|whom'
const AUX = 'is|are|was|were|am|do|does|did|can|could|should|would|will|shall|have|has|had|may|might|must'
// Case-INSENSITIVE, unlike the frozen auditor's AUX_INVERSION. Q writes in caps constantly, and
// "HAVE YOU EVER WITNESSED 40-50K SEALED INDICTMENTS?" is no less a question for it.
const AUX_INVERSION = new RegExp(`^(?:${AUX})\\s+(?:i|you|we|they|he|she|it|there|the|a|an|this|that|these|those|any|all|no|not|most|some|secret|\\w+)\\b`, 'i')
const NEG_INVERSION = /^(?:don'?t|doesn'?t|didn'?t|isn'?t|aren'?t|wasn'?t|weren'?t|can'?t|couldn'?t|won'?t|wouldn'?t|haven'?t|hasn'?t|hadn'?t)\s+(?:you|we|they|i|he|she|it)\b/i
// Any preceding non-letter, not just whitespace — #2682 ends "…….what happens?" and the
// wh-word is preceded by ellipsis dots.
const WH_ANYWHERE = new RegExp(`(?<![a-z])(?:${WH})\\b`, 'i')
const BARE_WH = new RegExp(`^(?:${WH})[\\s?!.]*$`, 'i')
// "[Do you] remember X?" — Q's habitual ellipsis. Only counts with a question mark present.
const ELLIPTICAL = /^(remember|think|look|sound|seem|feel|notice|recall|see)\b/i
// A noun phrase that requests information: "Name of FATHER?", "List of … w/ ties to Islam?"
const INFO_NOUN = /^(name|list|number|amount|date|time|location|source|reason)\s+of\b/i
// Pure code or arithmetic: 5:5?  1=1?  2 + 2 = 6?  20-25?  2019?  1/100?
const CODEY = /^[^A-Za-z]*\?$/

// ── directive wrappers that carry an embedded question ───────────────────────
// The separator is required, so "Ask the right questions." never matches.
const WRAPPERS = [
  { name: 'ask yourself', rx: /^(ask\s+yourself(?:\s+[^,\-–—:?]{0,60})?\s*[,\-–—:]+\s*)(.+)$/is },
  { name: 'think:',       rx: /^(think\s*[:,]\s*(?:re\s*:\s*)?)(.+)$/is },
  { name: 'consider',     rx: /^(consider\s*[,:\-–—]\s*)(.+)$/is },
]

function interrogative(t) {
  const s = t.trim()
  if (BARE_WH.test(s) || AUX_INVERSION.test(s) || NEG_INVERSION.test(s) || WH_ANYWHERE.test(s)) return true
  // The inversion can sit behind a leading subordinate clause: "if brainwashed by ISIS
  // terrorists (…), could this same woman be 'tasked' …?" — the question is in the second
  // clause, and there is no wh-word anywhere in it.
  return s.split(/,(?![^()\[\]]*[)\]])/).slice(1).some(seg => AUX_INVERSION.test(seg.trim()))
}

export function adjudicate(text, ctx = {}) {
  const t = (text ?? '').trim()
  if (!t) return { primaryClass: 'SEGMENTATION_ERROR', why: 'empty', confidence: 'HIGH' }

  // ── fragments and glued-together units ────────────────────────────────────
  if (STARTS_TRUNCATED.test(t)) {
    return { primaryClass: 'SEGMENTATION_ERROR', why: 'starts on a lone initial — the front of the sentence was cut off', confidence: 'HIGH' }
  }
  if (/\t/.test(t) || /\bsynonyms\s*:/i.test(t)) {
    return { primaryClass: 'SEGMENTATION_ERROR', why: 'a pasted dictionary/definition block glued to a trailing question', confidence: 'HIGH' }
  }
  // A declarative closed, then a capitalised wh-clause opened: two units joined by the segmenter.
  const glued = t.match(/^(.{25,}?[a-z"”][,.]?)\s+((?:What|Why|Who|When|Where|How)\b.*\?)$/)
  if (glued) {
    return { primaryClass: 'SEGMENTATION_ERROR', why: 'a declarative and a question joined into one unit', confidence: 'HIGH', strandedQuestion: glued[2] }
  }
  // An unbalanced double quote is the tell: quoted article text ran into a trailing question.
  // #4454 closes a long quotation with a single `"` and then adds ` virus OR ELECTION?`.
  if (t.length > 80 && ((t.match(/["”“]/g) ?? []).length % 2 === 1) && /["”]\s*\S[^"”]{0,40}\?$/.test(t)) {
    return { primaryClass: 'SEGMENTATION_ERROR', why: 'quoted material with an unbalanced quote mark, glued to a trailing question', confidence: 'HIGH' }
  }

  // ── code / arithmetic ─────────────────────────────────────────────────────
  if (CODEY.test(t)) {
    return { primaryClass: 'NEEDS_CONTEXT', why: 'no letters — a comms code or arithmetic token ("5:5?", "2 + 2 = 6?"); reads as a question in Q\'s idiom but cannot be certified from the unit alone', confidence: 'LOW' }
  }

  // ── directive wrapper containing a real embedded question ─────────────────
  for (const w of WRAPPERS) {
    const m = t.match(w.rx)
    if (!m) continue
    const start = m[1].length
    const embedded = t.slice(start)          // sliced by index — exact source, never rebuilt
    if (!interrogative(embedded)) {
      return { primaryClass: 'Q_DIRECTIVE_NO_QUESTION', why: `"${w.name}" wrapper but what follows is not interrogative`, confidence: 'MEDIUM' }
    }
    return {
      primaryClass: 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION',
      containsQuestion: true,
      embeddedQuestion: embedded,
      embeddedOffset: start,
      countsTowardQQuestionTotal: true,
      why: `"${w.name}" directive wrapping an interrogative — Q issues an instruction and asks a question in the same unit`,
      confidence: 'HIGH',
    }
  }

  // ── plain questions ───────────────────────────────────────────────────────
  if (AUX_INVERSION.test(t) || NEG_INVERSION.test(t)) {
    return { primaryClass: 'Q_QUESTION', containsQuestion: true, countsTowardQQuestionTotal: true, why: 'auxiliary–subject inversion — a direct question', confidence: 'HIGH' }
  }
  if (/^q\s*:\s*/i.test(t)) {
    // A "Q:" line answered by an "A:" line is a quoted FAQ pair, not Q asking. #4122 is
    // verbatim from https://www.fbi.gov/about/faqs, the line directly above it.
    if (/^a\s*:\s/i.test(ctx.after ?? '') || /fbi\.gov|\/faqs?\b/i.test(ctx.before ?? '')) {
      return { primaryClass: 'NEEDS_CONTEXT', why: 'a "Q:"/"A:" pair quoted from an external FAQ (the preceding line is the source URL) — Q is pasting, not asking', confidence: 'HIGH' }
    }
    const body = t.replace(/^q\s*:\s*/i, '')
    return {
      primaryClass: 'Q_QUESTION', containsQuestion: true, countsTowardQQuestionTotal: true,
      embeddedQuestion: body, embeddedOffset: t.length - body.length,
      why: 'Q labels the line "Q:" — the label is formatting, the line is a question',
      confidence: 'MEDIUM',
    }
  }
  // "Remember Southwest?", "Look familiar?", "Remember when D's … pushed mass fear …?" — the
  // elided auxiliary is part of the question, so the WHOLE unit is the question. Splitting off
  // "when D's … pushed mass fear …?" would record a fragment that is not a question by itself.
  if (ELLIPTICAL.test(t)) {
    return { primaryClass: 'Q_QUESTION', containsQuestion: true, countsTowardQQuestionTotal: true, why: 'elided auxiliary — "[Do you] remember / think / look …?"; interrogative in Q\'s idiom', confidence: 'MEDIUM' }
  }
  if (WH_ANYWHERE.test(t) && /\?$/.test(t) && !imperativeMood(t).imperative) {
    return { primaryClass: 'Q_QUESTION', containsQuestion: true, countsTowardQQuestionTotal: true, why: 'contains a wh-clause and is not imperative — a question', confidence: 'HIGH' }
  }
  if (INFO_NOUN.test(t)) {
    return { primaryClass: 'Q_QUESTION', containsQuestion: true, countsTowardQQuestionTotal: true, why: 'noun phrase requesting information, marked as a question', confidence: 'MEDIUM' }
  }

  // ── imperative + "?" with nothing interrogative inside ────────────────────
  const mood = imperativeMood(t)
  if (mood.imperative || mood.undecidable) {
    return {
      primaryClass: 'NEEDS_CONTEXT',
      why: `imperative form carrying a question mark ("${t.split(/\s+/)[0]} …?") with no embedded interrogative — could be an incredulous question, a list item, or a label; the surrounding drop decides`,
      confidence: 'LOW',
    }
  }
  return { primaryClass: 'NEEDS_CONTEXT', why: 'ends with "?" but is neither interrogative in form nor imperative', confidence: 'LOW' }
}

// ── self-test ────────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases = [
    ['Ask yourself, why are they panicking?', 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION', 'why are they panicking?'],
    ['Ask yourself, why?', 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION', 'why?'],
    ['Ask yourself a very simple Q - why?', 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION', 'why?'],
    ['Ask yourself - is this normal?', 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION', 'is this normal?'],
    ['Ask yourself, do we want a WAR?', 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION', 'do we want a WAR?'],
    ['Think: re: why [no] arrests (justice) yet?', 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION', 'why [no] arrests (justice) yet?'],
    ['Have the puppet masters traveled to this island?', 'Q_QUESTION', null],
    ['HAVE YOU EVER WITNESSED A DEFCON SCARE?', 'Q_QUESTION', null],
    ['Have you IDEN other person?', 'Q_QUESTION', null],
    ["Don't you realize the war has gone public?", 'Q_QUESTION', null],
    ['Remember Southwest?', 'Q_QUESTION', null],
    ['Look familiar?', 'Q_QUESTION', null],
    ['Think Merkel is a coincidence?', 'Q_QUESTION', null],
    ['Name of FATHER?', 'Q_QUESTION', null],
    ['DEFEND MS-13?', 'NEEDS_CONTEXT', null],
    ['Hold people accountable?', 'NEEDS_CONTEXT', null],
    ['Check Gmail?', 'NEEDS_CONTEXT', null],
    ['5:5?', 'NEEDS_CONTEXT', null],
    ['2 + 2 = 6?', 'NEEDS_CONTEXT', null],
    ['C. attacked (hack-attempt)?', 'SEGMENTATION_ERROR', null],
    ['Department of Justice does not discuss ongoing investigations or confirm specific matters, What about the active investigation into leaks?', 'SEGMENTATION_ERROR', null],
  ]
  let bad = 0
  for (const [t, want, wantEmb] of cases) {
    const r = adjudicate(t)
    const okClass = r.primaryClass === want
    const okEmb = wantEmb === null || (r.embeddedQuestion ?? '').trim() === wantEmb
    if (!okClass || !okEmb) bad++
    console.log(`  ${okClass && okEmb ? 'ok  ' : 'FAIL'}  ${r.primaryClass.padEnd(36)}${JSON.stringify(t.slice(0, 44))}${r.embeddedQuestion ? `  →  ${JSON.stringify(r.embeddedQuestion.slice(0, 44))}` : ''}`)
  }
  console.log(bad ? `\n${bad} case(s) wrong\n` : '\nall cases correct\n')
  process.exit(bad ? 1 : 0)
}

// ── run over the 146 ─────────────────────────────────────────────────────────
const { uncovered } = JSON.parse(fs.readFileSync(path.join(OUT, 'uncovered-question-units.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const postByNum = new Map(posts.map(p => [p.postNum, p]))
const linesOf = new Map(posts.map(p => [p.postNum, clean(p.text ?? '').split('\n').map(l => l.trim()).filter(Boolean)]))

const records = uncovered.map(u => {
  const lines = linesOf.get(u.postNum) ?? []
  const i = lines.findIndex(l => key(l) === key(u.text) || key(l).includes(key(u.text)))
  const a = adjudicate(u.text, { before: i > 0 ? lines[i - 1] : null, after: i >= 0 ? lines[i + 1] ?? null : null })
  return {
    postNum: u.postNum,
    postId: postByNum.get(u.postNum)?.id ?? null,
    qSourceText: u.text,
    currentClassification: 'none — in neither the certified Questions set nor the directive set',
    primaryClass: a.primaryClass,
    containsQuestion: a.containsQuestion ?? false,
    embeddedQuestion: a.embeddedQuestion ?? null,
    embeddedOffset: a.embeddedOffset ?? null,
    strandedQuestion: a.strandedQuestion ?? null,
    countsTowardQQuestionTotal: a.countsTowardQQuestionTotal ?? false,
    reason: a.why,
    confidence: a.confidence,
    context: { before: i > 0 ? lines[i - 1] : null, after: i >= 0 ? lines[i + 1] ?? null : null },
  }
})

// Verify every embedded span is a genuine substring of its source.
const spanFail = records.filter(r => r.embeddedQuestion && !r.qSourceText.includes(r.embeddedQuestion))
if (spanFail.length) {
  console.error(`\nAborting: ${spanFail.length} embedded span(s) are not substrings of their source.`)
  for (const s of spanFail.slice(0, 5)) console.error(`  #${s.postNum} ${JSON.stringify(s.embeddedQuestion)}`)
  process.exit(1)
}

// ── revised totals ───────────────────────────────────────────────────────────
const certified = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8')).filter(q => !q.editorialNormalization)
const counting = records.filter(r => r.countsTowardQQuestionTotal)
const countedText = r => (r.embeddedQuestion ?? r.qSourceText).trim()

const baseOcc = certified.length
const addOcc = counting.length
const distinctKeys = new Set(certified.map(q => key(q.text)))
const beforeDistinct = distinctKeys.size
for (const r of counting) distinctKeys.add(key(countedText(r)))
const postsWith = new Set(certified.map(q => q.postNum))
const beforePosts = postsWith.size
for (const r of counting) postsWith.add(r.postNum)

const byClass = {}
for (const r of records) byClass[r.primaryClass] = (byClass[r.primaryClass] ?? 0) + 1
const wrapped = records.filter(r => r.primaryClass === 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION').length

const totals = {
  certifiedBefore: { occurrences: baseOcc, distinct: beforeDistinct, posts: beforePosts },
  adjudicatedAdditions: { occurrences: addOcc, directiveWrapped: wrapped, plainQuestions: counting.length - wrapped },
  revised: { occurrences: baseOcc + addOcc, distinct: distinctKeys.size, posts: postsWith.size },
  byClass,
  notCounted: records.length - addOcc,
}

fs.writeFileSync(path.join(OUT, 'questions-uncovered-adjudicated.json'), JSON.stringify({ scope: 'the 146 "?"-terminated units the frozen scorer dropped', frozenScorerChanged: false, productionChanged: false, totals, records }, null, 1))

// ── report ───────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = ['# Questions — narrow adjudication of the 146 uncovered `?` units\n']
md.push('Scope is these 146 units only. **The frozen scorer is unchanged, no production file is written, nothing is deployed.** Nothing was added merely because it contains `?`.\n')
md.push('\n## Why these were missing\n')
md.push('`scripts/audit-all-questions-v2.mjs:144` subtracts `0.6` for a leading imperative verb, a question mark adds `0.6`, and `THRESHOLD` is `0.5`. Any `?`-terminated unit opening with `ask, have, remember, think, defend, protect, note, look, hold, fight` scored exactly `0.0`. The question mark could not save it.\n')
md.push('\n## The model change\n')
md.push('A directive and a question are not mutually exclusive. The unit keeps one primary class; an embedded ask is captured separately rather than lost:\n')
md.push('```json\n{\n  "primaryClass": "Q_DIRECTIVE_WITH_EMBEDDED_QUESTION",\n  "containsQuestion": true,\n  "embeddedQuestion": "why are they panicking?",\n  "countsTowardQQuestionTotal": true\n}\n```\n')
md.push('Embedded spans are sliced out of the source string by index, never rebuilt, and every one is verified to be a literal substring of its unit.\n')
md.push('\n## Decisions\n')
md.push('| Class | Units | Counts toward the question total |')
md.push('|---|---|---|')
const countsFor = { Q_QUESTION: 'yes', Q_DIRECTIVE_WITH_EMBEDDED_QUESTION: 'yes — the embedded span', Q_DIRECTIVE_NO_QUESTION: 'no', Q_STATEMENT_OR_HEADING: 'no', SEGMENTATION_ERROR: 'no', NEEDS_CONTEXT: 'no — pending review' }
for (const [c, n] of Object.entries(byClass).sort((a, b) => b[1] - a[1])) md.push(`| ${c} | ${n} | ${countsFor[c] ?? ''} |`)
md.push('\n## Revised totals\n')
md.push('| Measure | Certified | Adjudicated additions | Revised |')
md.push('|---|---|---|---|')
md.push(`| Question occurrences | ${baseOcc.toLocaleString()} | +${addOcc} | **${(baseOcc + addOcc).toLocaleString()}** |`)
md.push(`| Distinct normalised questions | ${beforeDistinct.toLocaleString()} | +${distinctKeys.size - beforeDistinct} | **${distinctKeys.size.toLocaleString()}** |`)
md.push(`| Posts containing questions | ${beforePosts.toLocaleString()} | +${postsWith.size - beforePosts} | **${postsWith.size.toLocaleString()}** |`)
md.push(`| Directive-wrapped questions | 0 | +${wrapped} | **${wrapped}** |`)
md.push(`\n${totals.notCounted} of the 146 do **not** count: segmentation errors, and imperative-plus-\`?\` units held at NEEDS_CONTEXT.\n`)
for (const cls of ['Q_DIRECTIVE_WITH_EMBEDDED_QUESTION', 'Q_QUESTION', 'NEEDS_CONTEXT', 'SEGMENTATION_ERROR', 'Q_DIRECTIVE_NO_QUESTION', 'Q_STATEMENT_OR_HEADING']) {
  const list = records.filter(r => r.primaryClass === cls)
  if (!list.length) continue
  md.push(`\n## ${cls} (${list.length})\n`)
  md.push('| Post | Q source text (exact) | Embedded question (exact span) | Counts | Conf | Reason | Before | After |')
  md.push('|---|---|---|---|---|---|---|---|')
  for (const r of list) {
    md.push(`| #${r.postNum} | \`${esc(r.qSourceText).slice(0, 100)}\` | ${r.embeddedQuestion ? `\`${esc(r.embeddedQuestion).slice(0, 70)}\`` : '—'} | ${r.countsTowardQQuestionTotal ? 'yes' : 'no'} | ${r.confidence} | ${esc(r.reason).slice(0, 70)} | \`${esc(r.context.before).slice(0, 26)}\` | \`${esc(r.context.after).slice(0, 26)}\` |`)
  }
}
md.push('\n## Held for your decision\n')
md.push('- **NEEDS_CONTEXT, imperative + `?`** — `DEFEND MS-13?`, `Hold people accountable?`, `Protect truth re: Hillary/DNC Russia collusion?`, `Check Gmail?`, `Use BAIT?`, `Rally POTUS v BIDEN attendance?`. Each reads as an incredulous rhetorical question inside a list, but the unit alone cannot settle it. Context columns are provided.')
md.push('- **NEEDS_CONTEXT, code tokens** — `5:5?` (18 occurrences), `1=1?`, `2 + 2 = 6?`, `2019?`, `20-25?`. `5:5?` is a genuine radio-idiom question ("do you read me five by five?"), but it carries no letters and certifying it from the unit alone would be a guess.')
md.push('- **`Q:`/`A:` FAQ pairs** — #4122 is quoted verbatim from `https://www.fbi.gov/about/faqs`, the line directly above it, and is answered by an `A:` line below. Detected by rule and held at `NEEDS_CONTEXT`: Q is pasting someone else\'s Q&A, not asking. The three `Q: can we prove …?` lines in #4477 have no `A:` reply and no source URL, so they stand as Q\'s own.')
md.push('- **Segmentation errors carrying a real question** — #1318 strands `What about the active investigation into leaks?` after a declarative. Recorded in `strandedQuestion`, not counted, because the unit boundary is wrong rather than the classification.')
fs.writeFileSync(path.join(OUT, 'questions-uncovered-adjudicated.md'), md.join('\n') + '\n')

console.log('\nUNCOVERED "?" UNITS — NARROW ADJUDICATION\n')
for (const [c, n] of Object.entries(byClass).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${c}`)
console.log(`\n  embedded spans verified as exact substrings: ${records.filter(r => r.embeddedQuestion).length}/${records.filter(r => r.embeddedQuestion).length}`)
console.log('\n  REVISED TOTALS')
console.log(`    occurrences : ${baseOcc.toLocaleString()}  →  ${(baseOcc + addOcc).toLocaleString()}   (+${addOcc})`)
console.log(`    distinct    : ${beforeDistinct.toLocaleString()}  →  ${distinctKeys.size.toLocaleString()}   (+${distinctKeys.size - beforeDistinct})`)
console.log(`    posts       : ${beforePosts.toLocaleString()}  →  ${postsWith.size.toLocaleString()}   (+${postsWith.size - beforePosts})`)
console.log(`    directive-wrapped questions : ${wrapped}`)
console.log('\n→ audit/questions-uncovered-adjudicated.md\n')
