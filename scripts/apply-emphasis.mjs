// Apply the certified Emphasis dataset — the eighth and final certified section.
//
// A presentation layer: HOW Q draws attention, never what the post is about and never whether
// the highlighted material means anything. Two rules keep it from becoming the catch-all that
// every other section avoided being, and both are read off the corpus rather than declared:
//
//   1. Capitals are emphatic only where they CONTRAST — with the line around them, and with the
//      word's own usual spelling. DECLAS is 90/95 capitals across the corpus, so its capitals
//      are how the word is spelled; FAKE is 207/284, so its capitals are a choice.
//   2. Parallel phrasing needs a repeated rhetorical pattern, not a shared first word. The
//      detector counts RUNS, because a five-line cascade is one device a reader perceives once.
//
// CROSS-SECTION OVERLAP IS INTENTIONAL. A repeated question is counted once here as a stylistic
// fact and once in Questions as a unit, cross-linked and never double-counted within a section —
// the same arrangement as the 228 Question<->Directive and 32 Codes<->Entities overlaps.
//
// The 245 cases where the device is arguable are NOT forced into the count. They route to the
// Resolution Center, which is what it was built for.
//
//   node scripts/apply-emphasis.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EMPHASIS_TYPES, EMPHASIS_NOTE } from './lib/emphasis.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const dry = process.argv.includes('--dry')

const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'emphasis-audit.json'), 'utf8'))
const queue = JSON.parse(fs.readFileSync(path.join(OUT, 'emphasis-borderline.json'), 'utf8'))

