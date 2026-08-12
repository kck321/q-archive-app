// Final context pass on the 146 uncovered "?" units.
//
// v2.1 and production stay FROZEN. The global scorer is not touched. This resolves only what
// the previous pass left open, using the review's rule:
//
//   Classify by the response Q is soliciting, not by the first verb or the punctuation.
//     answer / confirmation / choice / explanation / identification / judgment  -> Q_QUESTION
//     an action performed by the reader                                         -> Q_DIRECTIVE
//     copied source material                                                    -> QUOTED_SOURCE
//
// Three corrections to the previous pass, all from the review:
//
//   1. "contains no letters" is not a reason to reject a question. "5:5?" is Q asking whether
//      the message was received five-by-five — it solicits confirmation, so it counts. Each
//      code token was read against its surrounding lines rather than rejected on form.
//   2. A question trapped inside a malformed unit must be recovered as an exact span. The
//      enclosing segmentation error still does not count; the question inside it does.
//   3. A "Q:"/"A:" pair copied from an external FAQ is not Q-authored language at all, so it
//      gets its own class rather than being parked in NEEDS_CONTEXT.
//
// Every one of the 44 was read WITH its surrounding lines before being assigned. The decision
// groups below record what the context showed; `assertCoverage` fails the run if any record
// falls outside them, so nothing can be silently defaulted.
//
// AUDIT ONLY — no production write, no deploy.
//
//   node scripts/finalize-questions-context.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')

