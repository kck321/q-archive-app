// All-questions auditor, v2 — built to GPT's review of v1.
//
// AUDIT ONLY. Writes to audit/ and touches nothing the app reads. The reclassification hold
// stands.
//
// What changed from v1, and why:
//
// 1. FIRST TOKEN IS NOT A CLASSIFIER. v1 treated any line opening with have/will/may/must/
//    when as a question, which proposed "Have faith.", "Will of the people.",
//    "Where we go one, we go ALL." and "When you are divided, you are weak." That rule is
//    replaced by scored syntax: an auxiliary or interrogative counts only with INVERSION
//    (wh + auxiliary, or auxiliary + subject) or corroboration.
//
// 2. THE CORPUS ARBITRATES. Q writes the same line as "Define stages?" and "Define stages."
//    So a unit with no "?" is corroborated when the identical text appears WITH one
//    somewhere in the archive. That is evidence from Q's own usage rather than a guess.
//
// 3. THREE CONFIDENCES, NOT ONE. question_mark_present (evidence),
//    semantic_question_score (grammar/usage), segmentation_confidence (how sure we are of
//    the unit's boundaries) are recorded separately, so a "?" no longer forces HIGH.
//
// 4. CROSS-LINE RECONSTRUCTION. A newline does not always end a thought. An incomplete line
//    is joined to the next, with the original line span kept on the record.
//
// 5. THE STORED-BUT-NOT-DERIVED GROUP IS SPLIT. Present-verbatim (a segmentation
//    disagreement, must not be deleted) is separated from not-present-at-all (the extractor
//    wrote it) — only the latter is a removal candidate.
//
//   node scripts/audit-all-questions-v2.mjs [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8'))

