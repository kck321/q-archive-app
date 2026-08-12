// Q Directives audit — same method as the certified Questions audit.
//
// A DIRECTIVE is Q instructing the reader to DO something: research, read, think, share,
// trust. The deliverable is work. That is the line the Questions audit settled on: "Define
// X." asks for information (a question), "Compare X." asks for analysis (a directive).
//
// Method carried over unchanged: exact Q wording preserved, quoted/anon text excluded, one
// primary class per unit, secondary tags allowed, provenance on anything not Q-authored,
// everything uncertain sent to adjudication rather than decided silently.
//
// The 57 directives the Questions audit already identified are used as a SEED — every one of
// them must be found again, or this auditor disagrees with the certified dataset.
//
// AUDIT ONLY. Nothing applied to production.
//
//   node scripts/audit-directives.mjs [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key, unitsFor, SEGMENTATION_RISK, STARTS_TRUNCATED } from './lib/segment.mjs'
import { overrideFor } from './lib/overrides.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const final = JSON.parse(fs.readFileSync(path.join(OUT, 'questions-final.json'), 'utf8'))
const storedRequests = new Map()   // existing actionRequests, for the comparison
for (const p of posts) for (const r of p.actionRequests ?? []) {
  if (!storedRequests.has(p.id)) storedRequests.set(p.id, new Set())
  storedRequests.get(p.id).add(key(r))
}

// ── the directive lexicon, by what Q is asking the reader to do ──────────────
const FAMILIES = {
  research:      /^(follow|dig|research|trace|compare|reconcile|cross[- ]?reference|connect|map|investigate|verify|confirm|check|track|search|source|corroborate|audit|analyze|analyse|calculate|count|measure)\b/i,
  attention:     /^(read|re-?read|watch|listen|observe|note|see|view|review|look|revisit|refer|study)\b/i,
  cognition:     /^(think|remember|consider|understand|learn|digest|focus|imagine|ask yourself|apply|expand|logic|reflect)\b/i,
  dissemination: /^(share|spread|meme|archive|save|screenshot|post|publish|broadcast|organi[sz]e|rally|mobilize|mobilise|educate|inform)\b/i,
  morale:        /^(trust|pray|have faith|keep faith|stay|stand|hold|be strong|be vigilant|be careful|remain|prepare|fight|defend|protect|unite)\b/i,
  prohibition:   /^(do not|don'?t|never|avoid|ignore|dismiss|stop|cease)\b/i,
}

// Requests for INFORMATION are questions, not directives — the certified rule.
const INFO_REQUEST = /^(define|identify|explain|describe|clarify|name|list)\b/i
const LIST_AS_NOUN = /^list\s+of\b/i
const NAME_AS_NOUN = /^name\s+(is|are|was|were|can|could|will|would|shall|should|may|might|must|has|have|had|we|you|they|i|he|she|it|worth|of|for|in|on|to)\b/i
const SIGNATURE = /^(q|q\+|wwg1wga|ncswic|where we go one,? we go all)\b/i
const CODEY = /^[\W\d_]+$/
const BRACKET_ONLY = /^\[[^\]]*\]$/