// ── Owner rulings ────────────────────────────────────────────────────────────
// emphasis-audit.json is written by audit-emphasis.mjs, a DERIVE step, so a ruling written into
// it survives only until the next audit run. Rulings live in their own canonical file and merge
// here, exactly as Claims do through claims-final.json and Themes through themes-owner-rulings.
//
// The ACROSTIC device: Q brackets individual letters so they spell an acronym across a line —
// "[N]othing [C]an [S]top [W]hat [I]s [C]oming". The caps detector cannot see it, because the
// letters are not capitalised for contrast and the brackets read as notation.
const ERULES = path.join(OUT, 'emphasis-owner-rulings.json')
const ownerEmphasis = fs.existsSync(ERULES) ? JSON.parse(fs.readFileSync(ERULES, 'utf8')).rulings ?? [] : []
let ownerAdded = 0
for (const r of ownerEmphasis) {
  if (audit.found.some(f => f.postNum === r.postNum && String(f.line ?? f.sourceText).trim() === r.sourceText)) continue
  audit.found.push({
    postNum: r.postNum,
    postId: r.postId ?? String(r.postNum),
    type: 'acrostic',
    sourceText: r.sourceText,
    line: r.sourceText,
    basis: `bracketed letters spell ${r.spells}`,
    provenance: `owner ruling ${r.ruledOn} — ${r.reasoning}`,
  })
  ownerAdded++
}
// Owner WITHDRAWALS: detector rows the owner has ruled out. Removed by postNum + exact text, so
// the same wording certified in another drop is untouched — occurrence identity, again.
const withdrawn = fs.existsSync(ERULES) ? JSON.parse(fs.readFileSync(ERULES, 'utf8')).withdrawn ?? [] : []
const withdrawnKeys = new Set(withdrawn.map(w => `${w.postNum}|${w.sourceText}`))
let ownerRemoved = 0
for (let i = audit.found.length - 1; i >= 0; i--) {
  const f = audit.found[i]
  if (withdrawnKeys.has(`${f.postNum}|${String(f.sourceText).trim()}`)) { audit.found.splice(i, 1); ownerRemoved++ }
}
// ── OWNER RULE 2026-08-14: a question is not also an Emphasis ────────────────
// A span certified as a Question does not additionally carry Emphasis. Applied as a RULE rather
// than 104 individual withdrawals so it keeps holding as Questions change: any occurrence whose
// wording matches a certified question in the same post is dropped. This retires the
// repeated_question device entirely (95) plus 9 repeated_word rows that were questions.
const certifiedQs = new Map()
for (const q of JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))) {
  if (q.occurrences === undefined) continue
  const k = q.postNum
  if (!certifiedQs.has(k)) certifiedQs.set(k, new Set())
  certifiedQs.get(k).add(String(q.text).toLowerCase().replace(/\s+/g, ' ').trim())
}
let questionRule = 0, questionRuleParallel = 0, questionRuleInside = 0
// A line CONTAINS a certified question when one of that post's questions appears inside it.
// Only that post's questions are considered — the same occurrence-identity rule the whole archive
// runs on, so a question asked in one drop never retires an emphasis in another.
const questionInside = (lineNorm, qs) => {
  for (const q of qs) if (q.length > 3 && lineNorm.includes(q)) return true
  return false
}
const qnorm = t => String(t).toLowerCase().replace(/\s+/g, ' ').trim()
for (let i = audit.found.length - 1; i >= 0; i--) {
  const f = audit.found[i]
  const qs = certifiedQs.get(f.postNum)
  if (qs?.has(qnorm(f.sourceText))) { audit.found.splice(i, 1); questionRule++; continue }

  // A parallel run whose every line is a certified question is a set of questions, and the owner
  // ruled that a question is a question rather than an Emphasis. This half of the rule has to
  // look at `line`, not `sourceText`: a parallel row's sourceText is a LABEL — "why …" — so
  // matching sourceText alone missed 480 runs while catching the 104 whose span WAS the question.
  // A run that mixes questions with other lines is untouched; the device there is genuinely the
  // structure rather than the questions.
  if (f.type === 'parallel_phrasing' && qs) {
    const lines = String(f.line).split(' / ').map(l => l.trim()).filter(Boolean)
    if (lines.length && lines.every(l => qs.has(qnorm(l)))) {
      audit.found.splice(i, 1); questionRuleParallel++; continue
    }
  }

  // ── OWNER RULE, extended 2026-08-14 ────────────────────────────────────────
  //
  // "I do not want the archives side or the post analysis side to have any emphasis connected to
  // a question. I want the question to be highlighted with its natural color. App wide."
  //
  // The two clauses above only catch an occurrence whose SPAN is a question, or a run every line
  // of which is one. They miss the shape the owner actually kept finding: a CAPS word, a quoted
  // word or a bracket sitting INSIDE a question line. Suppressing the paint was not enough,
  // because the analysis panel lists an Emphasis row by its LINE — so #5 displayed two whole
  // questions under "Emphasis" while the drop itself painted them blue.
  //
  // Containment, not equality: #5's line is "Why did Soros transfer his bulk public funds to a
  // NP? Note this doesn't include massive slush funds…" — a certified question plus a second
  // sentence, so it matches no question exactly and survived every earlier clause.
  //
  // Brackets lose nothing by this: [ Brackets ] is its own certified section, so a bracket inside
  // a question still lists there and still paints red in front of everything.
  if (!qs) continue
  const anyLine = String(f.line ?? '').split(' / ').map(l => l.trim()).filter(Boolean)
  if (anyLine.some(l => qs.has(qnorm(l)) || questionInside(qnorm(l), qs))) {
    audit.found.splice(i, 1); questionRuleInside++
  }
}

audit.found.sort((a, b) => a.postNum - b.postNum)

// Certified occurrences, carrying the structural evidence that justified each one. For parallel
// phrasing the `basis` is the whole argument for counting it — "4 consecutive lines in one
// frame", "mirrored construction — 60% of positions identical" — so it ships with the row.
const occurrences = audit.found.map((f, i) => ({
  id: `emph-${f.postNum}-${i}`,
  postNum: f.postNum,
  postId: f.postId,
  type: f.type,
  sourceText: f.sourceText,
  line: f.line,
  basis: f.note ?? null,
  provenance: f.provenance,
}))

const byType = {}
for (const o of occurrences) byType[o.type] = (byType[o.type] ?? 0) + 1
const postsWith = new Set(occurrences.map(o => o.postNum))

const out = {
  certified: true,
  note: EMPHASIS_NOTE,
  totals: {
    occurrences: occurrences.length,
    posts: postsWith.size,
    byType,
    unresolved: queue.count,
    excluded: audit.totals.excluded,
  },
  typeInfo: EMPHASIS_TYPES,
  occurrences,
}

