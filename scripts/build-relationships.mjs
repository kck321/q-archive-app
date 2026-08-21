// Cross-section relationships — derived, never inferred.
//
// THE RULE THAT SHAPES THIS FILE: a relationship may come only from an explicit cross-link
// already stored, a certified span overlap, a shared certified id, or an adjudicated attribute.
// Keywords and proximity are not evidence. A "these two look related" guesser would quietly
// become a ninth classifier, and it would be the one layer of this app that nothing certified.
//
// So every edge carries `basis`: the certified field or overlap that produced it. An edge that
// cannot name its basis is a defect, and the QA report fails on it rather than shipping it.
//
// This is a PRODUCT layer over frozen data. It reclassifies nothing, and moves no count.
//
//   node scripts/build-relationships.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'
import { CANONICAL } from './lib/contracts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const dry = process.argv.includes('--dry')

const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const posts = read('posts.json')
const questions = read('questions.json')
const evidence = read('evidence.json')
const entities = read('entities.json')
const themes = read('themes.json')
const codes = read('codes.json')
const emphasis = read('emphasis.json')
const queue = read('resolution-queue.json')

const nlower = s => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

const edges = []
const problems = { orphanedCrossLinks: [], danglingIds: [], noBasis: [], duplicates: [] }

const add = (postNum, type, from, to, basis, detail) =>
  edges.push({ postNum, type, from, to, basis, detail: detail ?? null })

// ── the per-post index of certified occurrences ──────────────────────────────
// Everything below joins against this, so a relationship can only ever point at something that
// is actually certified. An endpoint that is not in here becomes a dangling id, not an edge.
const qByPost = new Map()
for (const q of questions) {
  if (q.occurrences === undefined) continue
  if (!qByPost.has(q.postNum)) qByPost.set(q.postNum, [])
  qByPost.get(q.postNum).push(q)
}
const emphByPost = new Map()
for (const o of emphasis.occurrences) {
  if (!emphByPost.has(o.postNum)) emphByPost.set(o.postNum, [])
  emphByPost.get(o.postNum).push(o)
}
const evByPost = new Map()
for (const i of evidence.items) {
  if (!evByPost.has(i.postNum)) evByPost.set(i.postNum, [])
  evByPost.get(i.postNum).push(i)
}
const entityByName = new Map()
for (const e of entities.entities) {
  entityByName.set(nlower(e.canonical), e)
  for (const a of e.aliases ?? []) entityByName.set(nlower(a.text), e)
}

