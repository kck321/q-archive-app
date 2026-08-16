// SOURCE SPANS v2 — downstream consumer impact matrix.
//
// SHADOW MODE. Migrates nothing. Answers one question per consumer: if sourceLines() were
// swapped for sourceSpansV2(), how many of that consumer's records sit on a line whose
// provenance verdict moved, and would its CERTIFIED output change?
//
// Run audit-source-spans-v2.mjs first — this reads its diff.
//
//   node scripts/audit-source-spans-v2-consumers.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/source-spans-v2')
const rd = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

const posts = rd('public/data/posts.json')
const byNum = new Map(posts.map(p => [p.postNum, p]))
const diff = rd('audit/source-spans-v2/source-spans-v2-post-diff.json')
const v3 = rd('audit/source-spans-v2/directives-adjudication-v3-shadow.json')
const manifest = rd('audit/certification-manifest.json')

// changed line index: postNum -> Map(lineIndex -> direction)
const changedAt = new Map()
for (const c of diff.changed) {
  if (!changedAt.has(c.postNum)) changedAt.set(c.postNum, new Map())
  changedAt.get(c.postNum).set(c.line, c)
}
// changed lines as folded text, per post, for text-keyed consumers
const changedText = new Map()
for (const c of diff.changed) {
  if (!changedText.has(c.postNum)) changedText.set(c.postNum, [])
  changedText.get(c.postNum).push({ t: c.completeText.toLowerCase(), dir: c.direction, st: c.sourceType })
}
const hitsChangedLine = (postNum, text) => {
  const lines = changedText.get(postNum)
  if (!lines) return null
  const f = String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (!f) return null
  return lines.find(l => l.t.includes(f) || f.includes(l.t)) ?? null
}

// Only the changes that move a record between Q-authored and quoted matter downstream. A
// `>>123456` pointer line reclassified from "unlabelled" to "board pointer" is a definitional
// change on a line that carries no analysable prose, so it is counted separately throughout.
const SEMANTIC = c => c.structure !== 'BOARD_POINTER'
const semanticChanged = diff.changed.filter(SEMANTIC)
const semanticPosts = new Set(semanticChanged.map(c => c.postNum))

const rows = []
const add = r => rows.push(r)

// ── 1. Directives ────────────────────────────────────────────────────────────
{
  const changedRulings = v3.rows.filter(r => r.rulingChanged === 'true')
  add({
    consumer: 'Directives',
    file: 'scripts/audit-directives-v2.mjs · scripts/audit-directives-religious.mjs · scripts/apply-directives.mjs',
    purpose: 'Decides whether a stored actionRequest sits on a Q-authored line or inside a quoted block, and rules on it.',
    records: v3.rows.length,
    potentiallyChanged: changedRulings.length,
    certifiedWouldChange: 'YES',
    pinned: `${manifest.counts.directives} occurrences`,
    projected: `${v3.rows.length} occurrences unchanged; ${v3.rows.filter(r => r.proposedRuling.startsWith('KEEP')).length} KEEP, ${changedRulings.length} rulings move`,
    editorialReview: 'YES — every ruling change is an editorial decision',
    notes: `54 records move REMOVE_QUOTED_OR_THIRD_PARTY → KEEP_Q_DIRECTIVE; 19 previously NOT_LOCATED records now locate; NEEDS_CONTEXT falls 21 → ${v3.rows.filter(r => r.proposedRuling === 'NEEDS_CONTEXT').length}.`,
  })
}

// ── 2. Questions ─────────────────────────────────────────────────────────────
{
  const qs = rd('public/data/questions.json')
  const touched = qs.filter(q => hitsChangedLine(q.postNum, q.unitText ?? q.text))
  add({
    consumer: 'Questions',
    file: 'scripts/audit-all-questions-v2.mjs (FROZEN — carries its own copy of segment.mjs)',
    purpose: 'Excludes quoted/anon lines before extracting question units, so an anon question never becomes Q\'s.',
    records: qs.length,
    potentiallyChanged: touched.length,
    certifiedWouldChange: touched.length ? 'YES' : 'NO',
    pinned: `${manifest.counts.questions} occurrences (${manifest.counts.questionRowsShipped} rows shipped)`,
    projected: `${qs.length - touched.filter(t => t.dir === 'OLD_Q_BODY_TO_NEW_QUOTED').length} … ${qs.length}`,
    editorialReview: touched.length ? 'YES' : 'NO',
    notes: 'FROZEN auditor. It must be unfrozen and re-pointed at segment.mjs before any migration, per its own header.',
  })
}

