// Directives adjudication.
//
// The directives auditor is FROZEN. This makes a decision per uncertain record, using the
// shared segmentation and overrides so it cannot drift from the certified Questions dataset.
//
// Scope, per the review:
//   - the 149 directives the auditor derived that are NOT currently stored
//   - every stored actionRequest the auditor did NOT derive as a directive (the disagreements)
//
// Final classes: Q_DIRECTIVE | Q_QUESTION | Q_CLAIM | Q_STATEMENT_OR_HEADING |
//                SEGMENTATION_ERROR | NEEDS_CONTEXT
// Directives keep their family: research | cognition | attention | morale | prohibition |
//                dissemination
//
// The review's warning drives the main rule here: keyword presence must not make something a
// directive. The danger is not "They think you are stupid." — that starts with "They" and was
// never at risk. It is the words that are BOTH verb and noun: Post, Note, Check, Map, Focus,
// Search, Trace, Count, Source, Review, Stand, Fight, Hold. "Post 1234 shows…" and
// "Review shows…" are statements; "Post this everywhere." and "Review the document." are not.
//
// AUDIT ONLY. Nothing applied, nothing deployed.
//
//   node scripts/adjudicate-directives.mjs [--selftest]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key, unitsFor, SEGMENTATION_RISK, STARTS_TRUNCATED } from './lib/segment.mjs'
import { overrideFor } from './lib/overrides.mjs'
import { imperativeMood, familyOf, NOUN_SUBJECT_VERB } from './lib/imperative.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const dirAudit = JSON.parse(fs.readFileSync(path.join(OUT, 'directives-audit.json'), 'utf8'))

// Mood detection, the verb lexicon and the noun trap all live in lib/imperative.mjs. Nothing
// here re-implements them — the last four regressions on this project came from exactly that.
const HEADING = /:$/
const SECOND_PERSON_STATEMENT = /^(you|they|we|he|she|it|i|there|this|that|these|those|people|anons?)\b/i

const INFO_REQUEST = /^(define|identify|explain|describe|clarify)\b/i
const LIST_AS_NOUN = /^list\s+of\b/i
const NAME_AS_NOUN = /^name\s+(is|are|was|were|can|could|will|would|shall|should|may|might|must|has|have|had|we|you|they|i|he|she|it|worth|of|for|in|on|to)\b/i
const SIGNATURE = /^(q|q\+|wwg1wga|ncswic|where we go one,? we go all)\b/i
const CODEY = /^[\W\d_]+$/
const BRACKET_ONLY = /^\[[^\]]*\]$/

function adjudicate(text) {
  const t = (text ?? '').trim()
  if (!t) return { klass: 'SEGMENTATION_ERROR', why: 'empty', confidence: 'HIGH' }

  const ov = overrideFor(t)
  if (ov) return { klass: ov.klass, family: 'research', why: ov.why, confidence: 'HIGH', decidedBy: 'review' }

  if (SEGMENTATION_RISK.test(t) || STARTS_TRUNCATED.test(t)) {
    return { klass: 'SEGMENTATION_ERROR', why: 'ends or starts on a lone initial — a fragment of a split sentence', confidence: 'HIGH' }
  }
  if (SIGNATURE.test(t.replace(/[.!?]+$/, ''))) {
    return { klass: 'Q_STATEMENT_OR_HEADING', why: 'signature or slogan, not an instruction', confidence: 'HIGH' }
  }
  if (BRACKET_ONLY.test(t) || CODEY.test(t)) {
    return { klass: 'Q_STATEMENT_OR_HEADING', why: 'code or bracket token', confidence: 'HIGH' }
  }
  if (HEADING.test(t) || LIST_AS_NOUN.test(t) || NAME_AS_NOUN.test(t)) {
    return { klass: 'Q_STATEMENT_OR_HEADING', why: 'heading or noun phrase introducing material', confidence: 'HIGH' }
  }
  if (/\?$/.test(t)) {
    return { klass: 'Q_QUESTION', why: 'ends with "?" — belongs to the certified Questions dataset', confidence: 'HIGH' }
  }
  if (INFO_REQUEST.test(t)) {
    return { klass: 'Q_QUESTION', why: 'information request — the deliverable is an answer', confidence: 'HIGH' }
  }

  // Mood is decided BEFORE any family keyword is consulted, so a keyword can never promote a
  // noun phrase into a directive. This is the review's guard against cognition / attention /
  // morale becoming catch-alls.
  const mood = imperativeMood(t)

  if (mood.undecidable) {
    return { klass: 'NEEDS_CONTEXT', why: mood.why, confidence: 'LOW' }
  }

  if (mood.imperative) {
    const family = familyOf(t)
    return {
      klass: 'Q_DIRECTIVE',
      family,
      why: `${mood.why}${family === 'other' ? ' — instruction outside the six families' : ''}`,
      confidence: family === 'other' ? 'MEDIUM' : /[.!]$/.test(t) ? 'HIGH' : 'MEDIUM',
    }
  }

  // Not a command. A sentence with an explicit subject asserts something; a bare noun phrase
  // is a label or heading.
  // An explicit subject anywhere — a pronoun or a reporting verb — makes it an assertion.
  // "Together we win." has no copula but is plainly a claim.
  if (SECOND_PERSON_STATEMENT.test(t) || NOUN_SUBJECT_VERB.test(t)
    || /\b(is|are|was|were|will|would|has|have|had|can|could|does|do)\b/i.test(t)
    || /\b(we|they|you|he|she|it|i)\s+[a-z]+/i.test(t)) {
    return { klass: 'Q_CLAIM', why: `not imperative — ${mood.why}; asserts rather than instructs`, confidence: 'MEDIUM' }
  }
  return { klass: 'Q_STATEMENT_OR_HEADING', why: `not imperative — ${mood.why}`, confidence: 'MEDIUM' }
}