for (const p of posts) {
  const num = p.postNum
  const qs = qByPost.get(num) ?? []
  const directives = p.actionRequests ?? []
  const claims = p.postAnalysis?.claims ?? []
  const predictions = p.postAnalysis?.predictions ?? []
  const meta = p.claimMeta ?? {}

  // 1 — Question ↔ Directive. The certified overlap: one unit that is grammatically an
  // instruction and functionally a request for an answer. Basis is the canonical key match or
  // the directiveSource the Questions audit recorded.
  // Measured from the DIRECTIVE side, because that is how the certified 230 is defined. Walking
  // the questions instead returns 218: where Q wrote the same directive twice in one drop, both
  // occurrences overlap the question and the pair is one edge per occurrence, not per question.
  const qByKey = new Map(qs.map(q => [key(q.text), q]))
  const qBySrc = new Map(qs.filter(q => q.directiveSource).map(q => [key(q.directiveSource), q]))
  directives.forEach((d, di) => {
    const viaText = qByKey.get(key(d))
    const viaSrc = qBySrc.get(key(d))
    const hit = viaText ?? viaSrc
    if (!hit) return
    add(num, 'question_directive', { section: 'directives', index: di, text: d },
      { section: 'questions', id: hit.id, text: hit.text },
      viaText ? 'canonical key match on the same unit' : 'questions.directiveSource',
      'counted once in each section, never twice within one')
  })

  // 2 — Claim attributes. isConclusion and sourceProvided are ADJUDICATED ATTRIBUTES of an
  // assertion, not separate populations, so they are edges to a property rather than to another
  // unit. Rendering them any other way would invite a reader to add them to the claims total.
  // The occurrence index travels with the edge. Q wrote "Nothing is as it appears." twice in
  // #151 and both occurrences carry isConclusion; without the index they collapse into one edge
  // and the attribute silently stops matching the certified 966.
  const assertions = [...claims.map((text, i) => ({ text, section: 'claims', index: i })),
    ...predictions.map((text, i) => ({ text, section: 'predictions', index: i }))]
  for (const { text, section, index } of assertions) {
    const m = meta[nlower(text)] ?? meta[key(text)] ?? meta[text]
    if (!m) continue
    if (m.isConclusion) add(num, 'claim_conclusion', { section, index, text }, { attribute: 'isConclusion' }, 'claimMeta.isConclusion')
    // sourceProvided is certified at 438 for CLAIMS. Predictions carry the same attribute and are
    // reported as their own type, because folding them together would show 484 against a
    // published 438 and the difference would look like drift instead of a second population.
    if (m.sourceProvided) {
      add(num, section === 'claims' ? 'claim_source_provided' : 'prediction_source_provided',
        { section, index, text }, { attribute: 'sourceProvided' }, 'claimMeta.sourceProvided')
    }
    if (section === 'predictions' && m.semanticFamily === 'assertion') {
      add(num, 'prediction_assertion', { section, index, text }, { attribute: 'semanticFamily=assertion' }, 'claimMeta.semanticFamily',
        'a prediction is an assertion; the sections stay separate and the combined figure is only shown labelled')
    }
  }

  // 3 — Entity ↔ Code. The explicit cross-link stored on the code by the Codes adjudication.
  // Nothing is matched by text here: if linkedEntityId does not resolve, that is an orphan.
  for (const c of codes.codes) {
    if (!c.linkedEntityId || !(c.posts ?? []).includes(num)) continue
    const ent = entityByName.get(nlower(c.linkedEntityId))
    if (!ent) { problems.orphanedCrossLinks.push({ postNum: num, code: c.normalizedKey, linkedEntityId: c.linkedEntityId }); continue }
    add(num, 'entity_code', { section: 'codes', id: c.normalizedKey, text: c.sourceTexts[0] },
      { section: 'entities', id: ent.canonical },
      'codes.linkedEntityId', 'Entities asks who is referenced; Codes asks how Q marked the reference')
  }

  // 4 — Emphasis ↔ a certified unit, by SPAN OVERLAP only. The emphasised line has to contain,
  // or be contained by, the certified unit's own wording. Same-post proximity is not enough.
  for (const o of emphByPost.get(num) ?? []) {
    const lines = o.type === 'parallel_phrasing' ? String(o.line).split(' / ') : [String(o.line)]
    const spans = lines.map(nlower)
    const hitUnit = (section, text) => {
      const t = nlower(text)
      if (!t) return false
      return spans.some(s => s === t || s.includes(t) || t.includes(s))
    }
    for (const q of qs) if (hitUnit('questions', q.text)) {
      add(num, 'emphasis_question', { section: 'emphasis', id: o.id, text: o.sourceText },
        { section: 'questions', id: q.id, text: q.text }, 'certified span overlap', o.basis ?? o.type)
      break
    }
    for (const d of directives) if (hitUnit('directives', d)) {
      add(num, 'emphasis_directive', { section: 'emphasis', id: o.id, text: o.sourceText },
        { section: 'directives', text: d }, 'certified span overlap', o.basis ?? o.type)
      break
    }
    for (const c of claims) if (hitUnit('claims', c)) {
      add(num, 'emphasis_claim', { section: 'emphasis', id: o.id, text: o.sourceText },
        { section: 'claims', text: c }, 'certified span overlap', o.basis ?? o.type)
      break
    }
  }

  // 5 — Theme ↔ its supporting span. The Themes audit recorded the anchor words that fired;
  // this locates the line carrying one. The anchor is certified metadata — the line is where a
  // reader can see it, which is the whole point of showing the relationship at all.
  const postLines = clean(p.text ?? '').split('\n').map(l => l.trim()).filter(Boolean)
  for (const t of themes.byPost?.[String(num)] ?? []) {
    for (const anchor of t.evidence?.anchors ?? []) {
      const line = postLines.find(l => nlower(l).includes(nlower(anchor)))
      if (!line) continue
      add(num, 'theme_support', { section: 'themes', id: t.theme, text: t.label },
        { section: 'post', text: line }, 'themes.evidence.anchors', `anchor “${anchor}” · ${t.confidence}`)
      break
    }
  }

  // 6 — Evidence ↔ Claim, again by span overlap: the reference has to appear inside the claim's
  // own wording. This is what "source provided" looks like on the page.
  ;(evByPost.get(num) ?? []).forEach((i, ei) => {
    if (!i.value) return
    const hit = claims.find(c => nlower(c).includes(nlower(i.value)))
    if (hit) add(num, 'evidence_claim', { section: 'evidence', index: ei, text: i.value },
      { section: 'claims', text: hit }, 'certified span overlap', i.subtype ?? i.kind)
  })
}

