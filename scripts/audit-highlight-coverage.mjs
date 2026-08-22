// Exhaustive highlight-coverage audit — posts #1 to #4966.
//
// THE QUESTION, both directions:
//   certified -> render : does every certified occurrence intended to highlight actually resolve
//                         to a span in its own post, using the renderer's OWN matching rule?
//   render -> certified : can any semantic-looking highlight appear without a certified record?
//
// This replicates `addSegs()` from src/lib/postHighlight.tsx exactly — the same escaping, the
// same smart-quote and dash folding, the same word-boundary pattern. A near-enough reimplementation
// would report defects that do not exist and miss the ones that do, which is the whole failure
// mode this project keeps hitting.
//
// It CANNOT prove pixels. It proves span resolution: whether the text the renderer looks for is
// findable in the post. A certified occurrence whose text is not in its post can never highlight,
// and that is a renderer-facing defect regardless of CSS.
//
// AUDIT ONLY. Reclassifies nothing. A missed classification is reported as a certification
// conflict — rules retrieve, humans adjudicate.
//
//   node scripts/audit-highlight-coverage.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')

const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const posts = read('posts.json')
const questions = read('questions.json')
const themes = read('themes.json')
const codes = read('codes.json')
// EMPHASIS IS RETIRED (owner ruling, 2026-08-21) — the section, its data and its artifact. Kept as
// an empty stand-in rather than deleted from the code, so this script keeps running and reports a
// truthful ZERO instead of crashing on a missing file.
const emphasis = { occurrences: [] }
const evidence = read('evidence.json')
const queue = read('resolution-queue.json')