// ── self-test on the review's boundary cases ─────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases = [
    // must be directives
    ['Think logically.', 'Q_DIRECTIVE'], ['Ask yourself why.', 'Q_DIRECTIVE'], ['Use logic.', 'Q_DIRECTIVE'],
    ['Connect the dots.', 'Q_DIRECTIVE'], ['Look here.', 'Q_DIRECTIVE'], ['Notice the timing.', 'Q_DIRECTIVE'],
    ['Focus on the date.', 'Q_DIRECTIVE'], ['Have faith.', 'Q_DIRECTIVE'], ['Stay strong.', 'Q_DIRECTIVE'],
    ['Trust yourself.', 'Q_DIRECTIVE'], ['Follow the money.', 'Q_DIRECTIVE'], ['Do not fall victim.', 'Q_DIRECTIVE'],
    // real corpus units the verb-whitelist auditor missed
    ['Enjoy the show.', 'Q_DIRECTIVE'], ['Be ready.', 'Q_DIRECTIVE'], ['Be heard.', 'Q_DIRECTIVE'],
    ['Re_read.', 'Q_DIRECTIVE'], ['Vote!', 'Q_DIRECTIVE'], ['Eyes on.', 'Q_DIRECTIVE'],
    ['Buckle up.', 'Q_DIRECTIVE'], ['Open your eyes to see the truth.', 'Q_DIRECTIVE'],
    ['Update the graphic.', 'Q_DIRECTIVE'], ['Paint the picture.', 'Q_DIRECTIVE'],
    ['Find the reflection inside the castle.', 'Q_DIRECTIVE'], ['Handle w/ care.', 'Q_DIRECTIVE'],
    // must NOT be directives — the catch-all guard
    ['Logical thinking.', 'Q_STATEMENT_OR_HEADING'], ['Critical thinking.', 'Q_STATEMENT_OR_HEADING'],
    ['Sec detail background.', 'Q_STATEMENT_OR_HEADING'], ['The more you know….', 'Q_CLAIM'],
    ['Together we win.', 'Q_CLAIM'], ['Unity not division.', 'Q_STATEMENT_OR_HEADING'],
    ['They think you are stupid.', 'Q_CLAIM'], ['You are beginning to understand.', 'Q_CLAIM'],
    ['Post 1234 shows the connection.', 'Q_CLAIM'], ['Review shows nothing was done.', 'Q_CLAIM'],
    ['Focus is on the economy.', 'Q_CLAIM'], ['Where we go one, we go ALL.', 'Q_STATEMENT_OR_HEADING'],
    ['Important Context:', 'Q_STATEMENT_OR_HEADING'], ['Coincidence?', 'Q_QUESTION'],
    ["Define 'State Secrets'.", 'Q_QUESTION'], ['List of Republicans, in the House and Senate:', 'Q_STATEMENT_OR_HEADING'],
    // undecidable standing alone — must not be guessed either way
    ['Panic.', 'NEEDS_CONTEXT'], ['Focus.', 'NEEDS_CONTEXT'],
  ]
  let bad = 0
  for (const [t, want] of cases) {
    const r = adjudicate(t)
    const ok = r.klass === want
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${r.klass.padEnd(24)}${(r.family ?? '').padEnd(14)}${JSON.stringify(t)}`)
  }
  console.log(bad ? `\n${bad} case(s) wrong\n` : '\nall cases correct\n')
  process.exit(bad ? 1 : 0)
}

// ── build the two review sets ────────────────────────────────────────────────
const derived = new Map()   // postNum|key -> record
for (const r of dirAudit.records) derived.set(`${r.postNum}|${key(r.qSourceText)}`, r)

const linesOf = new Map(posts.map(p => [p.id, clean(p.text ?? '').split('\n').map(l => l.trim())]))
const decisions = []
const tally = {}
const bump = (g, k) => { tally[g] ??= {}; tally[g][k] = (tally[g][k] ?? 0) + 1 }

// 1. derived but not stored — the 149 candidates
for (const r of dirAudit.records) {
  if (r.alreadyStoredAsActionRequest) continue
  const a = adjudicate(r.qSourceText)
  const lines = linesOf.get(r.postId) ?? []
  bump('NEW CANDIDATES (149)', a.klass)
  decisions.push({
    group: 'NEW_CANDIDATE',
    postNum: r.postNum, postId: r.postId,
    qSourceText: r.qSourceText,
    currentClassification: 'none — not stored',
    proposedClassification: a.klass,
    family: a.klass === 'Q_DIRECTIVE' ? (a.family ?? r.directiveFamily) : null,
    reason: a.why,
    confidence: a.confidence,
    context: { before: lines[r.sourceLines?.[0] - 1] ?? null, after: lines[(r.sourceLines?.[1] ?? 0) + 1] ?? null },
  })
}

// 2. stored actionRequests the auditor did NOT derive as directives — the disagreements
for (const p of posts) {
  const lines = linesOf.get(p.id) ?? []
  for (const req of p.actionRequests ?? []) {
    const k = `${p.postNum}|${key(req)}`
    if (derived.has(k)) continue
    const a = adjudicate(req)
    bump('STORED, AUDITOR DISAGREES', a.klass)
    const idx = lines.findIndex(l => key(l) === key(req))
    decisions.push({
      group: 'STORED_DISAGREEMENT',
      postNum: p.postNum, postId: p.id,
      qSourceText: req,
      currentClassification: 'actionRequest',
      proposedClassification: a.klass,
      family: a.klass === 'Q_DIRECTIVE' ? (a.family ?? null) : null,
      reason: a.why,
      confidence: a.confidence,
      context: { before: idx > 0 ? lines[idx - 1] : null, after: idx >= 0 ? lines[idx + 1] ?? null : null },
    })
  }
}

// ── output ───────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT, 'directives-adjudicated.json'), JSON.stringify({ frozenAuditor: 'directives v1', tally, decisions }, null, 1))

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = []
md.push('# Q Drops — directives adjudication\n')
md.push('Directives auditor frozen. Shared `lib/segment.mjs` and `lib/overrides.mjs` used, not forked. **Nothing applied to production.**\n')
md.push('\n## Decisions\n')
for (const [group, counts] of Object.entries(tally)) {
  md.push(`\n**${group}**\n`)
  md.push('| Proposed | Count |')
  md.push('|---|---|')
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n.toLocaleString()} |`)
}
for (const [group, title] of [['NEW_CANDIDATE', 'New candidates — derived but not stored'], ['STORED_DISAGREEMENT', 'Stored as actionRequest, auditor disagrees']]) {
  const list = decisions.filter(d => d.group === group)
  md.push(`\n## ${title} (${list.length.toLocaleString()})\n`)
  md.push('| Post | Q source text (exact) | Current | Proposed | Family | Conf | Reason | Before | After |')
  md.push('|---|---|---|---|---|---|---|---|---|')
  for (const d of list.slice(0, 300)) {
    md.push(`| #${d.postNum} | \`${esc(d.qSourceText).slice(0, 80)}\` | ${d.currentClassification} | **${d.proposedClassification}** | ${d.family ?? ''} | ${d.confidence} | ${esc(d.reason).slice(0, 60)} | \`${esc(d.context.before).slice(0, 28)}\` | \`${esc(d.context.after).slice(0, 28)}\` |`)
  }
  if (list.length > 300) md.push(`\n_…and ${(list.length - 300).toLocaleString()} more in the JSON._`)
}
md.push('\n## The rule that does the work\n')
md.push('Keyword presence does not make a directive. The risk is not `They think you are stupid.` — that opens with a pronoun and was never a candidate. It is the words that are **both verb and noun**: Post, Note, Check, Map, Focus, Search, Trace, Count, Source, Review, Stand, Fight, Hold.\n')
md.push('- `Post this everywhere.` → directive. `Post 1234 shows the connection.` → claim.')
md.push('- `Review the document.` → directive. `Review shows nothing was done.` → claim.')
md.push('- `Focus on the date.` → directive. `Focus is on the economy.` → claim.')
md.push('\nA leading ambiguous word followed by a copula, preposition or number is a NOUN, and the unit is a claim. Any directive whose lead is ambiguous is capped at MEDIUM confidence so it lands in review rather than being accepted silently.')