function classify(text) {
  const t = (text ?? '').trim()
  if (!t) return null

  // A review decision beats every rule below — see lib/overrides.mjs.
  const ov = overrideFor(t)
  if (ov) return { klass: ov.klass, family: 'research', why: ov.why, confidence: 'HIGH', decidedBy: 'review' }

  if (SIGNATURE.test(t.replace(/[.!?]+$/, ''))) return { klass: 'NON_ANALYTIC', why: 'signature' }
  if (BRACKET_ONLY.test(t) || CODEY.test(t)) return { klass: 'NON_ANALYTIC', why: 'code or bracket token' }
  if (/^https?:\/\//i.test(t)) return { klass: 'EVIDENCE_REFERENCE', why: 'url' }
  if (/:$/.test(t) || LIST_AS_NOUN.test(t) || NAME_AS_NOUN.test(t)) return { klass: 'STATEMENT_OR_HEADING', why: 'heading or noun phrase' }

  // A question outranks a directive: "Why follow the money?" is asking, not instructing.
  if (/\?$/.test(t)) return { klass: 'QUESTION', why: 'ends with "?" — handled by the Questions audit' }
  if (INFO_REQUEST.test(t) && !LIST_AS_NOUN.test(t) && !NAME_AS_NOUN.test(t)) {
    return { klass: 'QUESTION', why: 'information request — the deliverable is an answer, not work' }
  }

  for (const [family, rx] of Object.entries(FAMILIES)) {
    if (rx.test(t)) {
      return {
        klass: 'Q_DIRECTIVE',
        family,
        why: `imperative — ${family} instruction`,
        confidence: /[.!]$/.test(t) ? 'HIGH' : 'MEDIUM',
      }
    }
  }
  return { klass: 'STATEMENT_OR_HEADING', why: 'declarative' }
}

// ── self-test ────────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const mustBe = ['Follow the money.', 'Think logically.', 'Trust the plan.', 'Read between the lines.',
    'Compare against 2.16.18.', 'Reconcile.', 'Learn our comms.', 'Dig, meme, pray.',
    'Do not fall victim to the propaganda.', 'Stay strong.', 'Archive offline.', 'Pray.']
  const mustNotBe = ['Define.', "Define 'State Secrets'.", 'Identify symbolism (Owl / Y).',
    'List the estimated wealth of religious organizations.', 'Why did HRC lose.', 'Coincidence?',
    'These people are stupid.', 'You are the news now.', 'List of Republicans, in the House and Senate:',
    'Where we go one, we go ALL.']
  let bad = 0
  console.log('\nMUST be directives:')
  for (const t of mustBe) {
    const c = classify(t)
    const ok = c?.klass === 'Q_DIRECTIVE'
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${String(c?.family ?? c?.klass).padEnd(14)} ${JSON.stringify(t)}`)
  }
  console.log('\nMUST NOT be directives:')
  for (const t of mustNotBe) {
    const c = classify(t)
    const ok = c?.klass !== 'Q_DIRECTIVE'
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${String(c?.klass).padEnd(22)} ${JSON.stringify(t)}`)
  }
  console.log(bad ? `\n${bad} case(s) wrong\n` : '\nall cases correct\n')
  process.exit(bad ? 1 : 0)
}

// ── the pass ─────────────────────────────────────────────────────────────────
const records = []
const totals = {
  posts: posts.length, postsWithDirectives: 0,
  directiveUnits: 0, distinct: 0,
  byFamily: {}, byConfidence: { HIGH: 0, MEDIUM: 0 },
  alreadyStoredAsRequest: 0, notStored: 0,
  segmentationExcluded: 0,
  anonDirectivesExcluded: 0,
}
const distinct = new Set()

for (const p of posts) {
  const stored = storedRequests.get(p.id) ?? new Set()
  const seen = new Set()
  let inThisPost = 0

  for (const u of unitsFor(p.text ?? '')) {
    const c = classify(u.text)
    if (c?.klass !== 'Q_DIRECTIVE') continue

    // Same fragment guards as the certified audit.
    if (SEGMENTATION_RISK.test(u.text) || STARTS_TRUNCATED.test(u.text)) { totals.segmentationExcluded++; continue }

    const k = key(u.text)
    if (!k || seen.has(k)) continue
    seen.add(k)

    const isStored = stored.has(k)
    totals.directiveUnits++; inThisPost++
    totals.byFamily[c.family] = (totals.byFamily[c.family] ?? 0) + 1
    totals.byConfidence[c.confidence]++
    if (isStored) totals.alreadyStoredAsRequest++; else totals.notStored++
    distinct.add(k)

    records.push({
      postNum: p.postNum, postId: p.id,
      qSourceText: u.text,                     // EXACT
      sourceLines: [u.startLine, u.endLine],
      reconstructed: u.endLine > u.startLine,
      primaryClass: 'Q_DIRECTIVE',
      directiveFamily: c.family,
      grammaticalForm: 'imperative',
      semanticFunction: c.family === 'research' ? 'analytical_directive' : `${c.family}_directive`,
      confidence: c.confidence,
      segmentationConfidence: u.segConfidence,
      alreadyStoredAsActionRequest: isStored,
      countsTowardQDirectiveTotal: true,
      reason: c.why,
    })
  }
  if (inThisPost) totals.postsWithDirectives++

  for (const q of p.quotedPosts ?? []) {
    for (const l of clean(q.text ?? '').split('\n')) {
      const c = classify(l.trim())
      if (c?.klass === 'Q_DIRECTIVE') totals.anonDirectivesExcluded++
    }
  }
}
totals.distinct = distinct.size