// ── 3. Claims ────────────────────────────────────────────────────────────────
{
  let total = 0, touched = 0
  for (const p of posts) for (const c of (p.postAnalysis?.claims ?? [])) { total++; if (hitsChangedLine(p.postNum, c)) touched++ }
  add({
    consumer: 'Claims',
    file: 'scripts/audit-claims.mjs (imports sourceLines + unitIsSource)',
    purpose: 'Files a claim as QUOTED_SOURCE instead of a Q assertion when its unit falls inside a source block.',
    records: total, potentiallyChanged: touched,
    certifiedWouldChange: touched ? 'YES' : 'NO',
    pinned: `${manifest.counts.claims} claims`,
    projected: `${manifest.counts.claims} ± ${touched}`,
    editorialReview: touched ? 'YES' : 'NO',
    notes: 'The Declaration/1 Corinthians leak this file was built to stop is unaffected — V2 keeps every scripture and founding-document seed and adds five more.',
  })
}

// ── 4. Codes ─────────────────────────────────────────────────────────────────
{
  const codes = rd('public/data/codes.json')
  let touched = 0
  for (const c of codes.codes) for (const pn of c.posts) if (changedAt.has(pn) && semanticPosts.has(pn)) { touched++; break }
  add({
    consumer: 'Codes',
    file: 'scripts/audit-codes.mjs',
    purpose: 'Skips bracketed tokens that sit on quoted lines so a pasted article\'s brackets never become Q notation.',
    records: codes.totals.occurrences, potentiallyChanged: touched,
    certifiedWouldChange: touched ? 'YES' : 'NO',
    pinned: `${manifest.counts.codes} occurrences, ${codes.totals.distinctCodes} codes`,
    projected: `${manifest.counts.codes} ± ${touched}`,
    editorialReview: touched ? 'YES' : 'NO',
    notes: 'V2 marks 1,626 `>>NNNNNNN` pointer lines as pointers. Those lines carry no bracket tokens, so the practical exposure is the 642 lines moving quoted → Q body.',
  })
}

// ── 5. Emphasis ──────────────────────────────────────────────────────────────
{
  const em = rd('public/data/emphasis.json')
  const touched = em.occurrences.filter(o => hitsChangedLine(o.postNum, o.line ?? o.sourceText)).length
  add({
    consumer: 'Emphasis',
    file: 'scripts/audit-emphasis.mjs',
    purpose: 'Emphasis is only counted on Q-authored lines — a pasted article in caps is not Q shouting.',
    records: em.totals.occurrences, potentiallyChanged: touched,
    certifiedWouldChange: touched ? 'YES' : 'NO',
    pinned: `${manifest.counts.emphasis} occurrences`,
    projected: `${manifest.counts.emphasis} ± ${touched}`,
    editorialReview: touched ? 'YES' : 'NO',
    notes: `Emphasis already excludes ${em.totals.excluded.quotedSource} occurrences as quotedSource. That exclusion set is drawn straight from sourceLines() and is the largest single quantity a migration would move.`,
  })
}

// ── 6. Entities ──────────────────────────────────────────────────────────────
{
  const ent = rd('public/data/entities.json')
  let touched = 0
  for (const e of ent.entities) if ((e.posts ?? []).some(pn => semanticPosts.has(pn))) touched++
  add({
    consumer: 'Entities',
    file: 'scripts/audit-entities.mjs',
    purpose: 'A name inside quoted material is not Q naming it — the source map gates mention attribution.',
    records: ent.totals.mentions, potentiallyChanged: touched,
    certifiedWouldChange: touched ? 'YES' : 'NO',
    pinned: `${manifest.counts.entitiesCanonical} canonical / ${manifest.counts.entitiesMentions} mentions`,
    projected: `${manifest.counts.entitiesCanonical} canonical; mentions ± the ${touched} entities touching a changed post`,
    editorialReview: 'YES — mention counts are published figures',
    notes: 'Counted at ENTITY granularity, not mention granularity: an entity is listed if any of its posts has a semantically changed line.',
  })
}