// 7 — Unresolved ↔ the exact occurrence it came from. The queue is occurrence-specific, so the
// edge is too: it points at the post and the span, never at the token.
for (const r of queue.rows) {
  add(r.postNum, 'unresolved_occurrence', { section: 'resolution', id: r.id, text: r.token },
    { section: r.kind === 'classification' ? 'emphasis' : r.kind === 'code' ? 'codes' : r.kind === 'theme' ? 'themes' : 'entities', text: r.sourceSpan },
    'resolution-queue occurrence id', r.whyUnresolved?.slice(0, 120))
}

// ── QA ───────────────────────────────────────────────────────────────────────
for (const e of edges) if (!e.basis) problems.noBasis.push(e)

const seen = new Set()
for (const e of edges) {
  const k = `${e.postNum}|${e.type}|${e.from.index ?? ''}|${nlower(e.from.id ?? e.from.text)}|${nlower(e.to.id ?? e.to.text ?? e.to.attribute)}`
  if (seen.has(k)) problems.duplicates.push(e)
  seen.add(k)
}

// An endpoint naming a section must name something that section actually certifies.
const qIds = new Set(questions.map(q => q.id))
const emphIds = new Set(emphasis.occurrences.map(o => o.id))
const codeIds = new Set(codes.codes.map(c => c.normalizedKey))
const queueIds = new Set(queue.rows.map(r => r.id))
for (const e of edges) {
  for (const side of [e.from, e.to]) {
    if (!side.id) continue
    const ok = side.section === 'questions' ? qIds.has(side.id)
      : side.section === 'emphasis' ? emphIds.has(side.id)
        : side.section === 'codes' ? codeIds.has(side.id)
          : side.section === 'entities' ? entityByName.has(nlower(side.id))
            : side.section === 'resolution' ? queueIds.has(side.id)
              : side.section === 'themes' ? true
                : true
    if (!ok) problems.danglingIds.push({ type: e.type, postNum: e.postNum, side })
  }
}

const byType = {}
for (const e of edges) byType[e.type] = (byType[e.type] ?? 0) + 1
const byPost = {}
for (const e of edges) (byPost[e.postNum] ??= []).push(e)

// ── the per-post analysis map ────────────────────────────────────────────────
// Counts come from the certified artifacts, never recounted in the UI — the mistake that cost
// this project the most was a helper re-deriving a category after it was certified.
const analysisMap = {}
for (const p of posts) {
  const num = p.postNum
  const counts = {
    questions: (qByPost.get(num) ?? []).length,
    directives: (p.actionRequests ?? []).length,
    claims: (p.postAnalysis?.claims ?? []).length,
    predictions: (p.postAnalysis?.predictions ?? []).length,
    evidence: (evByPost.get(num) ?? []).length,
    entities: (p.postAnalysis?.namedEntities ?? []).length,
    themes: (themes.byPost?.[String(num)] ?? []).length,
    codes: codes.codes.filter(c => (c.posts ?? []).includes(num)).length,
    emphasis: (emphByPost.get(num) ?? []).length,
    unresolved: queue.rows.filter(r => r.postNum === num).length,
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total) analysisMap[num] = { counts, relationships: (byPost[num] ?? []).length }
}

const out = {
  generated: 'scripts/build-relationships.mjs',
  derivedNotInferred: true,
  note: 'Every relationship comes from a stored cross-link, a certified span overlap, a shared certified id, or an adjudicated attribute. None is inferred from keywords or proximity.',
  totals: { relationships: edges.length, byType, postsWithAnalysis: Object.keys(analysisMap).length },
  analysisMap,
  byPost,
}

