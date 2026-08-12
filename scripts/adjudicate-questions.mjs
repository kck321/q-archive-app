// Adjudication pass over the v2.1 audit output.
//
// v2.1 is FROZEN. This script does not score or segment anything — it reads the audit and
// makes a decision per record, with the reason and the evidence recorded so a human can
// overturn any of them.
//
// Scope, per the review:
//   - the 98 MISSED candidates      → ADD_Q_QUESTION | NOT_A_QUESTION | SEGMENTATION_ERROR | NEEDS_CONTEXT
//   - the 144 STORED_NOT_IN_SOURCE  → REMOVE_FROM_Q_QUESTIONS | KEEP_AS_EDITORIAL_NORMALIZATION | NEEDS_CONTEXT
//   - the 1,242 segmentation differences are NOT touched.
//
// For an editorial normalisation the exact Q source fragment it was written FROM is located
// and carried alongside it, so the pair can be stored with provenance instead of the
// paraphrase masquerading as Q's words.
//
// AUDIT ONLY. Nothing is applied to production.
//
//   node scripts/adjudicate-questions.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'questions-audit-v2.json'), 'utf8'))
const queue = JSON.parse(fs.readFileSync(path.join(OUT, 'questions-adjudication.json'), 'utf8'))

const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
const ENTITIES = [[/&amp;/gi, '&'], [/&nbsp;/gi, ' '], [/&quot;/gi, '"'], [/&#0?39;|&apos;/gi, "'"], [/&lt;/gi, '<'], [/&gt;/gi, '>']]
const clean = t => { let o = (t ?? '').replace(MARKUP, ''); for (const [r, c] of ENTITIES) o = o.replace(r, c); return o }
const words = t => clean(t).toLowerCase().match(/[a-z0-9']+/g) ?? []
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'do', 'does', 'did', 'what', 'who', 'why', 'how', 'when', 'where', 'which', 'you', 'your', 'it', 'this', 'that'])
const content = t => words(t).filter(w => !STOP.has(w) && w.length > 1)

const linesOf = new Map(posts.map(p => [p.id, clean(p.text ?? '').split('\n').map(l => l.trim())]))

// ── evidence: which Q line was a paraphrase written from? ────────────────────
// Highest share of the paraphrase's content words appearing in a single Q line. A high share
// means the paraphrase is a rewording of that line; a low one means it came from nowhere in
// particular and is not worth preserving.
function sourceFragmentFor(postId, storedText) {
  const lines = linesOf.get(postId) ?? []
  const want = content(storedText)
  if (!want.length) return { line: null, share: 0, index: -1 }
  let best = { line: null, share: 0, index: -1 }
  lines.forEach((line, i) => {
    if (!line || /^>>\d+/.test(line)) return
    const have = new Set(content(line))
    if (!have.size) return
    const hits = want.filter(w => have.has(w)).length
    const share = hits / want.length
    if (share > best.share) best = { line, share, index: i }
  })
  return best
}

const TRUNCATED = /(?:\b(?:[A-Z]\.){2,}|\b[A-Z]\.|\b(?:Adm|Gen|Sen|Rep|Dr|Mr|Mrs|Ms|St|Jr|Sr|vs|v|No|Inc|Co|Corp|Dept|Est|approx|etc|al)\.)\s*$/i

// Two patterns adjudication exposed that the frozen scorer cannot catch, because both units
// end with a legitimate "?" and score well:
//
// STARTS_TRUNCATED — #144's line is "Why was Sarah A. C. attacked (hack-attempt)?" The
// segmenter split it at "A.", correctly flagged the first half, and the SECOND half —
// "C. attacked (hack-attempt)?" — sailed through on its question mark. A unit opening with a
// lone initial is the tail of the one before it.
const STARTS_TRUNCATED = /^[A-Z]\.\s/

// RUN_ON — #1318 comma-splices a statement and a question: "...does not discuss ongoing
// investigations or confirm specific matters, What about the active investigation into
// leaks?" Only the second clause is the question.
const RUN_ON = /,\s+(What|Who|Why|How|When|Where|Which|Whose|Is|Are|Was|Were|Do|Does|Did|Can|Could|Should|Would|Will|Have|Has)\b/

const decisions = []

// ── 1. the 98 missed candidates ──────────────────────────────────────────────
const missed = audit.records.filter(r => r.status === 'MISSED')
for (const r of missed) {
  const t = r.sourceText.trim()
  const lines = linesOf.get(r.postId) ?? []
  let decision, reason, confidence

  if (r.segmentationRisk || TRUNCATED.test(t)) {
    decision = 'SEGMENTATION_ERROR'
    reason = 'ends on an abbreviation or lone initial — a sentence cut in half, not a question Q asked'
    confidence = 'HIGH'
  } else if (STARTS_TRUNCATED.test(t)) {
    decision = 'SEGMENTATION_ERROR'
    reason = 'opens with a lone initial — this is the tail of the preceding unit, split at an abbreviation'
    confidence = 'HIGH'
  } else if (RUN_ON.test(t)) {
    decision = 'SEGMENTATION_ERROR'
    reason = 'a statement and a question comma-spliced into one unit — only the second clause is the question'
    confidence = 'HIGH'
  } else if (t.length > 160) {
    decision = 'SEGMENTATION_ERROR'
    reason = 'over 160 characters — a run-on unit rather than a single question'
    confidence = 'MEDIUM'
  } else if ((t.match(/\[/g) ?? []).length !== (t.match(/\]/g) ?? []).length) {
    decision = 'SEGMENTATION_ERROR'
    reason = 'unbalanced brackets — the unit is cut mid-token'
    confidence = 'MEDIUM'
  } else if (r.questionMarkPresent && r.semanticQuestionScore >= 0.6) {
    decision = 'ADD_Q_QUESTION'
    reason = 'ends with "?" and Q wrote it verbatim'
    confidence = 'HIGH'
  } else if (r.semanticFunction === 'information_request' && r.semanticQuestionScore >= 0.85) {
    decision = 'ADD_Q_QUESTION'
    reason = 'information request, and the same wording is asked with "?" elsewhere in the corpus'
    confidence = 'HIGH'
  } else if (r.semanticFunction === 'information_request') {
    decision = 'NEEDS_CONTEXT'
    reason = 'bare information request ("Define." / "List.") — reads as a question but has no corroboration'
    confidence = 'MEDIUM'
  } else {
    decision = 'NEEDS_CONTEXT'
    reason = 'scored above threshold without a question mark or corroboration'
    confidence = 'LOW'
  }

  decisions.push({
    group: 'MISSED',
    postNum: r.postNum, postId: r.postId,
    qSourceText: r.sourceText,           // EXACT
    currentStoredText: null,
    decision, reason, confidence,
    semanticQuestionScore: r.semanticQuestionScore,
    questionMarkPresent: r.questionMarkPresent,
    segmentationRisk: r.segmentationRisk,
    grammaticalForm: r.grammaticalForm,
    semanticFunction: r.semanticFunction,
    context: {
      before: lines[(r.sourceLines?.[0] ?? 0) - 1] ?? null,
      after: lines[(r.sourceLines?.[1] ?? 0) + 1] ?? null,
    },
  })
}

// ── 2. the 144 stored-but-not-in-source ──────────────────────────────────────
const absent = queue.filter(r => r.status === 'STORED_NOT_PRESENT_IN_Q_SOURCE')
for (const r of absent) {
  const stored = r.storedValue ?? r.sourceText
  const src = sourceFragmentFor(r.postId, stored)
  const lines = linesOf.get(r.postId) ?? []
  let decision, reason, confidence

  if (src.share >= 0.6 && src.line) {
    decision = 'KEEP_AS_EDITORIAL_NORMALIZATION'
    reason = `rewording of Q's "${src.line}" (${Math.round(src.share * 100)}% of its content words) — useful, but Q did not write it`
    confidence = 'HIGH'
  } else if (src.share >= 0.34 && src.line) {
    decision = 'NEEDS_CONTEXT'
    reason = `partly matches Q's "${src.line}" (${Math.round(src.share * 100)}%) — could be a normalisation or a merge of several lines`
    confidence = 'MEDIUM'
  } else {
    decision = 'REMOVE_FROM_Q_QUESTIONS'
    reason = src.line
      ? `no Q line accounts for it (best match only ${Math.round(src.share * 100)}%) — invented by the extractor`
      : 'no Q text to attribute it to'
    confidence = 'HIGH'
  }

  decisions.push({
    group: 'STORED_NOT_IN_SOURCE',
    postNum: r.postNum, postId: r.postId,
    qSourceText: src.line,               // EXACT Q wording, when there is one
    currentStoredText: stored,           // EXACT stored wording
    decision, reason, confidence,
    provenance: decision === 'KEEP_AS_EDITORIAL_NORMALIZATION'
      ? { qAuthored: src.line, editorialNormalization: stored, neverDisplayAsQ: true }
      : null,
    sourceMatchShare: Number(src.share.toFixed(2)),
    context: {
      before: src.index > 0 ? lines[src.index - 1] : null,
      after: src.index >= 0 ? lines[src.index + 1] ?? null : null,
    },
  })
}

// ── output ───────────────────────────────────────────────────────────────────
const tally = {}
for (const d of decisions) {
  tally[d.group] ??= {}
  tally[d.group][d.decision] = (tally[d.group][d.decision] ?? 0) + 1
}

fs.writeFileSync(path.join(OUT, 'questions-adjudicated.json'),
  JSON.stringify({ frozenAuditor: 'v2.1', tally, decisions }, null, 1))

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = []
md.push('# Q Drops — question adjudication\n')
md.push('Auditor v2.1 (frozen). Decisions proposed for human confirmation. **Nothing applied to production.**\n')
md.push('Exact Q wording is preserved in every row. The 1,242 segmentation-difference records were deliberately not touched.\n')
md.push('\n## Decisions\n')
for (const [group, counts] of Object.entries(tally)) {
  md.push(`\n**${group}**\n`)
  md.push('| Decision | Count |')
  md.push('|---|---|')
  for (const [d, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) md.push(`| ${d} | ${n} |`)
}

for (const group of ['MISSED', 'STORED_NOT_IN_SOURCE']) {
  const list = decisions.filter(d => d.group === group)
  md.push(`\n## ${group === 'MISSED' ? 'Missed candidates' : 'Stored, not in Q source'} (${list.length})\n`)
  if (group === 'MISSED') {
    md.push('| Post | Q source text (exact) | Decision | Confidence | Reason | Before | After |')
    md.push('|---|---|---|---|---|---|---|')
    for (const d of list) {
      md.push(`| #${d.postNum} | \`${esc(d.qSourceText).slice(0, 90)}\` | **${d.decision}** | ${d.confidence} | ${esc(d.reason).slice(0, 80)} | \`${esc(d.context.before).slice(0, 30)}\` | \`${esc(d.context.after).slice(0, 30)}\` |`)
    }
  } else {
    md.push('| Post | Stored text (exact) | Q source line (exact) | Match | Decision | Confidence |')
    md.push('|---|---|---|---|---|---|')
    for (const d of list) {
      md.push(`| #${d.postNum} | \`${esc(d.currentStoredText).slice(0, 70)}\` | \`${esc(d.qSourceText).slice(0, 70)}\` | ${Math.round((d.sourceMatchShare ?? 0) * 100)}% | **${d.decision}** | ${d.confidence} |`)
    }
  }
}

md.push('\n## Decision rules\n')
md.push('**Missed candidates**')
md.push('- `SEGMENTATION_ERROR` — ends on an abbreviation or lone initial, exceeds 160 characters, or has unbalanced brackets. The unit is a fragment, not a question.')
md.push('- `ADD_Q_QUESTION` — Q wrote it verbatim and it either ends with `?` or is an information request whose wording is asked with `?` elsewhere in the corpus.')
md.push('- `NEEDS_CONTEXT` — reads as a question but has neither a question mark nor corroboration. Bare `Define.` / `List.` land here deliberately.')
md.push('\n**Stored, not in Q source**')
md.push('- Content-word overlap against every line of the post locates the fragment a paraphrase was written from.')
md.push('- `KEEP_AS_EDITORIAL_NORMALIZATION` — 60%+ overlap with one Q line. Both texts are kept with provenance; `neverDisplayAsQ: true`.')
md.push('- `NEEDS_CONTEXT` — 34–59%. Could be a normalisation or a merge of several lines.')
md.push('- `REMOVE_FROM_Q_QUESTIONS` — below 34%. No Q line accounts for it.')
md.push('\n## Not touched\n')
md.push('The 1,242 `STORED_PRESENT_SEGMENTATION_DIFF` records are Q\'s own words with a boundary drawn differently by two tools. They are excluded from this pass by design.')

fs.writeFileSync(path.join(OUT, 'questions-adjudicated.md'), md.join('\n') + '\n')

console.log('\nADJUDICATION (auditor v2.1, frozen)\n')
for (const [group, counts] of Object.entries(tally)) {
  console.log(`${group}`)
  for (const [d, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${d}`)
}
console.log('\n→ audit/questions-adjudicated.md')
console.log('→ audit/questions-adjudicated.json')