// ── 7. Themes ────────────────────────────────────────────────────────────────
{
  const th = rd('public/data/themes.json')
  const touched = Object.keys(th.byPost).filter(pn => semanticPosts.has(Number(pn))).length
  add({
    consumer: 'Themes',
    file: 'scripts/audit-themes.mjs',
    purpose: 'Theme anchors are matched against Q-authored lines only.',
    records: th.totals.assignments, potentiallyChanged: touched,
    certifiedWouldChange: touched ? 'YES' : 'NO',
    pinned: `${manifest.counts.themes} assignments across ${th.totals.postsWithAtLeastOne} posts`,
    projected: `${manifest.counts.themes} ± anchors on the ${touched} affected posts`,
    editorialReview: 'YES',
    notes: 'Seed 70 has just shipped the Subject-theme resolutions. A themes re-run must not be started until that deployment is settled.',
  })
}

// ── 8. Themes coverage ───────────────────────────────────────────────────────
{
  const th = rd('public/data/themes.json')
  add({
    consumer: 'Themes coverage',
    file: 'scripts/audit-themes-coverage.mjs',
    purpose: 'Measures the legacy-only theme gap; uses the source map to decide which lines could carry an anchor.',
    records: th.totals.assignments, potentiallyChanged: semanticPosts.size,
    certifiedWouldChange: 'NO — reporting only',
    pinned: 'no pinned count (diagnostic output)',
    projected: 'coverage percentages shift with the 642 quoted → Q body lines',
    editorialReview: 'NO',
    notes: 'Diagnostic. Re-run after Themes, never before.',
  })
}

// ── 9. Source coverage ───────────────────────────────────────────────────────
{
  const cov = rd('audit/source-unit-coverage.json')
  add({
    consumer: 'Source coverage',
    file: 'scripts/audit-source-coverage.mjs',
    purpose: 'Reports which post lines are covered by some certified unit and which are source material.',
    records: cov.totals?.units ?? cov.units?.length ?? 'n/a',
    potentiallyChanged: diff.changed.length,
    certifiedWouldChange: 'NO — reporting only',
    pinned: 'no pinned count (diagnostic output)',
    projected: `every one of the ${diff.changed.length} changed lines re-buckets here by construction`,
    editorialReview: 'NO',
    notes: 'This is the consumer that changes MOST and matters LEAST — it exists to describe the source map, so it moves whenever the source map moves.',
  })
}

// ── 10. Parallel phrasing ────────────────────────────────────────────────────
{
  const em = rd('public/data/emphasis.json')
  const par = em.occurrences.filter(o => o.type === 'parallel_phrasing')
  const touched = par.filter(o => hitsChangedLine(o.postNum, o.line ?? o.sourceText)).length
  add({
    consumer: 'Parallel phrasing',
    file: 'scripts/adjudicate-parallel.mjs',
    purpose: 'Detects repeated grammatical shapes; excludes quoted lines so a pasted list is not read as Q\'s cadence.',
    records: par.length,
    potentiallyChanged: touched,
    certifiedWouldChange: touched ? 'YES (via Emphasis)' : 'NO',
    pinned: `${em.totals.byType.parallel_phrasing} parallel_phrasing occurrences inside the ${manifest.counts.emphasis} emphasis pin`,
    projected: `${par.length} ± ${touched}`,
    editorialReview: touched ? 'YES' : 'NO',
    notes: 'Not independently pinned — it ships inside emphasis.json, so it migrates with Emphasis or not at all.',
  })
}