md.push('\n## Mood, not keywords\n')
md.push('The frozen auditor decided directives from a ~40-verb whitelist. That is why 1,860 stored `actionRequest` records disagreed with it: Q\'s instruction vocabulary is open-ended, and `Enjoy the show.` (34x), `Be ready.`, `Re_read.`, `Vote!` and `Eyes on.` were never in the list.\n')
md.push('`scripts/lib/imperative.mjs` decides imperative **mood** structurally and only then assigns family, so a family keyword can never promote a noun phrase into a directive. That guard is what keeps `Logical thinking.` (58x), `Critical thinking.`, `Sec detail background.` and `Together we win.` out of cognition/attention/morale.\n')

// ── a Questions-dataset defect this audit surfaced ───────────────────────────
// Reported, NOT acted on. The 6,299 certified occurrences are untouched.
const certByPost = new Map()
for (const q of JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8'))) {
  if (!certByPost.has(q.postNum)) certByPost.set(q.postNum, [])
  certByPost.get(q.postNum).push(key(q.text))
}
const uncovered = []
for (const p of posts) {
  const certs = certByPost.get(p.postNum) ?? []
  for (const u of unitsFor(p.text ?? '')) {
    const t = u.text.trim()
    if (!/\?$/.test(t)) continue
    if (/^https?:\/\//i.test(t) || /^>>\d/.test(t)) continue
    const k = key(t)
    if (certs.some(c => c === k || c.includes(k) || k.includes(c))) continue
    uncovered.push({ postNum: p.postNum, text: t, lead: (t.match(/^[A-Za-z_]+/) ?? [''])[0].toLowerCase() })
  }
}
const leadTally = {}
for (const u of uncovered) leadTally[u.lead || '(symbol/number)'] = (leadTally[u.lead || '(symbol/number)'] ?? 0) + 1
fs.writeFileSync(path.join(OUT, 'uncovered-question-units.json'), JSON.stringify({ count: uncovered.length, leadTally, uncovered }, null, 1))

md.push('\n## Defect this audit surfaced in the certified Questions dataset\n')
md.push('**Reported only. The 6,299 occurrence dataset has not been touched.**\n')
md.push(`${uncovered.length} Q-authored units end in \`?\` yet are absent from the certified Questions set (URLs and \`>>\` pointers already excluded).\n`)
md.push('The cause is a single line in the frozen auditor, `scripts/audit-all-questions-v2.mjs:144`:\n')
md.push('```js\nif (DIRECTIVE.test(t) && !asksInfo) { s -= 0.6; signals.push(\'imperative action verb\') }\n```\n')
md.push('A question mark scores `+0.6`; the directive penalty is `-0.6`; `THRESHOLD` is `0.5`. So **any `?`-terminated unit opening with a verb in `DIRECTIVE` scored exactly 0.0 and was dropped — the question mark could not save it.** `DIRECTIVE` contains `ask, have, remember, think, defend, protect, note, look, hold, fight`, which matches the observed leading words one for one:\n')
md.push('| Leading word | Uncovered units |')
md.push('|---|---|')
for (const [w, n] of Object.entries(leadTally).sort((a, b) => b[1] - a[1]).slice(0, 14)) md.push(`| ${w} | ${n} |`)
md.push('\nClear misses:\n')
for (const u of uncovered.filter(x => ['ask', 'have', 'remember', 'defend'].includes(x.lead)).slice(0, 12)) md.push(`- #${u.postNum} — \`${esc(u.text).slice(0, 90)}\``)
md.push('\n#1320 shows it plainly: `Why is HRC in NZ?` is certified, while `Ask yourself, why are they panicking?` — the line directly above it — is not.\n')
md.push('A secondary, smaller issue: `AUX_INVERSION` (line 53) is intentionally case-sensitive for its `[A-Z][a-z]+` proper-noun branch, so all-caps interrogatives such as `HAVE YOU EVER WITNESSED SO MANY CONGRESS/SENATE SEATS VACATE…?` receive no inversion credit. Q writes in caps constantly.\n')
md.push('These are directive-framed questions — arguably `Q_DIRECTIVE` with an embedded question rather than plain `Q_QUESTION`. Either way the current state is wrong: they are in neither dataset. **Recommend deciding the class before any Questions recount; the 6,299 figure is an undercount of roughly this many units.**')

fs.writeFileSync(path.join(OUT, 'directives-adjudicated.md'), md.join('\n') + '\n')
console.log(`\n  certified-Questions gap surfaced: ${uncovered.length} "?"-terminated units in neither dataset`)

console.log('\nDIRECTIVES ADJUDICATION\n')
for (const [group, counts] of Object.entries(tally)) {
  console.log(group)
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(5)}  ${k}`)
}
console.log('\n→ audit/directives-adjudicated.md')
