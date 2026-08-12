// Full question audit across all 4,966 Q posts.
//
// Built to the REVIEW_HANDOFF.md specification. It AUDITS ONLY — it writes a report and
// changes nothing the app reads. Reclassification stays on hold.
//
// What it does, per the spec:
//   1. segments Q-authored text into complete semantic units, preserving exact source text
//   2. identifies interrogative meaning without relying on "?"
//   3. excludes quoted/anon text from Q's own totals
//   4. flags false positives sitting in questions.json
//   5. catches questions ending in . ! : or nothing
//   6. emits every question with post number, exact text and classification metadata
//   7. produces totals plus an exception list for manual review
//
// Guardrails honoured: the source text is never rewritten; punctuation is evidence, not the
// classifier; authorship is kept separate; ambiguous units get LOW/MEDIUM confidence and go
// to manual review rather than being silently decided.
//
//   node scripts/audit-all-questions.mjs
//   → audit/questions-audit.json   (machine readable, every unit)
//   → audit/questions-audit.md     (report + exception list)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8'))

// ── source hygiene ───────────────────────────────────────────────────────────
// The bundle carries the board's own markup and raw HTML entities. The app strips these at
// load, so the audit must see the same text the reader does. The ORIGINAL string is kept on
// every record — cleaning is for matching only, never for the reported source text.
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const ENTITIES = [[/&amp;/gi, '&'], [/&nbsp;/gi, ' '], [/&quot;/gi, '"'], [/&#0?39;|&apos;/gi, "'"], [/&lt;/gi, '<'], [/&gt;/gi, '>']]
const clean = t => { let o = (t ?? '').replace(MARKUP, ''); for (const [r, c] of ENTITIES) o = o.replace(r, c); return o }
const key = t => clean(t).toLowerCase().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '').trim()

// ── lexicons ─────────────────────────────────────────────────────────────────
const INTERROGATIVE = /^(who|what|when|where|why|how|which|whose|whom)\b/i
const AUXILIARY = /^(is|are|was|were|do|does|did|can|could|should|would|will|shall|have|has|had|may|might|must)\b/i
// "Define 'State Secrets'." is a Question in the agreed model: it asks for information.
const ASKS_FOR_INFO = /^(define|name|identify|explain|compare|reconcile|list|count|describe|clarify)\b/i
// "Follow the money." tells you to act. Same imperative shape, different act.
const DIRECTIVE = /^(follow|think|read|watch|listen|dig|expand|learn|study|trust|pray|share|meme|archive|save|review|refer|apply|remember|consider|look|note|track|search|find|ask|keep|stay|protect|defend|prepare|organize|spread|rally|stand|fight|hold|use|check|verify|confirm|understand|be)\b/i
const SIGNATURE = /^(q|q\+|wwg1wga[!.]*|ncswic|#?wwg1wga)$/i
const CODEY = /^[\W\d_]+$/                        // separators, +++, ……, numeric strings
const BRACKET_ONLY = /^\[[^\]]*\]$/

// ── segmentation ─────────────────────────────────────────────────────────────
// Q writes one thought per line, so the line is the primary unit. Lines are then split on
// sentence terminators, but ONLY where the terminator is followed by whitespace and a new
// capital or an interrogative — that avoids splitting "twitter.com", "9.11" or "U.S." while
// still separating "Was Comey forced into the spotlight? Right before the election no doubt?"
function segment(line) {
  const parts = []
  const rx = /([?!.])(\s+)(?=[A-Z(“"']|\d)/g
  let last = 0, m
  while ((m = rx.exec(line)) !== null) {
    parts.push(line.slice(last, m.index + 1))
    last = m.index + m[0].length
  }
  parts.push(line.slice(last))
  return parts.map(s => s.trim()).filter(Boolean)
}

// ── classification ───────────────────────────────────────────────────────────
function classify(unit) {
  const t = unit.trim()
  const terminal = /[?.!:…]$/.test(t) ? t.slice(-1) : ''
  const words = t.split(/\s+/).filter(Boolean)

  if (SIGNATURE.test(t.replace(/[.!]+$/, ''))) return { primary: 'NON_ANALYTIC', reason: 'signature', confidence: 'HIGH' }
  if (BRACKET_ONLY.test(t)) return { primary: 'NON_ANALYTIC', reason: 'bracket token', confidence: 'HIGH' }
  if (CODEY.test(t)) return { primary: 'NON_ANALYTIC', reason: 'code/separator', confidence: 'HIGH' }
  if (/^https?:\/\//i.test(t)) return { primary: 'EVIDENCE_REFERENCE', reason: 'url', confidence: 'HIGH' }

  const leadsInterrogative = INTERROGATIVE.test(t)
  const leadsAuxiliary = AUXILIARY.test(t)
  const asksForInfo = ASKS_FOR_INFO.test(t)
  const isDirective = DIRECTIVE.test(t)

  // 1. Explicit question mark — highest confidence regardless of shape.
  if (terminal === '?') {
    const sub = subtype(t, leadsInterrogative, leadsAuxiliary, words)
    return { primary: 'QUESTION', subtype: sub, reason: 'terminal "?"', confidence: 'HIGH' }
  }

  // 2. Interrogative or auxiliary lead without "?" — the case punctuation-only rules miss.
  if (leadsInterrogative || leadsAuxiliary) {
    return {
      primary: 'QUESTION',
      subtype: subtype(t, leadsInterrogative, leadsAuxiliary, words),
      reason: terminal ? `interrogative lead, ends "${terminal}"` : 'interrogative lead, no terminal punctuation',
      confidence: terminal === '.' || terminal === '!' ? 'MEDIUM' : 'LOW',
    }
  }

  // 3. Asks for information in imperative form ("Define 'State Secrets'.")
  if (asksForInfo) {
    return { primary: 'QUESTION', subtype: 'Other', reason: 'asks for information', confidence: 'MEDIUM' }
  }

  if (isDirective) return { primary: 'DIRECTIVE', reason: 'imperative verb', confidence: terminal ? 'HIGH' : 'MEDIUM' }

  // 4. Elliptical: a bare noun phrase used as a prompt is only a question with "?", which
  //    case 1 already caught. Without it, this is a statement.
  if (terminal === ':') return { primary: 'NON_ANALYTIC', reason: 'heading', confidence: 'MEDIUM' }
  if (terminal === '…') return { primary: 'NON_ANALYTIC', reason: 'trailing ellipsis', confidence: 'LOW' }

  return { primary: 'STATEMENT', reason: 'declarative', confidence: words.length <= 2 ? 'LOW' : 'MEDIUM' }
}

function subtype(t, leadsInterrogative, leadsAuxiliary, words) {
  if (leadsInterrogative) {
    const w = t.split(/\s+/)[0].toLowerCase().replace(/\W/g, '')
    return w.charAt(0).toUpperCase() + w.slice(1)
  }
  if (leadsAuxiliary) return 'Yes/No'
  if (words.length <= 3) return 'Elliptical'
  return 'Other'
}

// ── stored questions, for the comparison ─────────────────────────────────────
const storedByPost = new Map()
for (const q of questions) {
  if (!q?.postId) continue
  if (!storedByPost.has(q.postId)) storedByPost.set(q.postId, new Map())
  storedByPost.get(q.postId).set(key(q.text), q.text)
}

// ── the pass ─────────────────────────────────────────────────────────────────
const records = []
const totals = {
  posts: posts.length, postsWithQuestions: 0,
  questionUnits: 0, distinctQuestions: 0,
  confirmed: 0, missed: 0, falsePositives: 0,
  byConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0 },
  bySubtype: {}, byTerminal: {},
  anonQuestionsExcluded: 0,
}
const distinct = new Set()

for (const p of posts) {
  const stored = storedByPost.get(p.id) ?? new Map()
  const seen = new Set()
  let inThisPost = 0

  for (const rawLine of clean(p.text ?? '').split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    // Authorship: a ">>NNNNNNN" pointer and everything in quotedPosts is someone else's.
    if (/^>>\d+/.test(line)) continue

    for (const unit of segment(line)) {
      const cls = classify(unit)
      if (cls.primary !== 'QUESTION') continue

      const k = key(unit)
      if (!k || seen.has(k)) continue
      seen.add(k)

      const isStored = stored.has(k)
      totals.questionUnits++
      totals.byConfidence[cls.confidence]++
      totals.bySubtype[cls.subtype ?? 'Other'] = (totals.bySubtype[cls.subtype ?? 'Other'] ?? 0) + 1
      const term = /[?.!:…]$/.test(unit) ? unit.slice(-1) : '(none)'
      totals.byTerminal[term] = (totals.byTerminal[term] ?? 0) + 1
      distinct.add(k)
      inThisPost++
      if (isStored) totals.confirmed++; else totals.missed++

      records.push({
        postNum: p.postNum,
        postId: p.id,
        sourceText: unit,                 // EXACT, never rewritten
        normalizedKey: k,
        primary: cls.primary,
        subtype: cls.subtype ?? null,
        terminal: term,
        confidence: cls.confidence,
        reason: cls.reason,
        status: isStored ? 'CONFIRMED' : 'MISSED',
        needsReview: cls.confidence !== 'HIGH',
      })
    }
  }
  if (inThisPost) totals.postsWithQuestions++

  // Stored rows the audit did not re-derive from this post's text.
  for (const [k, original] of stored) {
    if (seen.has(k)) continue
    totals.falsePositives++
    records.push({
      postNum: p.postNum, postId: p.id,
      sourceText: original, normalizedKey: k,
      primary: 'QUESTION', subtype: null, terminal: null,
      confidence: 'LOW', reason: 'stored in questions.json but not derived from this post',
      status: 'FALSE_POSITIVE', needsReview: true,
    })
  }

  // Anon questions, counted only to prove they are excluded.
  for (const q of p.quotedPosts ?? []) {
    for (const l of clean(q.text ?? '').split('\n')) {
      if (l.trim().endsWith('?')) totals.anonQuestionsExcluded++
    }
  }
}
totals.distinctQuestions = distinct.size

// ── output ───────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'questions-audit.json'),
  JSON.stringify({ generated: 'see git commit date', totals, records }, null, 1))

const pct = (n, d) => d ? `${(n / d * 100).toFixed(1)}%` : '—'
const review = records.filter(r => r.needsReview)
const missed = records.filter(r => r.status === 'MISSED')
const fps = records.filter(r => r.status === 'FALSE_POSITIVE')

const md = []
md.push('# Q Drops — all-questions audit\n')
md.push('Generated by `scripts/audit-all-questions.mjs`. Audit only: no app data was changed.\n')
md.push('Source text is reproduced exactly as written. Classification is metadata.\n')
md.push('\n## Totals\n')
md.push('| Measure | Count |')
md.push('|---|---|')
md.push(`| Posts in archive | ${totals.posts.toLocaleString()} |`)
md.push(`| Posts containing >=1 Q-authored question | ${totals.postsWithQuestions.toLocaleString()} (${pct(totals.postsWithQuestions, totals.posts)}) |`)
md.push(`| **Q-authored question units** | **${totals.questionUnits.toLocaleString()}** |`)
md.push(`| **Distinct questions** | **${totals.distinctQuestions.toLocaleString()}** |`)
md.push(`| Confirmed (already in questions.json) | ${totals.confirmed.toLocaleString()} |`)
md.push(`| Missed (in text, not stored) | ${totals.missed.toLocaleString()} |`)
md.push(`| False positives (stored, not derived) | ${totals.falsePositives.toLocaleString()} |`)
md.push(`| Anon/quoted questions excluded | ${totals.anonQuestionsExcluded.toLocaleString()} |`)
md.push('\n## Confidence\n')
md.push('| Confidence | Count | Share |')
md.push('|---|---|---|')
for (const c of ['HIGH', 'MEDIUM', 'LOW']) md.push(`| ${c} | ${totals.byConfidence[c].toLocaleString()} | ${pct(totals.byConfidence[c], totals.questionUnits)} |`)
md.push('\n## Terminal punctuation\n')
md.push('| Ends with | Count | Share |')
md.push('|---|---|---|')
for (const [t, n] of Object.entries(totals.byTerminal).sort((a, b) => b[1] - a[1])) md.push(`| \`${t}\` | ${n.toLocaleString()} | ${pct(n, totals.questionUnits)} |`)
md.push('\n## Question subtype\n')
md.push('| Subtype | Count |')
md.push('|---|---|')
for (const [t, n] of Object.entries(totals.bySubtype).sort((a, b) => b[1] - a[1])) md.push(`| ${t} | ${n.toLocaleString()} |`)

md.push(`\n## Missed — in the post text, absent from questions.json (${missed.length.toLocaleString()})\n`)
md.push('| Post | Source text (exact) | Terminal | Confidence | Why |')
md.push('|---|---|---|---|---|')
for (const r of missed.slice(0, 200)) md.push(`| #${r.postNum} | \`${r.sourceText.replace(/\|/g, '\\|').slice(0, 110)}\` | \`${r.terminal}\` | ${r.confidence} | ${r.reason} |`)
if (missed.length > 200) md.push(`\n_…and ${(missed.length - 200).toLocaleString()} more in the JSON._`)

md.push(`\n## False positives — stored but not derived from the post (${fps.length.toLocaleString()})\n`)
md.push('| Post | Stored text (exact) |')
md.push('|---|---|')
for (const r of fps.slice(0, 200)) md.push(`| #${r.postNum} | \`${r.sourceText.replace(/\|/g, '\\|').slice(0, 110)}\` |`)
if (fps.length > 200) md.push(`\n_…and ${(fps.length - 200).toLocaleString()} more in the JSON._`)

md.push(`\n## Manual review queue — MEDIUM or LOW confidence (${review.length.toLocaleString()})\n`)
md.push('| Post | Source text (exact) | Subtype | Confidence | Why | Status |')
md.push('|---|---|---|---|---|---|')
for (const r of review.slice(0, 300)) md.push(`| #${r.postNum} | \`${r.sourceText.replace(/\|/g, '\\|').slice(0, 100)}\` | ${r.subtype ?? '—'} | ${r.confidence} | ${r.reason} | ${r.status} |`)
if (review.length > 300) md.push(`\n_…and ${(review.length - 300).toLocaleString()} more in the JSON._`)

md.push('\n## Method and limits\n')
md.push('- Segmentation splits a line on `?`/`!`/`.` only where followed by whitespace and a capital, digit or quote — so `twitter.com`, `9.11` and `U.S.` are not split.')
md.push('- `>>NNNNNNN` pointer lines and everything in `quotedPosts` are excluded: they are not Q-authored.')
md.push('- A question mark gives HIGH confidence. An interrogative or auxiliary lead without one gives MEDIUM (ends `.`/`!`) or LOW (no terminal punctuation).')
md.push('- `Define X.` counts as a question (it asks for information); `Follow the money.` does not (it asks for an action).')
md.push('- Elliptical noun phrases count only with a `?`. Without one they are treated as statements, which is a deliberate under-call — they are the largest remaining judgement area.')
md.push('- Every MEDIUM/LOW unit is in the review queue rather than silently decided.')

fs.writeFileSync(path.join(OUT, 'questions-audit.md'), md.join('\n') + '\n')

console.log(`\nQ-authored question units : ${totals.questionUnits.toLocaleString()}`)
console.log(`distinct questions        : ${totals.distinctQuestions.toLocaleString()}`)
console.log(`posts with questions      : ${totals.postsWithQuestions.toLocaleString()} / ${totals.posts.toLocaleString()}`)
console.log(`confirmed / missed / FP   : ${totals.confirmed.toLocaleString()} / ${totals.missed.toLocaleString()} / ${totals.falsePositives.toLocaleString()}`)
console.log(`anon questions excluded   : ${totals.anonQuestionsExcluded.toLocaleString()}`)
console.log(`manual review queue       : ${review.length.toLocaleString()}`)
console.log(`\n→ audit/questions-audit.md`)
console.log(`→ audit/questions-audit.json`)