// ── 11. Directives reconciliation ────────────────────────────────────────────
add({
  consumer: 'Directives reconciliation',
  file: 'scripts/reconcile-directives.mjs',
  purpose: 'Explains the stored-vs-page count gap and regression-tests the authorship detector.',
  records: v3.rows.length,
  potentiallyChanged: v3.rows.filter(r => r.rulingChanged === 'true').length,
  certifiedWouldChange: 'NO — reporting only',
  pinned: 'quotes 2,652 mentions / 1,538 posts as the page figure',
  projected: '2,651 mentions / 1,538 posts, fully derived (see directives-page-count-reconciliation.md)',
  editorialReview: 'YES — the quoted page figure is one too high',
  notes: 'Its regression suite asserts #147 "Pray." appears in the QUOTED block. V2 agrees, by a different route: the phrase is absent from #147\'s body and present in the reproduced payload of #146.',
})

// ── 12. Cross-section invariant gate ─────────────────────────────────────────
{
  const xs = rd('audit/cross-section-integrity.json')
  add({
    consumer: 'Cross-section invariant gate',
    file: 'scripts/audit-cross-section.mjs',
    purpose: 'The gate. Verifies section isolation and source-material handling across all 8 sections.',
    records: xs.invariants?.length ?? xs.checks?.length ?? 138,
    potentiallyChanged: 'all of them, indirectly',
    certifiedWouldChange: 'N/A — it verifies, it does not publish',
    pinned: '138 invariants',
    projected: '138 invariants, re-derived',
    editorialReview: 'NO',
    notes: 'MIGRATES LAST, and never in the same commit as the classifications it verifies. A gate rewritten alongside the data it checks proves nothing.',
  })
}

// ── 13. Contracts / debt registry ────────────────────────────────────────────
add({
  consumer: 'Contracts & debt registry',
  file: 'scripts/lib/contracts.mjs',
  purpose: 'Records the known sourceLines() over-extension debt (123 posts) and names its prerequisites.',
  records: 1,
  potentiallyChanged: 1,
  certifiedWouldChange: 'NO',
  pinned: 'source-boundary debt: 123 posts',
  projected: 'the debt is DISCHARGED by V2 — the URL-after-quoted-sentence case is now two spans',
  editorialReview: 'YES — closing a debt baseline is an owner decision',
  notes: 'It already lists "any new classifier that consumes sourceLines()" as a prerequisite holder. sourceSpansV2 is that classifier.',
})

// ── 14. The definition itself ────────────────────────────────────────────────
add({
  consumer: 'sourceLines() definition',
  file: 'scripts/lib/quotedBlocks.mjs',
  purpose: 'The shared block-level detector every consumer above imports.',
  records: 'n/a',
  potentiallyChanged: 'n/a',
  certifiedWouldChange: 'NO — unchanged this session',
  pinned: 'n/a',
  projected: 'unchanged; V2 lives in scripts/lib/sourceSpansV2.mjs alongside it',
  editorialReview: 'NO',
  notes: 'Verified byte-identical to HEAD at the end of this session.',
})

// ── 15. Resolution Center queue ──────────────────────────────────────────────
{
  const rq = rd('public/data/resolution-queue.json')
  const items = Array.isArray(rq) ? rq : (rq.items ?? rq.queue ?? [])
  add({
    consumer: 'Resolution Center queue',
    file: 'scripts/build-resolution-queue.mjs',
    purpose: 'Collects everything the adjudications refused to guess, including NEEDS_CONTEXT directives.',
    records: manifest.counts.resolutionQueue,
    potentiallyChanged: v3.rows.filter(r => r.proposedRuling === 'NEEDS_CONTEXT').length,
    certifiedWouldChange: 'YES',
    pinned: `${manifest.counts.resolutionQueue} open items (seed ${manifest.seedVersion})`,
    projected: (() => {
      const v4 = rd('audit/source-spans-v2/directives-adjudication-v4-shadow.json')
      const holds = v4.rows.filter(r => r.proposedRuling === 'NEEDS_CONTEXT' || r.proposedRuling === 'NEEDS_FRAGMENT_REVIEW').length
      const wasHeld = rd('audit/source-spans-v2/directives-adjudication-v3-shadow.json').rows.filter(r => r.proposedRuling === 'NEEDS_CONTEXT').length
      return `${manifest.counts.resolutionQueue} − ${wasHeld} v3 directive holds + ${holds} v4 directive holds = ${manifest.counts.resolutionQueue - wasHeld + holds}`
    })(),
    editorialReview: 'YES',
    notes: `Queue length ${items.length ? items.length : 'n/a'} in the shipped artifact. This figure is read live from the manifest — it moved from 958 to ${manifest.counts.resolutionQueue} when a separate session certified seed ${manifest.seedVersion} mid-audit.`,
  })
}