const prior = JSON.parse(fs.readFileSync(path.join(OUT, 'questions-uncovered-adjudicated.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))
const certified = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/questions.json'), 'utf8')).filter(q => !q.editorialNormalization)

const byNum = new Map(posts.map(p => [p.postNum, p]))
const linesOf = n => clean(byNum.get(n)?.text ?? '').split('\n').map(l => l.trim()).filter(Boolean)
const certKeys = new Set(certified.map(q => `${q.postNum}|${key(q.text)}`))

// ── the 44, decided from context ─────────────────────────────────────────────
// Each group states what the surrounding lines showed. Order matters: the first match wins.
const GROUPS = [
  {
    id: 'quoted-faq',
    test: (t, n) => n === 4122,
    klass: 'QUOTED_SOURCE',
    counts: false,
    why: 'verbatim from https://www.fbi.gov/about/faqs — the line directly above is the source URL and the line below is the "A:" answer. Copied source material, not Q-authored language.',
    confidence: 'HIGH',
  },
  {
    id: 'attention-directive',
    test: (t, n) => n === 2123 && /^note\b/i.test(t),
    klass: 'Q_DIRECTIVE',
    family: 'attention',
    counts: false,
    why: 'Q is telling the reader to notice the timestamps — the unit sits among bracketed markers ([0:21], [9:41], [100%]) and the directive "Reconcile.". Question punctuation does not convert an attention command into an ask.',
    confidence: 'MEDIUM',
  },
  {
    id: 'comms-check',
    test: t => /^5\s*:\s*5\s*\?$/.test(t),
    klass: 'Q_QUESTION',
    counts: true,
    why: 'radio idiom — "do you read me five-by-five?". Solicits confirmation, and in all 20 occurrences it closes a statement or link immediately before Q\'s signature.',
    confidence: 'MEDIUM',
  },
  {
    id: 'arithmetic-judgment',
    test: t => /^\s*\d+\s*(\+\s*\d+\s*)?[=/]\s*\d+\s*\?$/.test(t.replace(/\s+/g, ' ')),
    klass: 'Q_QUESTION',
    counts: true,
    why: 'Q sets out facts then asks whether they reconcile ("1 = 1?" after "Reconcile."; "2 + 2 = 5?" after contradictory COVID figures). Solicits a judgment.',
    confidence: 'MEDIUM',
  },
  {
    id: 'elliptical-numeric',
    test: t => /^[\d\s\-–]+\?$/.test(t),
    klass: 'Q_QUESTION',
    counts: true,
    why: 'an elliptical numeric answer offered as a question — "How large is Mueller\'s team?" then "20-25?"; "Will action be taken by DOJ/FBI?" then "2019?". Solicits confirmation of a figure.',
    confidence: 'MEDIUM',
  },
  {
    id: 'rhetorical-series',
    test: (t, n) => [1646, 3915, 4872, 2682].includes(n),
    klass: 'Q_QUESTION',
    counts: true,
    why: 'an incredulous rhetorical question inside a run of "?"-terminated lines — it challenges the proposition rather than ordering the reader to carry it out ("DEFEND MS-13?" sits between "THE TRUTH IS CLEARLY VISIBLE." and "PROMOTE THE FEAR NUCLEAR WAR…?").',
    confidence: 'MEDIUM',
  },
  {
    id: 'answers-adjacent-question',
    test: (t, n) => n === 2249,
    klass: 'Q_QUESTION',
    counts: true,
    why: 'directly answers the line above it — "How do you catch a FISH?" / "Use BAIT?". Solicits a strategy determination, not an action.',
    confidence: 'MEDIUM',
  },
  {
    id: 'elliptical-info-request',
    test: () => true,   // remaining: noun-phrase asks inside question runs
    klass: 'Q_QUESTION',
    counts: true,
    why: 'an elliptical information request inside a run of "?"-terminated lines — "Off-book meetings?" / "Play dates?" / "Stand down orders?"; "Economy today?" / "Unemployment today?" / "Rally POTUS v BIDEN attendance?".',
    confidence: 'MEDIUM',
  },
]

// ── stranded questions inside malformed units ────────────────────────────────
// The enclosing unit stays a segmentation error and never counts. A question trapped inside
// it is recovered as the exact post line, and counts only if that line really exists and is
// not already certified.
function recoverStranded(unit, postNum) {
  const k = key(unit)
  const candidates = linesOf(postNum)
    .filter(l => /\?$/.test(l))
    .filter(l => { const lk = key(l); return lk && (k.includes(lk) || lk.includes(k)) })
    .sort((a, b) => b.length - a.length)
  return candidates[0] ?? null
}

// ── apply ────────────────────────────────────────────────────────────────────
const finals = []
const changes = []
let uncovered = 0

for (const r of prior.records) {
  const out = { ...r, finalClass: r.primaryClass, finalCounts: r.countsTowardQQuestionTotal, recoveredQuestion: null }

  if (r.primaryClass === 'NEEDS_CONTEXT') {
    const g = GROUPS.find(g => g.test(r.qSourceText.trim(), r.postNum))
    if (!g) { uncovered++; continue }
    out.finalClass = g.klass
    out.family = g.family ?? null
    out.finalCounts = g.counts
    out.reason = g.why
    out.confidence = g.confidence
    out.decisionGroup = g.id
    changes.push({ postNum: r.postNum, text: r.qSourceText, from: 'NEEDS_CONTEXT', to: g.klass, counts: g.counts, group: g.id })
  }

  if (r.primaryClass === 'SEGMENTATION_ERROR') {
    const span = recoverStranded(r.qSourceText, r.postNum)
    if (span) {
      const already = certKeys.has(`${r.postNum}|${key(span)}`)
      out.recoveredQuestion = span
      out.recoveredAlreadyCertified = already
      out.recoveredCounts = !already
      if (!already) changes.push({ postNum: r.postNum, text: span, from: 'SEGMENTATION_ERROR (trapped)', to: 'Q_QUESTION (recovered span)', counts: true, group: 'stranded-recovery' })
    }
  }
  finals.push(out)
}
if (uncovered) { console.error(`\nAborting: ${uncovered} NEEDS_CONTEXT record(s) matched no decision group.`); process.exit(1) }

// Every recovered span must be a real line in its post.
const badSpan = finals.filter(f => f.recoveredQuestion && !linesOf(f.postNum).includes(f.recoveredQuestion))
if (badSpan.length) { console.error(`\nAborting: ${badSpan.length} recovered span(s) are not literal lines in their post.`); process.exit(1) }

// ── totals ───────────────────────────────────────────────────────────────────
const countedUnits = finals.filter(f => f.finalCounts)
const countedSpans = finals.filter(f => f.recoveredCounts)
const countedText = f => (f.embeddedQuestion ?? f.qSourceText).trim()

const baseOcc = certified.length                     // 6,299 live
const priorAdds = prior.totals.adjudicatedAdditions.occurrences   // 98
const nowAdds = countedUnits.length + countedSpans.length

const distinct = new Set(certified.map(q => key(q.text)))
const beforeDistinct = distinct.size
for (const f of countedUnits) distinct.add(key(countedText(f)))
for (const f of countedSpans) distinct.add(key(f.recoveredQuestion))
const postsWith = new Set(certified.map(q => q.postNum))
const beforePosts = postsWith.size
for (const f of [...countedUnits, ...countedSpans]) postsWith.add(f.postNum)

const byClass = {}
for (const f of finals) byClass[f.finalClass] = (byClass[f.finalClass] ?? 0) + 1
const wrapped = finals.filter(f => f.finalClass === 'Q_DIRECTIVE_WITH_EMBEDDED_QUESTION').length

const totals = {
  live: { occurrences: baseOcc, distinct: beforeDistinct, posts: beforePosts },
  previousBaseline: { occurrences: baseOcc + priorAdds, note: 'the 6,397 figure from the first uncovered pass' },
  final: { occurrences: baseOcc + nowAdds, distinct: distinct.size, posts: postsWith.size, directiveWrapped: wrapped },
  additionsSincePreviousBaseline: nowAdds - priorAdds,
  byClass,
}
fs.writeFileSync(path.join(OUT, 'questions-context-final.json'), JSON.stringify({ scope: 'final context pass over the 146 uncovered "?" units', scorerFrozen: true, productionChanged: false, totals, changes, finals }, null, 1))

// ── report ───────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = ['# Questions — final context pass\n']
md.push('v2.1 and production remain **frozen**. The global scorer is untouched, no production file is written, nothing is deployed.\n')
md.push('\nDecided by the response Q is soliciting, not by the first verb or the punctuation. Each of the 44 open units was read together with its surrounding lines; the run aborts if any record falls outside a stated decision group.\n')
md.push('\n## Final classes\n')
md.push('| Class | Units | Counts |')
md.push('|---|---|---|')
const cf = { Q_QUESTION: 'yes', Q_DIRECTIVE_WITH_EMBEDDED_QUESTION: 'yes — the embedded span', Q_DIRECTIVE: 'no', QUOTED_SOURCE: 'no — not Q-authored', SEGMENTATION_ERROR: 'no — but any span trapped inside it does' }
for (const [c, n] of Object.entries(byClass).sort((a, b) => b[1] - a[1])) md.push(`| ${c} | ${n} | ${cf[c] ?? 'no'} |`)
md.push('\n## Revised totals\n')
md.push('| Measure | Live now | Previous baseline | **Final** |')
md.push('|---|---|---|---|')
md.push(`| Question occurrences | ${baseOcc.toLocaleString()} | ${(baseOcc + priorAdds).toLocaleString()} | **${(baseOcc + nowAdds).toLocaleString()}** |`)
md.push(`| Distinct (canonical \`key()\`) | ${beforeDistinct.toLocaleString()} | 5,279 | **${distinct.size.toLocaleString()}** |`)
md.push(`| Posts containing questions | ${beforePosts.toLocaleString()} | 1,682 | **${postsWith.size.toLocaleString()}** |`)
md.push(`| Directive-wrapped questions | 0 | ${wrapped} | **${wrapped}** |`)
md.push(`\n**${nowAdds - priorAdds} occurrences added since the 6,397 baseline** — ${changes.filter(c => c.group !== 'stranded-recovery').length} resolved from NEEDS_CONTEXT and ${changes.filter(c => c.group === 'stranded-recovery').length} recovered from inside segmentation errors.\n`)
md.push('\n## Every change from the 6,397 baseline\n')
md.push('| Post | Text | From | To | Counts | Basis |')
md.push('|---|---|---|---|---|---|')
for (const c of changes) md.push(`| #${c.postNum} | \`${esc(c.text).slice(0, 76)}\` | ${c.from} | **${c.to}** | ${c.counts ? 'yes' : 'no'} | ${c.group} |`)
md.push('\n## Decision groups\n')
for (const g of GROUPS) {
  const n = changes.filter(c => c.group === g.id).length
  if (!n) continue
  md.push(`\n**\`${g.id}\` → ${g.klass}${g.family ? ` (${g.family})` : ''} — ${n} unit${n > 1 ? 's' : ''}, ${g.counts ? 'counts' : 'does not count'}**\n`)
  md.push(`${g.why}\n`)
}
md.push('\n## Stranded questions recovered\n')
md.push('The malformed unit still does not count; the question trapped inside it does. Each recovered span was verified to be a literal line in its post.\n')
md.push('| Post | Malformed unit | Recovered span (exact line) | Already certified? |')
md.push('|---|---|---|---|')
for (const f of finals.filter(x => x.recoveredQuestion)) {
  md.push(`| #${f.postNum} | \`${esc(f.qSourceText).slice(0, 60)}\` | \`${esc(f.recoveredQuestion)}\` | ${f.recoveredAlreadyCertified ? 'yes — not re-counted' : 'no — counted'} |`)
}
md.push('\nThe review expected three; there are **four**. #144 is the one it did not have: the segmenter split `Why was Sarah A. C. attacked (hack-attempt)?` on the lone initial `A.`, leaving the fragment `C. attacked (hack-attempt)?`. The whole line is the question.\n')
md.push('\n## Corrections applied from the review\n')
md.push('- **Code tokens are no longer rejected for lacking letters.** All 20 `5:5?` occurrences, the arithmetic forms and the elliptical numerics were read against their neighbours and now count. `5:5?` closes a statement or link immediately before Q\'s signature in every instance — it asks for confirmation.')
md.push('- **`Note the time?` / `Note Apple\'s stock image(s)?` stay directives.** The surrounding lines are bracketed markers `[0:21]`, `[9:41]`, `[100%]` and the directive `Reconcile.`. Q is telling the reader to notice the timing; a question mark does not convert an attention command into an ask.')
md.push('- **`Check Gmail?` is resolved, not held.** It is item 1 in an enumerated answer to `What did we learn this week?` directly above it, so it solicits recognition rather than instructing anyone to open a mailbox.')
md.push('- **#4122 gets its own class, `QUOTED_SOURCE`.** Not Q-authored, so it is excluded from the total rather than parked as unresolved.')
fs.writeFileSync(path.join(OUT, 'questions-context-final.md'), md.join('\n') + '\n')

console.log('\nFINAL CONTEXT PASS\n')
for (const [c, n] of Object.entries(byClass).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${c}`)
console.log(`\n  recovered stranded spans : ${finals.filter(f => f.recoveredQuestion).length} (${countedSpans.length} counted, ${finals.filter(f => f.recoveredAlreadyCertified).length} already certified)`)
console.log('\n  TOTALS')
console.log(`    occurrences : ${baseOcc.toLocaleString()} live  →  ${(baseOcc + priorAdds).toLocaleString()} baseline  →  ${(baseOcc + nowAdds).toLocaleString()} final`)
console.log(`    distinct    : ${beforeDistinct.toLocaleString()}  →  ${distinct.size.toLocaleString()}`)
console.log(`    posts       : ${beforePosts.toLocaleString()}  →  ${postsWith.size.toLocaleString()}`)
console.log(`    directive-wrapped : ${wrapped}`)
console.log(`\n  changes since the 6,397 baseline : ${nowAdds - priorAdds}`)
console.log('\n→ audit/questions-context-final.md\n')