// ── QA gate — executable assertions, not claims in a report ──────────────────
const CERTIFIED_BY_TYPE = {
  caps_emphasis: 1555,
  // ACROSTIC — a tenth device, added by owner ruling on 2026-08-14 rather than by the detector.
  // Q brackets individual letters so they spell an acronym across the line: "[N]othing [C]an
  // [S]top [W]hat [I]s [C]oming" (NCSWIC), "Operations --> [N]o [S]uch [A]gency", "[C]los[I]ng
  // [A]ct:", and LDR spelled across a full sentence in #150. The caps detector is blind to it —
  // the letters are not capitalised for contrast, and the brackets read as notation, so all four
  // sat unclassified in every section. Bracketed ABBREVIATIONS ([D], [F]) are a different device
  // and stay excluded; see audit/emphasis-owner-rulings.json.
  acrostic: 3,
  parallel_phrasing: 591,
  bracket_emphasis: 409,
  quoted_word: 285,
  punctuation_intensity: 149,
  repeated_word: 108,
  // Retired by the owner rule: a question is not also an Emphasis.
  repeated_question: 0,
  repeated_directive: 11,
  deliberate_spacing: 1,
}
const subtypeSum = Object.values(CERTIFIED_BY_TYPE).reduce((a, b) => a + b, 0)
// (byType[k] ?? 0): a retired device has no key at all, and undefined !== 0 would read as drift.
const mismatched = Object.entries(CERTIFIED_BY_TYPE).filter(([k, n]) => (byType[k] ?? 0) !== n)

// Nothing may be counted that a reader cannot point at on the page.
const noEvidence = occurrences.filter(o => !o.sourceText || !String(o.line).trim())
const parallelNoBasis = occurrences.filter(o => o.type === 'parallel_phrasing' && !o.basis)

// The queue must hold every deliberately unresolved case, and none of them may also be counted.
//
// Keyed on the OCCURRENCE, not on post + word. The borderline-caps rule is occurrence-specific
// by design: in #142 "FED" is emphasis inside "Who controls the FED?" — lowercase prose, so the
// capitals stand out — and a judgement call inside "What is the FED?". The same word can
// legitimately be counted in one line of a drop and queued in another.
const queuedKeys = new Set(queue.items.map(q => `${q.postNum}|${q.sourceText}|${q.line}`))
const leaked = occurrences.filter(o => queuedKeys.has(`${o.postNum}|${o.sourceText}|${o.line}`))

const checks = [
  // 5,251 detected + 4 owner acrostic rulings (#4951 NCSWIC, #129 NSA, #129 CIA, #150 LDR).
  // Both halves asserted so a lost ruling fails here instead of silently reverting to 5,251.
  // 5,251 detected, less 1 owner withdrawal (#4742 [barrage] — a bracketed item, not a device).
  // 5,251 detected, less 1 owner withdrawal and 104 rows retired by the question rule.
  ['detected occurrences = 3,109', occurrences.length - ownerAdded === 3109, occurrences.length - ownerAdded],
  ['question rule retired 104 rows', questionRule === 104, questionRule],
  ['question rule retired 479 parallel runs', questionRuleParallel === 479, questionRuleParallel],
  // Per-post, not corpus-wide: a question asked in one drop never retires an emphasis in another.
  ['question rule retired 1,555 rows inside questions', questionRuleInside === 1555, questionRuleInside],
  ['owner withdrawals applied = 4', ownerRemoved === 4, ownerRemoved],
  ['owner acrostic rulings applied = 3', ownerAdded === 3, ownerAdded],
  ['certified occurrences = 3,112', occurrences.length === 3112, occurrences.length],
  ['posts = 1,357', postsWith.size === 1357, postsWith.size],
  ['subtype totals reconcile exactly', mismatched.length === 0 && subtypeSum === occurrences.length,
    `${mismatched.length} mismatched, sum ${subtypeSum}`],
  ['no subtype outside the certified ten', Object.keys(byType).every(k => k in CERTIFIED_BY_TYPE),
    Object.keys(byType).length],
  ['unresolved queue = 245', queue.count === 245, queue.count],
  ['queued cases stay out of the certified count', leaked.length === 0, `${leaked.length} leaked`],
  ['every occurrence points at visible text', noEvidence.length === 0, `${noEvidence.length} without`],
  ['every parallel occurrence states its basis', parallelNoBasis.length === 0, `${parallelNoBasis.length} unstated`],
  ['quoted-source lines stay excluded', audit.totals.excluded.quotedSource === 932, audit.totals.excluded.quotedSource],
  ['ALL CAPS baseline register stays excluded', audit.totals.excluded.capsBaseline === 7839, audit.totals.excluded.capsBaseline],
  ['always-capitalised words stay excluded', audit.totals.excluded.alwaysCaps === 1239, audit.totals.excluded.alwaysCaps],
  ['certified codes stay excluded from caps', audit.totals.excluded.alreadyACode === 555, audit.totals.excluded.alreadyACode],
  ['weak parallel runs stay excluded', audit.totals.excluded.weakParallel === 210, audit.totals.excluded.weakParallel],
  ['every occurrence carries provenance', occurrences.every(o => o.provenance), 'ok'],
]