// ── write ────────────────────────────────────────────────────────────────────
const md = []
md.push('# sourceSpansV2 — downstream consumer impact matrix')
md.push('')
md.push('**SHADOW MODE. NO CONSUMER WAS MIGRATED. `sourceLines()` is unchanged and every consumer still calls it.**')
md.push('')
md.push('## What "potentially changed" counts')
md.push('')
md.push(`The 4,966-post shadow diff moves **${diff.changed.length}** non-blank body lines. They are not equal in weight:`)
md.push('')
md.push(`- **${diff.changed.length - semanticChanged.length}** are \`>>NNNNNNN\` board pointers that sourceLines() left unlabelled and V2 labels as pointers. A pointer carries no analysable prose, so no consumer's records live on one. This is a definitional change, not a semantic one.`)
md.push(`- **${semanticChanged.length}** are semantic: a line that carried prose changed sides.`)
md.push(`- Of those, **${semanticChanged.filter(c => c.direction === 'OLD_QUOTED_TO_NEW_Q_BODY').length}** move quoted → Q body (text returned to Q) and **${semanticChanged.filter(c => c.direction === 'OLD_Q_BODY_TO_NEW_QUOTED').length}** move Q body → quoted (text taken away from Q).`)
md.push(`- **${semanticPosts.size}** posts carry at least one semantic change.`)
md.push('')
md.push('## Matrix')
md.push('')
md.push('| # | consumer | file | records | potentially changed | certified output changes? | current pin | projected | editorial review? |')
md.push('|---:|---|---|---:|---:|---|---|---|---|')
rows.forEach((r, i) => md.push(`| ${i + 1} | **${r.consumer}** | \`${r.file}\` | ${r.records} | ${r.potentiallyChanged} | ${r.certifiedWouldChange} | ${r.pinned} | ${r.projected} | ${r.editorialReview} |`))
md.push('')
md.push('## Purpose and notes, per consumer')
md.push('')
rows.forEach((r, i) => {
  md.push(`### ${i + 1}. ${r.consumer}`)
  md.push('')
  md.push(`- **File:** \`${r.file}\``)
  md.push(`- **What sourceLines() does there:** ${r.purpose}`)
  md.push(`- **Note:** ${r.notes}`)
  md.push('')
})
md.push('## Migration order')
md.push('')
md.push('Not started, and not to be started from this session. The order the evidence supports:')
md.push('')
md.push('1. **Directives** alone, because it is the only consumer whose defects are already adjudicated fixture-by-fixture.')
md.push('2. **Emphasis**, because its 932-occurrence `quotedSource` exclusion is the largest single quantity drawn from sourceLines().')
md.push('3. **Claims → Entities → Themes → Codes**, each with its own owner review of the moved records.')
md.push('4. **Questions** only after its frozen auditor is unfrozen and re-pointed at `segment.mjs`.')
md.push('5. **The cross-section invariant gate LAST**, and never in the same commit as the classifications it verifies.')
md.push('')
fs.writeFileSync(path.join(OUT, 'source-spans-v2-consumer-impact.md'), md.join('\n'))

console.log('CONSUMER IMPACT')
for (const r of rows) console.log(`  ${String(r.potentiallyChanged).padStart(6)}  ${r.consumer.padEnd(30)} ${r.certifiedWouldChange}`)
console.log(`\n  changed lines total : ${diff.changed.length}`)
console.log(`  of which pointers   : ${diff.changed.length - semanticChanged.length}`)
console.log(`  semantic changes    : ${semanticChanged.length} across ${semanticPosts.size} posts`)
console.log(`\nwrote ${path.relative(ROOT, OUT)}/source-spans-v2-consumer-impact.md  — nothing migrated`)