// ── cross-check against the certified Questions dataset ──────────────────────
// Every directive the Questions audit found must appear here too.
const seedDirectives = final.finals.filter(f => f.finalClass === 'Q_DIRECTIVE')
const foundKeys = new Set(records.map(r => `${r.postNum}|${key(r.qSourceText)}`))
const seedMissing = seedDirectives.filter(s => !foundKeys.has(`${s.postNum}|${key(s.qSourceText)}`))

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const pct = (n, d) => d ? `${(n / d * 100).toFixed(1)}%` : '—'
const md = []
md.push('# Q Drops — directives audit\n')
md.push('`scripts/audit-directives.mjs`. Same method as the certified Questions audit. **Nothing applied to production.**\n')
md.push('\n## Totals\n')
md.push('| Measure | Count |')
md.push('|---|---|')
md.push(`| **Q-authored directives (occurrences)** | **${totals.directiveUnits.toLocaleString()}** |`)
md.push(`| **Distinct directives** | **${totals.distinct.toLocaleString()}** |`)
md.push(`| Posts containing at least one | ${totals.postsWithDirectives.toLocaleString()} of ${totals.posts.toLocaleString()} (${pct(totals.postsWithDirectives, totals.posts)}) |`)
md.push(`| Already stored as an actionRequest | ${totals.alreadyStoredAsRequest.toLocaleString()} |`)
md.push(`| Not currently stored | ${totals.notStored.toLocaleString()} |`)
md.push(`| Fragments excluded | ${totals.segmentationExcluded.toLocaleString()} |`)
md.push(`| Quoted/anon directives excluded | ${totals.anonDirectivesExcluded.toLocaleString()} |`)
md.push('\n## By family\n')
md.push('| Family | Count | What Q is asking for |')
md.push('|---|---|---|')
const BLURB = {
  research: 'investigate, compare, trace, verify',
  attention: 'read, watch, listen, note',
  cognition: 'think, remember, understand, learn',
  dissemination: 'share, spread, archive, organise',
  morale: 'trust, pray, stand, prepare',
  prohibition: 'do not, never, avoid',
}
for (const [f, n] of Object.entries(totals.byFamily).sort((a, b) => b[1] - a[1])) {
  md.push(`| ${f} | ${n.toLocaleString()} | ${BLURB[f] ?? ''} |`)
}
md.push('\n## Cross-check against the certified Questions dataset\n')
md.push(`The Questions audit reclassified **${seedDirectives.length}** units as directives. This audit re-derives **${(seedDirectives.length - seedMissing.length).toLocaleString()}** of them.\n`)
if (seedMissing.length) {
  md.push('Not re-derived — these need a look, since the two audits disagree:\n')
  md.push('| Post | Text (exact) |')
  md.push('|---|---|')
  for (const s of seedMissing.slice(0, 60)) md.push(`| #${s.postNum} | \`${esc(s.qSourceText).slice(0, 90)}\` |`)
} else {
  md.push('**All of them.** The two audits agree completely on the seed set.')
}
md.push('\n## Method\n')
md.push('- Segmentation is imported from `scripts/lib/segment.mjs`, lifted verbatim from the frozen v2.1 questions auditor, so both audits draw unit boundaries identically.')
md.push('- A question outranks a directive: anything ending in `?`, and any information request (`Define` / `Identify` / `List <object>`), belongs to the Questions dataset and is excluded here.')
md.push('- Quoted/anon lines are excluded, and counted separately to prove it.')
md.push('- Fragments (ending or starting on a lone initial) are excluded, same guard as the certified audit.')

fs.writeFileSync(path.join(OUT, 'directives-audit.md'), md.join('\n') + '\n')
fs.writeFileSync(path.join(OUT, 'directives-audit.json'), JSON.stringify({ totals, seedMissing, records }, null, 1))

console.log('\nQ DIRECTIVES\n')
console.log(`  directive occurrences  : ${totals.directiveUnits.toLocaleString()}`)
console.log(`  distinct directives    : ${totals.distinct.toLocaleString()}`)
console.log(`  posts containing one   : ${totals.postsWithDirectives.toLocaleString()} / ${totals.posts.toLocaleString()}`)
console.log(`  already stored         : ${totals.alreadyStoredAsRequest.toLocaleString()}   not stored: ${totals.notStored.toLocaleString()}`)
console.log(`  quoted/anon excluded   : ${totals.anonDirectivesExcluded.toLocaleString()}`)
console.log('\n  by family:')
for (const [f, n] of Object.entries(totals.byFamily).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}  ${f}`)
console.log(`\n  seed cross-check: ${seedDirectives.length - seedMissing.length}/${seedDirectives.length} of the Questions audit's directives re-derived`)
console.log('\n→ audit/directives-audit.md')