const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const ENTITIES = [[/&amp;/gi, '&'], [/&nbsp;/gi, ' '], [/&quot;/gi, '"'], [/&#0?39;|&apos;/gi, "'"], [/&lt;/gi, '<'], [/&gt;/gi, '>']]
const clean = t => { let o = (t ?? '').replace(MARKUP, ''); for (const [r, c] of ENTITIES) o = o.replace(r, c); return o }
const key = t => clean(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

// ── lexicons ─────────────────────────────────────────────────────────────────
const WH = 'who|what|when|where|why|how|which|whose|whom'
const AUX = 'is|are|was|were|am|do|does|did|can|could|should|would|will|shall|have|has|had|may|might|must'
// wh + auxiliary = interrogative inversion. "Why did HRC lose." qualifies; "Where we go one"
// does not, because "we" is a subject continuing a relative clause.
const WH_INVERSION = new RegExp(`^(${WH})\\s+(${AUX})\\b`, 'i')
const WH_LEAD = new RegExp(`^(${WH})\\b`, 'i')
// auxiliary + subject. Requires a pronoun, determiner or proper noun to follow — "Have
// faith." and "Will become relevant." fail because a bare noun or verb follows.
const AUX_INVERSION = new RegExp(`^(${AUX})\\s+(i|you|we|they|he|she|it|there|the|this|that|these|those|any|all|[A-Z][a-z]+)\\b`)
// Imperatives that request INFORMATION — questions in the agreed model.
const ASKS_INFO = /^(define|list|identify|explain|compare|reconcile|clarify|describe)\b/i
// "name" is both a verb and a noun, and Q uses both. Unconditionally treating it as an
// information request swept up "Name worth remembering." and "Name can be found due to
// filing." It now qualifies only when an OBJECT follows the imperative…
const NAME_REQUEST = /^name\s+(the|all|every|each|any|both|those|these|his|her|their|our|its|top|\d+)\b/i
// …and is rejected outright where "Name" is the SUBJECT: followed by an auxiliary
// ("Name can be found"), a pronoun ("Name we don't say") or a preposition.
const NAME_AS_NOUN = /^name\s+(is|are|was|were|can|could|will|would|shall|should|may|might|must|has|have|had|we|you|they|i|he|she|it|worth|of|for|in|on|to)\b/i
// Imperatives that request ACTION — directives.
const DIRECTIVE = /^(follow|think|read|watch|listen|dig|expand|learn|study|trust|pray|share|meme|archive|save|review|refer|apply|remember|consider|look|note|track|search|find|ask|keep|stay|protect|defend|prepare|organize|spread|rally|stand|fight|hold|use|check|verify|confirm|understand|be|have|let|do not|don't|never|always)\b/i
const SIGNATURE = /^(q|q\+|wwg1wga|ncswic|where we go one,? we go all)\b/i
const CODEY = /^[\W\d_]+$/
const BRACKET_ONLY = /^\[[^\]]*\]$/

// ── corroboration: the same text asked WITH a question mark somewhere ─────────
const askedWithMark = new Set()
for (const p of posts) {
  for (const raw of clean(p.text ?? '').split('\n')) {
    for (const seg of raw.split(/(?<=[?!.])\s+/)) {
      const t = seg.trim()
      if (t.endsWith('?')) askedWithMark.add(key(t))
    }
  }
}
for (const q of questions) if ((q.text ?? '').trim().endsWith('?')) askedWithMark.add(key(q.text))

// ── segmentation with cross-line reconstruction ──────────────────────────────
const CONTINUES = /[,;:]$|\b(and|or|but|of|to|in|on|for|with|from|the|a|an|that|which|while|when|if|by|as)$/i

function unitsFor(text) {
  const lines = clean(text).split('\n').map(l => l.trim())
  const out = []
  let i = 0
  while (i < lines.length) {
    let line = lines[i]
    const startLine = i
    if (!line) { i++; continue }
    if (/^>>\d+/.test(line)) { i++; continue }   // not Q-authored

    // Join a syntactically incomplete line to what follows. Conservative: at most two
    // joins, and only when the next line continues rather than starting a new thought.
    let joins = 0
    let segConfidence = 'HIGH'
    while (joins < 2 && i + 1 < lines.length) {
      const next = lines[i + 1]
      if (!next || /^>>\d+/.test(next)) break
      const incomplete = !/[?.!:…]$/.test(line) && (CONTINUES.test(line) || /^[a-z]/.test(next))
      if (!incomplete) break
      line = `${line} ${next}`
      i++
      joins++
      segConfidence = 'MEDIUM'   // a reconstruction is less certain than a clean line
    }

    // Split within the line only where a terminator is followed by whitespace and a new
    // sentence start — so "twitter.com", "9.11" and "U.S." survive intact.
    const parts = []
    const rx = /([?!.])(\s+)(?=[A-Z(“"']|\d)/g
    let last = 0, m
    while ((m = rx.exec(line)) !== null) { parts.push(line.slice(last, m.index + 1)); last = m.index + m[0].length }
    parts.push(line.slice(last))

    for (const part of parts.map(s => s.trim()).filter(Boolean)) {
      out.push({ text: part, startLine, endLine: i, segConfidence: parts.length > 1 && segConfidence === 'HIGH' ? 'MEDIUM' : segConfidence })
    }
    i++
  }
  return out
}

// ── scoring ──────────────────────────────────────────────────────────────────
function score(unit) {
  const t = unit.trim()
  const k = key(t)
  const qMark = /\?$/.test(t)
  const signals = []
  let s = 0

  if (SIGNATURE.test(t.replace(/[.!?]+$/, ''))) return { s: 0, qMark, signals: ['signature'], nonAnalytic: true }
  if (BRACKET_ONLY.test(t) || CODEY.test(t)) return { s: 0, qMark, signals: ['code/bracket'], nonAnalytic: true }
  if (/^https?:\/\//i.test(t)) return { s: 0, qMark, signals: ['url'], nonAnalytic: true }

  if (qMark) { s += 0.6; signals.push('question mark') }
  if (WH_INVERSION.test(t)) { s += 0.5; signals.push('wh + auxiliary inversion') }
  else if (WH_LEAD.test(t)) { s += 0.1; signals.push('wh lead, no inversion') }
  if (AUX_INVERSION.test(t)) { s += 0.25; signals.push('auxiliary + subject') }
  const asksInfo = ASKS_INFO.test(t) || (NAME_REQUEST.test(t) && !NAME_AS_NOUN.test(t))
  if (asksInfo) { s += 0.5; signals.push('requests information') }
  if (!qMark && askedWithMark.has(k)) { s += 0.35; signals.push('asked with "?" elsewhere in the corpus') }
  if (DIRECTIVE.test(t) && !asksInfo) { s -= 0.6; signals.push('imperative action verb') }

  return { s: Math.max(0, Math.min(1, s)), qMark, signals, nonAnalytic: false }
}

// A unit ending on an abbreviation or a lone initial is almost certainly a sentence cut in
// half — "Why was the U.S.", "Why would H." — not a question Q asked. These stay in
// adjudication and may never enter production automatically, whatever they score.
const SEGMENTATION_RISK = /(?:\b(?:[A-Z]\.){2,}|\b[A-Z]\.|\b(?:Adm|Gen|Sen|Rep|Dr|Mr|Mrs|Ms|St|Jr|Sr|vs|v|No|Inc|Co|Corp|Dept|Est|approx|etc|al)\.)\s*$/i

const THRESHOLD = 0.5

// A "Define X." is imperative in FORM but seeks an answer in FUNCTION. Recording both keeps
// it in the Q Questions family without pretending it is syntactically interrogative — and it
// is what will separate "Define the connection." from "Follow the money." when Q Directives
// is built.
function formAndFunction(t) {
  const asksInfo = ASKS_INFO.test(t) || (NAME_REQUEST.test(t) && !NAME_AS_NOUN.test(t))
  if (asksInfo) return { grammaticalForm: 'imperative', semanticFunction: 'information_request' }
  if (/\?$/.test(t) || WH_INVERSION.test(t) || AUX_INVERSION.test(t)) {
    return { grammaticalForm: 'interrogative', semanticFunction: 'question' }
  }
  return { grammaticalForm: 'declarative', semanticFunction: 'question' }
}

function subtypeOf(t) {
  const m = t.match(WH_LEAD)
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()
  if (new RegExp(`^(${AUX})\\b`, 'i').test(t)) return 'Yes/No'
  if (ASKS_INFO.test(t)) return 'Information request'
  return t.split(/\s+/).length <= 3 ? 'Elliptical' : 'Other'
}

// ── self-test on GPT's examples ──────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const mustNot = ['Have faith.', 'Will of the people.', 'Will become relevant.', 'Where we go one, we go ALL.',
    'When you are divided, you are weak.', 'May God bless you...', 'Must end now!', 'Follow the money.', 'Think logically.',
    // v2.1 — "name" as a noun rather than an imperative verb
    'Name worth remembering.', 'Name can be found due to filing.', "Name we don't say AZ road block."]
  const must = ['Coincidence?', 'Why did HRC lose.', "Define 'State Secrets'.", 'List the estimated wealth of religious organizations.',
    'Reconcile.', 'Clarify.', 'Is Flynn safe?', 'Who is Q?',
    // v2.1 — "name" as a genuine information request
    'Name the person.', 'Name all individuals involved.']
  let bad = 0
  console.log('\nMUST NOT be questions:')
  for (const t of mustNot) {
    const r = score(t)
    const isQ = !r.nonAnalytic && r.s >= THRESHOLD
    if (isQ) bad++
    console.log(`  ${isQ ? 'FAIL' : 'ok  '}  ${r.s.toFixed(2)}  ${JSON.stringify(t)}  [${r.signals.join(', ')}]`)
  }
  console.log('\nMUST be questions:')
  for (const t of must) {
    const r = score(t)
    const isQ = !r.nonAnalytic && r.s >= THRESHOLD
    if (!isQ) bad++
    console.log(`  ${isQ ? 'ok  ' : 'FAIL'}  ${r.s.toFixed(2)}  ${JSON.stringify(t)}  [${r.signals.join(', ')}]`)
  }
  console.log(bad ? `\n${bad} case(s) wrong\n` : '\nall cases correct\n')
  process.exit(bad ? 1 : 0)
}

// ── stored questions ─────────────────────────────────────────────────────────
const storedByPost = new Map()
for (const q of questions) {
  if (!q?.postId) continue
  if (!storedByPost.has(q.postId)) storedByPost.set(q.postId, new Map())
  storedByPost.get(q.postId).set(key(q.text), q.text)
}

// ── the pass ─────────────────────────────────────────────────────────────────
const records = []
const adjudication = []
const totals = {
  posts: posts.length, postsWithQuestions: 0, questionUnits: 0, distinct: 0,
  confirmed: 0, missed: 0,
  storedPresentSegDiff: 0, storedNotPresent: 0,
  anonExcluded: 0, segmentationRisk: 0,
  byScoreBand: { 'certain (>=0.85)': 0, 'likely (0.6-0.85)': 0, 'borderline (0.5-0.6)': 0 },
  bySubtype: {}, byTerminal: {},
}
const distinct = new Set()

for (const p of posts) {
  const stored = storedByPost.get(p.id) ?? new Map()
  const lines = clean(p.text ?? '').split('\n').map(l => l.trim())
  const derived = new Set()
  let inThisPost = 0

  for (const u of unitsFor(p.text ?? '')) {
    const r = score(u.text)
    const k = key(u.text)
    if (!k) continue
    const isQuestion = !r.nonAnalytic && r.s >= THRESHOLD
    if (!isQuestion) continue
    if (derived.has(k)) continue
    derived.add(k)

    const band = r.s >= 0.85 ? 'certain (>=0.85)' : r.s >= 0.6 ? 'likely (0.6-0.85)' : 'borderline (0.5-0.6)'
    const sub = subtypeOf(u.text)
    const term = /[?.!:…]$/.test(u.text) ? u.text.slice(-1) : '(none)'
    const isStored = stored.has(k)

    totals.questionUnits++; inThisPost++
    totals.byScoreBand[band]++
    totals.bySubtype[sub] = (totals.bySubtype[sub] ?? 0) + 1
    totals.byTerminal[term] = (totals.byTerminal[term] ?? 0) + 1
    distinct.add(k)
    if (isStored) totals.confirmed++; else totals.missed++

    const risky = SEGMENTATION_RISK.test(u.text)
    if (risky) totals.segmentationRisk++
    const ff = formAndFunction(u.text)

    const rec = {
      postNum: p.postNum, postId: p.id,
      sourceText: u.text,
      grammaticalForm: ff.grammaticalForm,
      semanticFunction: ff.semanticFunction,
      segmentationRisk: risky,
      autoAddEligible: !risky && r.s >= 0.85 && u.segConfidence === 'HIGH',
      sourceLines: [u.startLine, u.endLine],
      reconstructed: u.endLine > u.startLine,
      questionMarkPresent: r.qMark,
      semanticQuestionScore: Number(r.s.toFixed(2)),
      segmentationConfidence: u.segConfidence,
      subtype: sub, terminal: term,
      signals: r.signals,
      status: isStored ? 'CONFIRMED' : 'MISSED',
      storedValue: isStored ? stored.get(k) : null,
    }
    records.push(rec)

    // Adjudication queue: anything not plainly certain.
    if (r.s < 0.85 || u.segConfidence !== 'HIGH' || !isStored || risky) {
      adjudication.push({
        ...rec,
        neighbours: {
          before: lines[u.startLine - 1] ?? null,
          after: lines[u.endLine + 1] ?? null,
        },
      })
    }
  }
  if (inThisPost) totals.postsWithQuestions++

  // Stored rows this pass did not derive — split into the two classes GPT asked for.
  const body = ` ${key(p.text ?? '')} `
  for (const [k, original] of stored) {
    if (derived.has(k)) continue
    const presentVerbatim = k && body.includes(` ${k} `)
    if (presentVerbatim) totals.storedPresentSegDiff++; else totals.storedNotPresent++
    adjudication.push({
      postNum: p.postNum, postId: p.id,
      sourceText: original, sourceLines: null, reconstructed: false,
      questionMarkPresent: /\?$/.test(original.trim()),
      semanticQuestionScore: null, segmentationConfidence: null,
      subtype: null, terminal: null,
      signals: [presentVerbatim ? 'stored text present verbatim — segmentation difference' : 'stored text NOT present in Q source'],
      status: presentVerbatim ? 'STORED_PRESENT_SEGMENTATION_DIFF' : 'STORED_NOT_PRESENT_IN_Q_SOURCE',
      storedValue: original,
      neighbours: null,
    })
  }

  for (const q of p.quotedPosts ?? []) {
    for (const l of clean(q.text ?? '').split('\n')) if (l.trim().endsWith('?')) totals.anonExcluded++
  }
}
totals.distinct = distinct.size

// ── output ───────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'questions-audit-v2.json'), JSON.stringify({ totals, records }, null, 1))
fs.writeFileSync(path.join(OUT, 'questions-adjudication.json'), JSON.stringify(adjudication, null, 1))

const pct = (n, d) => d ? `${(n / d * 100).toFixed(1)}%` : '—'
const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = []
md.push('# Q Drops — all-questions audit v2\n')
md.push('`scripts/audit-all-questions-v2.mjs`. Audit only; no app data changed; hold in place.\n')
md.push('\n## Totals\n')
md.push('| Measure | v1 | v2 |')
md.push('|---|---|---|')
md.push(`| Q-authored question units | 6,815 | **${totals.questionUnits.toLocaleString()}** |`)
md.push(`| Distinct questions | 5,564 | **${totals.distinct.toLocaleString()}** |`)
md.push(`| Posts with >=1 question | 1,836 | ${totals.postsWithQuestions.toLocaleString()} (${pct(totals.postsWithQuestions, totals.posts)}) |`)
md.push(`| Confirmed against questions.json | 6,524 | ${totals.confirmed.toLocaleString()} |`)
md.push(`| Missed (in text, not stored) | 291 | ${totals.missed.toLocaleString()} |`)
md.push(`| Stored, present verbatim (do NOT delete) | 1,181 | ${totals.storedPresentSegDiff.toLocaleString()} |`)
md.push(`| Stored, NOT in Q source (removal candidates) | 144 | ${totals.storedNotPresent.toLocaleString()} |`)
md.push(`| Anon/quoted questions excluded | 2,144 | ${totals.anonExcluded.toLocaleString()} |`)
md.push(`| Segmentation-risk units (never auto-added) | — | ${totals.segmentationRisk.toLocaleString()} |`)
md.push('\n## Semantic score bands\n')
md.push('| Band | Count | Share |')
md.push('|---|---|---|')
for (const [b, n] of Object.entries(totals.byScoreBand)) md.push(`| ${b} | ${n.toLocaleString()} | ${pct(n, totals.questionUnits)} |`)
md.push('\n## Terminal punctuation\n')
md.push('| Ends with | Count | Share |')
md.push('|---|---|---|')
for (const [t, n] of Object.entries(totals.byTerminal).sort((a, b) => b[1] - a[1])) md.push(`| \`${t}\` | ${n.toLocaleString()} | ${pct(n, totals.questionUnits)} |`)
md.push('\n## Subtype\n')
md.push('| Subtype | Count |')
md.push('|---|---|')
for (const [t, n] of Object.entries(totals.bySubtype).sort((a, b) => b[1] - a[1])) md.push(`| ${t} | ${n.toLocaleString()} |`)

const missedList = records.filter(r => r.status === 'MISSED')
md.push(`\n## Missed — in Q's text, absent from questions.json (${missedList.length.toLocaleString()})\n`)
md.push('| Post | Source text (exact) | Score | Signals |')
md.push('|---|---|---|---|')
for (const r of missedList.slice(0, 250)) md.push(`| #${r.postNum} | \`${esc(r.sourceText).slice(0, 100)}\` | ${r.semanticQuestionScore} | ${esc(r.signals.join(', '))} |`)
if (missedList.length > 250) md.push(`\n_…and ${(missedList.length - 250).toLocaleString()} more in the JSON._`)

md.push('\n## Method\n')
md.push('- **First token is not a classifier.** An auxiliary or interrogative only scores with inversion (`wh + auxiliary`, or `auxiliary + subject`) — so `Have faith.`, `Will of the people.`, `Where we go one, we go ALL.` and `When you are divided, you are weak.` score below threshold.')
md.push('- **The corpus arbitrates.** A unit with no `?` gains confidence when the identical text is asked WITH one elsewhere in the archive. That is Q\'s own usage, not a guess.')
md.push('- **Three confidences.** `questionMarkPresent` (evidence), `semanticQuestionScore` (grammar + usage), `segmentationConfidence` (unit boundaries) are separate fields; a `?` no longer forces certainty.')
md.push('- **Cross-line reconstruction.** An incomplete line is joined to the next (max two joins); `sourceLines` records the original span and `reconstructed` flags it.')
md.push('- **Information requests are questions; action directives are not.** `Define X.` / `List X.` / `Reconcile.` score as questions; `Follow` / `Read` / `Think` / `Have faith` do not.')
md.push(`- Threshold: **${THRESHOLD}**. Everything below it is excluded, and everything not plainly certain goes to the adjudication file.`)

fs.writeFileSync(path.join(OUT, 'questions-audit-v2.md'), md.join('\n') + '\n')

// Adjudication markdown — the smaller reviewable file.
const aj = []
aj.push('# Q Drops — adjudication queue (v2)\n')
aj.push('Only cases needing a human decision. Source text is exact; nothing here has been applied.\n')
const groups = {
  STORED_NOT_PRESENT_IN_Q_SOURCE: 'Stored but NOT in Q\'s text — removal candidates',
  MISSED: 'Not stored — candidate additions',
  STORED_PRESENT_SEGMENTATION_DIFF: 'Stored and present verbatim — segmentation disagreement, do NOT delete',
  CONFIRMED: 'Confirmed but below certainty, or reconstructed across lines',
}
for (const [status, title] of Object.entries(groups)) {
  const list = adjudication.filter(r => r.status === status)
  aj.push(`\n## ${title} (${list.length.toLocaleString()})\n`)
  aj.push('| Post | Source text (exact) | Reconstructed | Score | Seg | Stored value | Signals | Before | After |')
  aj.push('|---|---|---|---|---|---|---|---|---|')
  for (const r of list.slice(0, 400)) {
    aj.push(`| #${r.postNum} | \`${esc(r.sourceText).slice(0, 90)}\` | ${r.reconstructed ? 'yes' : ''} | ${r.semanticQuestionScore ?? ''} | ${r.segmentationConfidence ?? ''} | \`${esc(r.storedValue).slice(0, 60)}\` | ${esc(r.signals.join(', ')).slice(0, 70)} | \`${esc(r.neighbours?.before).slice(0, 40)}\` | \`${esc(r.neighbours?.after).slice(0, 40)}\` |`)
  }
  if (list.length > 400) aj.push(`\n_…and ${(list.length - 400).toLocaleString()} more in questions-adjudication.json._`)
}
fs.writeFileSync(path.join(OUT, 'questions-adjudication.md'), aj.join('\n') + '\n')

console.log(`\nv2 question units      : ${totals.questionUnits.toLocaleString()}   (v1: 6,815)`)
console.log(`v2 distinct            : ${totals.distinct.toLocaleString()}   (v1: 5,564)`)
console.log(`confirmed / missed     : ${totals.confirmed.toLocaleString()} / ${totals.missed.toLocaleString()}   (v1 missed: 291)`)
console.log(`stored present verbatim: ${totals.storedPresentSegDiff.toLocaleString()}  (do NOT delete)`)
console.log(`stored NOT in source   : ${totals.storedNotPresent.toLocaleString()}  (removal candidates)`)
console.log(`adjudication queue     : ${adjudication.length.toLocaleString()}`)
console.log('\n→ audit/questions-audit-v2.md')
console.log('→ audit/questions-adjudication.md')