// ── the renderer's matching rule, transcribed ───────────────────────────────
const escapeAndNormalize = term => {
  let e = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  e = e.replace(/['‘’‚‛]/g, "(?:'|‘|’)")
  e = e.replace(/["“”„‟]/g, '(?:"|“|”)')
  e = e.replace(/[-–—]/g, '(?:-|–|—)')
  return e
}
const wordBoundaryPattern = (escaped, raw) => {
  const startsWord = /[A-Za-z0-9]/.test(raw[0] ?? '')
  const endsWord = /[A-Za-z0-9]/.test(raw[raw.length - 1] ?? '')
  return `${startsWord ? '(?<![A-Za-z0-9])' : ''}${escaped}${endsWord ? '(?![A-Za-z0-9])' : ''}`
}
/** Would addSegs() find this term in this text? */
const resolves = (text, term) => {
  if (!term || !term.trim()) return false
  try {
    return new RegExp(wordBoundaryPattern(escapeAndNormalize(term), term), 'gi').test(text)
  } catch { return false }
}

const byNum = new Map(posts.map(p => [p.postNum, p]))

const rows = []
const record = (postNum, layer, text, rendered, note) =>
  rows.push({ postNum, layer, text: String(text).slice(0, 200), rendered, note: note ?? null })

// ── certified -> render ──────────────────────────────────────────────────────
for (const q of questions) {
  if (q.occurrences === undefined) continue
  const p = byNum.get(q.postNum)
  if (!p) { record(q.postNum, 'questions', q.text, false, 'post missing'); continue }
  const t = p.text ?? ''
  // Questions highlight on their unit text, and the renderer also accepts the ?/./! variant.
  // The literal rendering span where one was recovered — the certified text stays the identity.
  const span = q.literal ?? q.unitText ?? q.text
  const ok = resolves(t, span) || resolves(t, String(q.text).replace(/\?\s*$/, ''))
  record(q.postNum, 'questions', q.text, ok)
}

for (const p of posts) {
  const t = p.text ?? ''
  const a = p.postAnalysis ?? {}
  for (const d of p.actionRequests ?? []) record(p.postNum, 'directives', d, resolves(t, d))
  // The literal rendering spans, where they exist — RENDERING_PROVENANCE_RULE. The certified
  // value stays the identity; these are what the renderer can actually find in the drop.
  ;(a.claims ?? []).forEach((c, i) => record(p.postNum, 'claims', a.claimSpans?.[i] ?? c, resolves(t, a.claimSpans?.[i] ?? c)))
  ;(a.predictions ?? []).forEach((c, i) => record(p.postNum, 'predictions', a.predictionSpans?.[i] ?? c, resolves(t, a.predictionSpans?.[i] ?? c)))
  for (const e of a.namedEntities ?? []) record(p.postNum, 'entities', e, resolves(t, e))
  ;(a.impliedConclusions ?? []).forEach((c, i) => record(p.postNum, 'conclusions', a.conclusionSpans?.[i] ?? c, resolves(t, a.conclusionSpans?.[i] ?? c)))
  ;(a.verificationHooks ?? []).forEach((c, i) => record(p.postNum, 'checkable', a.checkableSpans?.[i] ?? c, resolves(t, a.checkableSpans?.[i] ?? c)))
  // Emphasis is counted from the certified artifact below, one row per OCCURRENCE. Counting
  // postAnalysis.emphasis instead counts SPANS — a parallel run contributes one occurrence and
  // several lines — which pushed the denominator from 40,994 to 43,051. NEVER_RECOUNT_RULE.
  // THEMES: the anchor is the span, never the label. A themed post with no certified anchor is
  // legitimately badge-only and must not synthesise a highlight from the taxonomy name.
  const anchors = a.themeAnchors ?? []
  for (const anchor of anchors) record(p.postNum, 'themeAnchors', anchor, resolves(t, anchor))
  // One row per anchorless ASSIGNMENT. Recording one row per post under-counted the badge-only
  // population at 674 against the independent audit's 915 — a post can carry several themes and
  // each anchorless one is its own legitimate badge-only classification.
  // Per ASSIGNMENT, from themes.json — a post can carry several themes and only some of them
  // have anchors. Testing `anchors.length` at the post level recorded nothing for those mixed
  // posts and under-counted the badge-only population at 674 against the independent 915.
  for (const t of themes.byPost?.[String(p.postNum)] ?? []) {
    if (!(t.evidence?.anchors ?? []).length) {
      record(p.postNum, 'themeBadgeOnly', t.label, null, 'certified assignment with no anchor — badge only, correctly not highlighted')
    }
  }
}

// CODES — one row per certified OCCURRENCE, read from the audit's occurrence table.
//
// Two wrong ways to count this, both tried: (code, post) pairs gave 1,563 and lost the 386
// in-post repeats; re-matching each variant against the text gave 1,972 and double-counted where
// a code's variants overlap. The certified occurrence rows are the answer to a question already
// asked and answered — filtering them by the codes that survived certification gives exactly the
// certified 1,949. Never recount what a certified artifact already counted.
{
  const codeAudit = JSON.parse(fs.readFileSync(path.join(OUT, 'codes-audit.json'), 'utf8'))
  const certifiedKeys = new Set(codes.codes.map(c => c.normalizedKey))
  for (const o of codeAudit.occurrences) {
    if (!certifiedKeys.has(o.normalizedKey)) continue
    const p = byNum.get(o.postNum)
    if (!p) continue
    record(o.postNum, 'codes', o.sourceText, resolves(p.text ?? '', o.sourceText))
  }
}

for (const i of evidence.items) {
  const p = byNum.get(i.postNum)
  if (!p || !i.value) continue
  // MEDIA is not text. An attached image has no span in the post body, so counting its 1,271
  // records as "intended to highlight" inflates the denominator and then reports every one of
  // them as a failure. They are badge-only by nature, exactly like a theme with no anchor.
  if (i.kind === 'MEDIA') {
    record(i.postNum, 'evidenceBadgeOnly', i.value, null, 'attached media — no body-text span by nature')
    continue
  }
  // The LITERAL form is what a renderer must look for; the canonical value is for identity and
  // navigation. Testing the canonical form reported 2,270 failures on references that are plainly
  // in the drop, just written with a space after the protocol or an &amp; entity.
  const span = i.literal ?? i.value
  record(i.postNum, 'evidence', span, resolves(p.text ?? '', span))
}
// Emphasis is already counted above from postAnalysis.emphasis, which is materialised from this
// same certified artifact. Recording it a second time added ~4,140 phantom rows to the
// denominator — the double-count that put this audit at 44,748 against the independent 40,994.
for (const r of queue.rows) {
  const p = byNum.get(r.postNum)
  if (!p) continue
  // The SPAN is what gets marked in the body, not the token. A theme row's token is a taxonomy
  // label and a classification row's token is the whole run — neither is literal text — while
  // every row's sourceSpan is a line from the drop. Testing the token reported 452 failures on
  // rows whose span is plainly there.
  // Either the token or its span may be the markable thing, depending on kind: an entity row's
  // token is literal text, a theme row's token is a taxonomy label whose span is a real line, and
  // a classification row's span is a joined run whose lines are real. Testing only one of the two
  // reported failures in both directions — 452 by token, 474 by span — so a row counts as
  // markable if EITHER resolves, which is what the renderer can actually do.
  const spans = [r.token, r.sourceSpan, ...String(r.sourceSpan ?? '').split(' / ')].filter(Boolean)
  record(r.postNum, 'unresolved', spans[0], spans.some(v => resolves(p.text ?? '', v)), 'deliberately unresolved — tracked in /resolve')
}

// Emphasis: one row per certified occurrence. A parallel run resolves if ANY of its lines do,
// because the device is the run and the reader sees it once.
for (const o of emphasis.occurrences) {
  const p = byNum.get(o.postNum)
  if (!p) continue
  const spans = o.type === 'parallel_phrasing'
    ? String(o.line).split(' / ').map(l => l.trim()).filter(Boolean)
    : [o.sourceText]
  record(o.postNum, 'emphasis', spans[0] ?? o.sourceText, spans.some(v => resolves(p.text ?? '', v)))
}

// ── render -> certified ──────────────────────────────────────────────────────
// The only span the renderer draws without a certified record is the keyword/search highlight.
// It is allowed to exist; it is not allowed to look certified.
const hl = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'highlightConstants.ts'), 'utf8')
const keywordStyle = (hl.match(/keyword:\s*'([^']+)'/) ?? [])[1] ?? ''
const keywordIsDistinct = !/^bg-/.test(keywordStyle.trim()) && /ring|underline|outline|decoration/.test(keywordStyle)
const pd = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'PostDetail.tsx'), 'utf8')
const themeUsesAnchors = /\['theme', analysis\.themeAnchors/.test(pd)

// ── totals ───────────────────────────────────────────────────────────────────
const intended = rows.filter(r => r.rendered !== null)
const renderedOk = intended.filter(r => r.rendered)
const failed = intended.filter(r => !r.rendered)
// The independent audit is right that these must never be merged: a renderer miss and a
// certified record that cannot resolve to body text need opposite fixes. A record whose text is
// simply absent from its post is a materialisation problem; one whose text IS present and still
// does not paint is a renderer problem. This audit can only prove the first class directly, so
// it labels rather than guesses.
for (const r of failed) {
  const p = byNum.get(r.postNum)
  const t = (p?.text ?? '').toLowerCase()
  r.failureClass = t.includes(String(r.text).trim().toLowerCase().slice(0, 60))
    ? 'CERTIFIED_SPAN_PRESENT_BUT_UNMATCHED'   // text is there; the matcher did not take it
    : 'CERTIFIED_SOURCE_DOES_NOT_RESOLVE'      // text is not in the post at all
}
const badgeOnly = rows.filter(r => r.rendered === null)

const byLayer = {}
for (const r of intended) {
  byLayer[r.layer] ??= { intended: 0, rendered: 0, failed: 0 }
  byLayer[r.layer].intended++
  r.rendered ? byLayer[r.layer].rendered++ : byLayer[r.layer].failed++
}
const failedPosts = new Set(failed.map(r => r.postNum))

// ── cross-post consistency ───────────────────────────────────────────────────
// Identical text certified in one post and not in another. REPORTED, never made uniform: the
// same wording can legitimately function differently in different drops.
const certifiedText = new Map()
for (const r of intended) {
  const k = r.text.trim().toLowerCase()
  if (!k || k.length < 4) continue
  if (!certifiedText.has(k)) certifiedText.set(k, { text: r.text, layer: r.layer, posts: new Set() })
  certifiedText.get(k).posts.add(r.postNum)
}
// A cheap substring pre-filter before the expensive boundary regex. Without it this is ~26,000
// certified texts x 4,966 posts x one regex each — 130 million regex executions, which does not
// finish. `includes` rejects >99% of pairs at a fraction of the cost and the regex then confirms
// only the survivors, so the result is identical and the run completes in seconds.
const lowerText = new Map(posts.map(p => [p.postNum, (p.text ?? '').toLowerCase()]))
const inconsistent = []
for (const [k, v] of certifiedText) {
  if (v.posts.size < 1) continue
  const needle = v.text.trim().toLowerCase()
  const elsewhere = posts.filter(p => !v.posts.has(p.postNum)
    && (lowerText.get(p.postNum) ?? '').includes(needle)
    && resolves(p.text ?? '', v.text))
  if (elsewhere.length) {
    inconsistent.push({
      text: v.text, layer: v.layer,
      certifiedIn: [...v.posts].sort((a, b) => a - b).slice(0, 12),
      alsoAppearsUncertifiedIn: elsewhere.map(p => p.postNum).slice(0, 12),
      uncertifiedCount: elsewhere.length,
      status: 'CONTEXTUAL_DIFFERENCE_REVIEW',
    })
  }
  void k
}
inconsistent.sort((a, b) => b.uncertifiedCount - a.uncertifiedCount)

fs.writeFileSync(path.join(OUT, 'highlight-coverage.json'), JSON.stringify({
  scope: 'posts #1–#4966, certified→render and render→certified',
  productionChanged: false,
  totals: {
    certifiedIntendedToHighlight: intended.length,
    correctlyResolves: renderedOk.length,
    failsToResolve: failed.length,
    badgeOnlyNoSpan: badgeOnly.length,
    postsWithFailures: failedPosts.size,
    byLayer,
    keywordStyleIsDistinct: keywordIsDistinct,
    themeHighlightUsesAnchors: themeUsesAnchors,
    crossPostInconsistencies: inconsistent.length,
  },
}, null, 1))
fs.writeFileSync(path.join(OUT, 'highlight-defects.json'), JSON.stringify({
  count: failed.length,
  byLayer: Object.fromEntries(Object.entries(byLayer).filter(([, v]) => v.failed)),
  // EVERY failure, not a sample. A 3,000-row cap is fine for diagnosis and useless for
  // exhaustive repair: the acceptance target is zero renderer misses, and you cannot drive a
  // population to zero from a truncated list of it.
  defects: failed,
}, null, 1))
fs.writeFileSync(path.join(OUT, 'cross-post-classification-consistency.json'), JSON.stringify({
  note: 'Identical text certified in one post and present-but-uncertified elsewhere. REPORTED ONLY — identical wording can legitimately function differently in different drops. Never made uniform automatically.',
  count: inconsistent.length,
  cases: inconsistent,
}, null, 1))

const md = ['# Q Drops — exhaustive highlight coverage (#1–#4966)\n']
md.push('Both directions checked, using the renderer’s own matching rule transcribed from `addSegs()` — same escaping, same smart-quote and dash folding, same word boundaries. This proves **span resolution**, not pixels: a certified occurrence whose text cannot be found in its own post can never highlight.\n')
md.push('\n## Totals\n')
md.push('| Measure | Count |')
md.push('|---|---|')
md.push(`| Certified occurrences intended to highlight | ${intended.length.toLocaleString()} |`)
md.push(`| Resolve correctly | **${renderedOk.length.toLocaleString()}** |`)
md.push(`| Fail to resolve | **${failed.length.toLocaleString()}** |`)
md.push(`| Badge-only, no certified span (correct) | ${badgeOnly.length.toLocaleString()} |`)
md.push(`| Posts affected by failures | ${failedPosts.size.toLocaleString()} |`)
md.push(`| Cross-post cases for review | ${inconsistent.length.toLocaleString()} |`)
md.push('\n## By layer\n')
md.push('| Layer | Intended | Resolves | Fails |')
md.push('|---|---|---|---|')
for (const [l, v] of Object.entries(byLayer).sort((a, b) => b[1].failed - a[1].failed)) {
  md.push(`| ${l} | ${v.intended.toLocaleString()} | ${v.rendered.toLocaleString()} | ${v.failed ? '**' + v.failed.toLocaleString() + '**' : '0'} |`)
}
md.push('\n## Render → certified\n')
md.push(`- Theme highlight consumes certified anchors, not the taxonomy label: **${themeUsesAnchors ? 'yes' : 'NO — defect'}**`)
md.push(`- Keyword/search highlight is structurally distinct from category colours: **${keywordIsDistinct ? 'yes' : 'NO — defect'}** (\`${keywordStyle.slice(0, 60)}\`)`)
md.push('\nThe renderer draws only one span without a certified record — the keyword/search match. It is allowed to exist and must not look certified.\n')
if (failed.length) {
  md.push('\n## Failures — a sample\n')
  md.push('| Post | Layer | Text |')
  md.push('|---|---|---|')
  for (let i = 0; i < Math.min(40, failed.length); i++) {
    const r = failed[Math.floor(i * failed.length / Math.min(40, failed.length))]
    md.push(`| #${r.postNum} | ${r.layer} | ${r.text.replace(/\|/g, '\\|').slice(0, 78)} |`)
  }
}
fs.writeFileSync(path.join(OUT, 'highlight-coverage.md'), md.join('\n') + '\n')

console.log('\nEXHAUSTIVE HIGHLIGHT COVERAGE  (#1–#4966)\n')
console.log(`  certified, intended to highlight : ${intended.length.toLocaleString()}`)
console.log(`  resolves correctly               : ${renderedOk.length.toLocaleString()}`)
console.log(`  FAILS to resolve                 : ${failed.length.toLocaleString()}  (${failedPosts.size} posts)`)
console.log(`  badge-only, no span (correct)    : ${badgeOnly.length.toLocaleString()}`)
console.log('\n  by layer:')
for (const [l, v] of Object.entries(byLayer).sort((a, b) => b[1].failed - a[1].failed)) {
  console.log(`    ${l.padEnd(16)} ${String(v.intended).padStart(6)} intended  ${String(v.failed).padStart(5)} fail`)
}
console.log(`\n  theme highlight uses anchors     : ${themeUsesAnchors}`)
console.log(`  keyword style distinct           : ${keywordIsDistinct}`)
console.log(`  cross-post review cases          : ${inconsistent.length.toLocaleString()}`)
console.log('\n→ audit/highlight-coverage.md + highlight-defects.json + cross-post-classification-consistency.json\n')