// The seven previously certified sections must be untouched by this step.
const FROZEN = [
  ['questions.json', 'questions'], ['claims.json', 'claims'], ['evidence.json', 'evidence'],
  ['entities.json', 'entities'], ['themes.json', 'themes'], ['codes.json', 'codes'],
]
const frozenSizes = {}
for (const [file] of FROZEN) {
  const p = path.join(DATA, file)
  if (fs.existsSync(p)) frozenSizes[file] = fs.statSync(p).size
}

console.log('\nAPPLY CERTIFIED EMPHASIS\n')
console.log(`  occurrences : ${out.totals.occurrences.toLocaleString()}`)
console.log(`  posts       : ${out.totals.posts.toLocaleString()}`)
console.log(`  unresolved  : ${queue.count} routed to /resolve`)
console.log('\n  by type:')
for (const t of EMPHASIS_TYPES) if (byType[t.key]) console.log(`    ${String(byType[t.key]).padStart(5)}  ${t.label}`)
console.log('\n  QA GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(46)} ${got}`) }
if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: emphasis.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'emphasis.json'), JSON.stringify(out))

// The app reads certified emphasis from emphasis.json, but postAnalysis.emphasis is what the
// per-post view and the month charts have always used. Rewriting it here from the certified rows
// is the same discipline the other seven sections follow: the UI never re-derives a category
// after it is certified, or the two definitions drift apart — which is exactly how Questions
// once shipped 6,299 against a certified 6,442.
const postsFile = path.join(DATA, 'posts.json')
const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'))
// RENDERING_PROVENANCE_RULE. A parallel-phrasing occurrence's sourceText is a DISPLAY LABEL —
// "what …", "why …" — naming the shared opener of a run. It is not text in the drop, so all
// 1,111 of them could never highlight. The literal run lines live on `line`, joined with " / ",
// so the renderer gets those instead. The label stays on the certified occurrence for display.
const byPost = new Map()
for (const o of occurrences) {
  if (!byPost.has(o.postNum)) byPost.set(o.postNum, [])
  // ACROSTIC renders as the BRACKETS, not the sentence containing them.
  //
  // The certified occurrence is the whole line, because the device is the line — but painting the
  // line is wrong. #150 spreads [L] [d] [R] across two sentences that are already a Prediction and
  // a Claim, so highlighting the container put a second layer over every word of both and the
  // reader saw the entire drop flashing between three colours. The owner's rule: only the
  // pertinent span carries the colour, and overlaps rotate only where spans genuinely overlap.
  //
  // Same split as parallel_phrasing above — one certified occurrence, several literal spans — so
  // the count never moves.
  const spans = o.type === 'parallel_phrasing'
    ? String(o.line).split(' / ').map(l => l.trim()).filter(Boolean)
    : o.type === 'acrostic'
      ? (String(o.sourceText).match(/\[[A-Za-z]\]/g) ?? [o.sourceText])
      : [o.sourceText]
  for (const s of spans) byPost.get(o.postNum).push(s)
}
let patched = 0
for (const p of posts) {
  const list = byPost.get(p.postNum)
  if (!p.postAnalysis) { if (!list) continue; p.postAnalysis = {} }
  p.postAnalysis.emphasis = list ?? []
  patched++
}
fs.writeFileSync(postsFile, JSON.stringify(posts))

for (const [file] of FROZEN) {
  if (frozenSizes[file] !== undefined && fs.statSync(path.join(DATA, file)).size !== frozenSizes[file]) {
    console.error(`\n❌ ${file} changed during the Emphasis apply. Certified sections must stay frozen.\n`)
    process.exit(1)
  }
}

console.log(`\nwrote public/data/emphasis.json, ${patched.toLocaleString()} posts patched`)
console.log('   six previously certified datasets verified unchanged\n')