const checks = [
  ['every relationship states its basis', problems.noBasis.length === 0, `${problems.noBasis.length} without`],
  ['no duplicate relationship edges', problems.duplicates.length === 0, `${problems.duplicates.length}`],
  ['no dangling endpoint ids', problems.danglingIds.length === 0, `${problems.danglingIds.length}`],
  ['no orphaned cross-links', problems.orphanedCrossLinks.length === 0, `${problems.orphanedCrossLinks.length}`],
  ['Question ↔ Directive = the certified 230', byType.question_directive === 230, byType.question_directive ?? 0],
  ['Entity ↔ Code = the certified 32 links', new Set(edges.filter(e => e.type === 'entity_code').map(e => e.from.id)).size === 32,
    new Set(edges.filter(e => e.type === 'entity_code').map(e => e.from.id)).size],
  ['Claim ↔ Conclusion = the certified 964',
    byType.claim_conclusion === 964, byType.claim_conclusion ?? 0],
  // 965 -> 964 and 439 -> 438 on 2026-08-21: the abbreviation repair absorbed tail fragments that
  // carried these attributes. An attribute travels with the ROW, so it leaves with the fragment
  // rather than being re-attached to the span the fragment turned out to be part of. Both figures
  // are Claims' and are asserted here only as a cross-section tripwire.
  ['Claim ↔ Source provided = the certified 438',
    byType.claim_source_provided === 438, byType.claim_source_provided ?? 0],
  ['Prediction ↔ Source provided reported separately', (byType.prediction_source_provided ?? 0) > 0, byType.prediction_source_provided ?? 0],
  // 595 -> 842 (2026-08-20 queue ruling) -> 843 (2026-08-21, #4910). A prediction IS an assertion,
  // so every one of them carries this edge — the figure is Predictions' and belongs to Predictions.
  // It was a literal, and a literal here reports a defect that does not exist every time a genuine
  // prediction ruling lands. Same correction the queue ruling made to four other stale literals:
  // a number that is a copy of a relationship should BE the relationship.
  [`Prediction ↔ assertion family = the certified ${CANONICAL.predictions.occurrences}`,
    byType.prediction_assertion === CANONICAL.predictions.occurrences, byType.prediction_assertion ?? 0],
  // 2,245 -> 2,233: the RC alias ruling answered 12 queued rows (#2 excluded, still open).
  // Read from the contract, never copied. This gate held a hardcoded 105 and blocked the queue
  // going to 115 — a certified count in two places is a certified count that goes stale in one.
  [`unresolved edges = the ${CANONICAL.resolution.total} queue rows`,
    byType.unresolved_occurrence === CANONICAL.resolution.total, byType.unresolved_occurrence ?? 0],
]

console.log('\nCROSS-SECTION RELATIONSHIPS\n')
console.log(`  relationships : ${edges.length.toLocaleString()}`)
console.log(`  posts mapped  : ${Object.keys(analysisMap).length.toLocaleString()}`)
console.log('\n  by type:')
for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(6)}  ${t}`)
console.log('\n  QA GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(44)} ${got}`) }

const md = ['# Q Drops — cross-section relationship QA\n']
md.push('A product layer over frozen data. Every relationship comes from a stored cross-link, a certified span overlap, a shared certified id, or an adjudicated attribute — **none is inferred from keywords or proximity**. No certified count moves.\n')
md.push(`\n**${edges.length.toLocaleString()} relationships** across ${Object.keys(analysisMap).length.toLocaleString()} posts.\n`)
md.push('\n## By type\n')
md.push('| Relationship | Count | Certified basis |')
md.push('|---|---|---|')
const BASIS_LABEL = {
  question_directive: 'canonical key match or `questions.directiveSource`',
  claim_conclusion: '`claimMeta.isConclusion` — an attribute, never an added population',
  claim_source_provided: '`claimMeta.sourceProvided`',
  prediction_source_provided: '`claimMeta.sourceProvided` on a prediction — a second population, kept apart from the certified 438',
  prediction_assertion: '`claimMeta.semanticFamily` — sections stay separate',
  entity_code: '`codes.linkedEntityId`, the stored cross-link',
  emphasis_question: 'certified span overlap',
  emphasis_directive: 'certified span overlap',
  emphasis_claim: 'certified span overlap',
  theme_support: '`themes.evidence.anchors`',
  evidence_claim: 'certified span overlap',
  unresolved_occurrence: 'resolution-queue occurrence id',
}
for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  md.push(`| ${t.replace(/_/g, ' ↔ ')} | ${n.toLocaleString()} | ${BASIS_LABEL[t] ?? '—'} |`)
}
md.push('\n## QA\n')
md.push('| | Check | Observed |')
md.push('|---|---|---|')
for (const [label, ok, got] of checks) md.push(`| ${ok ? '✅' : '❌'} | ${label} | ${got} |`)
md.push('\n## Problems\n')
md.push('| Class | Count |')
md.push('|---|---|')
for (const [k, v] of Object.entries(problems)) md.push(`| ${k} | ${v.length} |`)
fs.writeFileSync(path.join(OUT, 'relationships-qa.md'), md.join('\n') + '\n')
fs.writeFileSync(path.join(OUT, 'relationships-qa.json'), JSON.stringify({ totals: out.totals, checks, problems }, null, 1))

if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: relationships.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'relationships.json'), JSON.stringify(out))
console.log(`\nwrote public/data/relationships.json (${(fs.statSync(path.join(DATA, 'relationships.json')).size / 1048576).toFixed(2)} MB)`)
console.log('→ audit/relationships-qa.md\n')
