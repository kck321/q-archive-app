// STEP 3A — the occurrence-keyed ledger, and a DRY RUN of the full-sentence replacement.
//
// WRITES NO CLASSIFICATION DATA. It produces two artifacts describing what 3B would do, and
// nothing in public/data is touched. That separation is the point: the replacement removes
// superseded spans across every category, and a change of that size gets read before it is run.
//
//   node scripts/build-occurrence-ledger.mjs
//
// WHY AN OCCURRENCE LEDGER AT ALL. The archive has identified analysis records by their TEXT since
// the beginning. Four defects in one week came from that: a dedupe collapsed 48 legitimate in-post
// repeats, 64 repaired claims lost every attribute because claimMeta is keyed by claim text, a
// repair went missing over a literal tab, and identical wording in two sections collided as if it
// were one thing. An occurrence is a POST, a KIND and a RANGE OF CHARACTERS.
//
//   occurrenceKey = postNum | kind | start | end
//
// Repeated wording stays separate by construction: "Fantasy land." four times in #111 is four keys
// because it is four ranges.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor, occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'
import { buildEntityForms } from './lib/entityForms.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))

// The three layers, per the owner's model of 2026-08-21.
//   primary   exactly one adjudicated semantic category per complete sentence
//   inline    may overlap a primary span and renders above it
//   review    a disposition, not a competing sentence colour
const LAYER = {
  claims: 'primary', predictions: 'primary', questions: 'primary', directives: 'primary',
  namedEntities: 'inline', brackets: 'inline',
  context: 'review', emphasis: 'review', themeAnchors: 'review',
}

// ENTITIES ARE IDENTITIES, NOT LITERAL SPANS.
//
// postAnalysis.namedEntities lists the canonical identity present in the drop — "Hussein" for a
// post that writes "BO", "The Fed" for one that writes "FED". Looking for the canonical text
// verbatim leaves 913 of them unplaceable, which is not a defect in the data: it is the alias
// registry doing its job. The renderer resolves them through getFullAliasGroup(); the ledger
// resolves them through the same registry so an entity's real OFFSETS are known and 3B can
// preserve them exactly where they sit.
//
// THE MAP USED TO BE KEYED BY CANONICAL, AND THAT IS WHY 412 OF THEM WERE "UNPLACEABLE".
// namedEntities stores the identity the section recorded, which is often an ALIAS — "Hussein" is
// an alias of "Barack Obama", "Sessions" of "Jeff Sessions". A canonical-keyed map has no key for
// those, so this fallback could never fire and the drop's own "HUSSEIN" was never found. The
// lookup is shared now: lib/entityForms.mjs, group-aware, still exact-case.
const entitiesDoc = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))
const entityForms = buildEntityForms(entitiesDoc)

const qByPost = new Map()
for (const q of questions) {
  if (q.occurrences === undefined) continue
  // A MARKED QUESTION IS NOT A PRIMARY RECORD (Step 3B-1, owner ruling 2026-08-21).
  //
  //   secondary   the sentence was adjudicated to another primary category and this speech act is
  //               retained as a non-painting relationship
  //   withdrawn   a same-category fragment superseded by the complete sentence, or a record on a
  //               sentence that turned out not to be Q's to certify
  //
  // Either way the record is KEPT — its id, semanticFunction, grammaticalForm, infographId and
  // every relationship edge pointing at it survive intact — because deleting it to move one count
  // would destroy all of that. apply-step3b1.mjs marks; this is where the mark takes effect.
  // Counting a marked record here would report a primary total the renderer does not paint.
  if (q.semanticLayer && q.semanticLayer !== 'primary') continue
  if (!qByPost.has(q.postNum)) qByPost.set(q.postNum, [])
  qByPost.get(q.postNum).push(q)
}

/** Every certified span on a post, as {kind, text} in a stable order. */
function spansOf(p) {
  const a = p.postAnalysis ?? {}
  const out = []
  const add = (kind, arr) => { for (const t of arr ?? []) if (String(t ?? '').trim()) out.push({ kind, text: String(t) }) }
  add('claims', a.claimSpans ?? a.claims)
  add('predictions', a.predictionSpans ?? a.predictions)
  add('directives', p.actionRequests)
  // A DIRECTIVE-WRAPPED QUESTION IS DELIBERATELY A PARTIAL SPAN.
  //
  // "Ask yourself, why are they panicking?" is certified as a Directive, and the QUESTION counted
  // inside it is the embedded "why are they panicking?" — the archive keeps both so the Directive
  // relationship is retained rather than thrown away. 51 of them exist and build-relationships
  // emits an edge for each. Replacing them with their full sentence would erase that on purpose,
  // so they are marked and excluded from the replacement set rather than discovered in 3B.
  for (const q of qByPost.get(p.postNum) ?? []) {
    out.push({ kind: 'questions', text: String(q.literal ?? q.text), directiveWrapped: Boolean(q.directiveWrapped || q.directiveSource) })
  }
  add('namedEntities', a.namedEntities)
  add('context', a.contextUnits)
  add('emphasis', a.emphasis)
  add('themeAnchors', a.themeAnchors)
  return out
}

const ledger = []
const unlocated = []
const crossingRows = []
let crossing = 0

for (const p of posts) {
  const sentences = sentencesFor(p.text, p.postNum)
  const byId = new Map(sentences.map(s => [s.sentenceId, s]))
  // Ranges already claimed by an earlier occurrence of the SAME kind, so the second "Fantasy land."
  // binds to the second position rather than to the first all over again.
  const taken = new Map()
  for (const { kind, text, directiveWrapped } of spansOf(p)) {
    let hits = occurrencesOfSpan(p.text, text)
    // An entity that does not appear under its canonical name is located under whichever registered
    // spelling the drop actually uses. Longest form first, so "US Military" wins over "US".
    if (!hits.length && kind === 'namedEntities') {
      for (const f of entityForms.formsFor(text)) {
        const h = occurrencesOfSpan(p.text, f)
        if (h.length) { hits = h; break }
      }
    }
    if (!hits.length) { unlocated.push({ postNum: p.postNum, kind, text: text.slice(0, 120) }); continue }
    const usedKey = `${kind}|${text}`
    const already = taken.get(usedKey) ?? 0
    const hit = hits[Math.min(already, hits.length - 1)]
    taken.set(usedKey, already + 1)
    const [start, end] = hit
    // STORE THE MATCHED TEXT, NEVER THE SEARCH TERM.
    //
    // Two ways they differ, and both produced records whose stored text did not match the
    // characters they claimed:
    //   · an entity resolves through its ALIAS — "Arizona" was recorded at the offsets of "AZ",
    //     "Germany" at "GER", "4chan" at "4ch". The canonical identity is metadata; the span
    //     covers the spelling Q actually wrote.
    //   · the whitespace-tolerant fallback matches across a line break, so a certified value
    //     carrying a space sits over a body carrying a newline.
    // 296 of 35,255 records were wrong this way, and the dry-run generator's own assertion is
    // what found them.
    const bodyText = runtimeText(p.text ?? '')
    const matched = bodyText.slice(start, end)
    const holder = sentences.find(s => start >= s.start && end <= s.end)
    if (!holder) {
      crossing++
      // The sentences the span actually touches, so a reviewer can see whether it is two adjacent
      // sentences wrongly joined, a quotation running into Q's own words, or a bad offset.
      const touched = sentences.filter(s => start < s.end && s.start < end)
      crossingRows.push({
        occurrenceKey: `${p.postNum}|${kind}|${start}|${end}`,
        postNum: p.postNum, kind, layer: LAYER[kind], start, end, text,
        sentencesTouched: touched.length,
        sentenceIds: touched.map(s => s.sentenceId),
        sentenceTexts: touched.map(s => s.text),
      })
    }
    ledger.push({
      key: `${p.postNum}|${kind}|${start}|${end}`,
      postNum: p.postNum, kind, layer: LAYER[kind], start, end,
      text: matched,
      // What the section certified, when that differs from the characters on screen: the canonical
      // entity identity, or a value the segmenter normalised. Metadata — never painted.
      ...(matched === text ? {} : { certifiedValue: text }),
      ...(directiveWrapped ? { directiveWrapped: true } : {}),
      sentenceId: holder?.sentenceId ?? null,
      relation: !holder ? 'CROSSING'
        : (start === holder.start && end === holder.end) ? 'EXACT'
        : 'PARTIAL',
    })
  }
  for (const s of sentences) byId.set(s.sentenceId, s)
}

// Duplicate occurrence keys — two records claiming the same post, kind and range. Under the new
// model that is one occurrence recorded twice; the rows are emitted so the metadata on each can be
// compared before either is dropped.
const seenKey = new Map()
const duplicateRows = []
for (const o of ledger) {
  const prior = seenKey.get(o.key)
  if (prior) duplicateRows.push({ occurrenceKey: o.key, postNum: o.postNum, kind: o.kind,
    start: o.start, end: o.end, textA: prior.text, textB: o.text, identicalText: prior.text === o.text })
  else seenKey.set(o.key, o)
}

// ── What 3B would do, sentence by sentence ───────────────────────────────────
const bySentence = new Map()
for (const o of ledger) {
  if (!o.sentenceId) continue
  if (!bySentence.has(o.sentenceId)) bySentence.set(o.sentenceId, [])
  bySentence.get(o.sentenceId).push(o)
}

const replacements = []       // a PARTIAL primary span that a full-sentence span would supersede
const multiPrimary = []       // a sentence carrying two or more different primary categories
const sameCategoryOverlap = []// two spans of one category covering overlapping characters
const contextCollision = []   // a review-layer span whose exact range is also a primary span

for (const [sentenceId, occs] of bySentence) {
  const primary = occs.filter(o => o.layer === 'primary')
  const kinds = [...new Set(primary.map(o => o.kind))].sort()
  if (kinds.length > 1) {
    // A DIRECTIVE THAT IS ALSO A QUESTION IS NOT A DEFECT. "Define 'witness'." is grammatically an
    // instruction and functionally a request for an answer, and the archive certifies it in BOTH
    // sections deliberately — build-relationships emits a question_directive edge for exactly this
    // and PROJECT_CONTEXT records it as a certified overlap. Reporting these beside genuine
    // collisions would hand the owner a number that is mostly not a problem.
    const certifiedPair = kinds.length === 2 && kinds[0] === 'directives' && kinds[1] === 'questions'
    // A COLLISION IS TWO CATEGORIES ON THE SAME CHARACTERS. A PARTITION IS NOT.
    //
    // "One adjudicated category per complete sentence" exists to stop two paints fighting over the
    // same text. #34 is the case that shows the rule was stated one notch too broadly: "On POTUS'
    // order, we have initiated certain fail-safes" is a completed act and "that shall safeguard the
    // public ..." is a forecast, in one sentence, and the owner ruled both are real and neither may
    // be demoted to a non-painting secondary. Those two spans are DISJOINT — they divide the
    // sentence, they do not contest it.
    //
    // So the flag is reported, not assumed. Everything that overlaps still lands in the collision
    // set exactly as before; only a clean partition is separated out. When this was introduced
    // p0034-s002 was the sole multi-primary sentence in the archive, so nothing else moved.
    const disjoint = primary.every((a, i) => primary.every((b, j) => i === j || a.end <= b.start || b.end <= a.start))
    multiPrimary.push({ sentenceId, postNum: occs[0].postNum, kinds,
      certifiedOverlap: certifiedPair, disjointClausePartition: disjoint,
      // THE KEY TRAVELS WITH THE SPAN. It used to carry only a 90-character truncation of the text,
      // and a later analysis rebuilt keys by re-locating that truncation — producing a SHORTER span
      // and therefore a different key for the same occurrence. That is the exact defect this whole
      // ledger exists to remove: never re-derive an identity that already exists.
      spans: primary.map(o => ({ occurrenceKey: o.key, kind: o.kind, relation: o.relation,
        start: o.start, end: o.end, directiveWrapped: Boolean(o.directiveWrapped),
        text: o.text.slice(0, 90) })) })
  }
  for (const o of primary) {
    if (o.relation === 'PARTIAL') {
      replacements.push({ sentenceId, postNum: o.postNum, kind: o.kind,
        deliberate: Boolean(o.directiveWrapped),
        why: o.directiveWrapped ? 'directive-wrapped question — the embedded span is counted on purpose' : null,
        partial: o.text.slice(0, 110), start: o.start, end: o.end })
    }
  }
  // same-category overlap, by RANGE not by wording
  for (let i = 0; i < occs.length; i++) {
    for (let j = i + 1; j < occs.length; j++) {
      const a = occs[i], b = occs[j]
      if (a.kind !== b.kind) continue
      if (a.start === b.start && a.end === b.end) continue     // identical range = one thing seen twice
      if (a.start < b.end && b.start < a.end) {
        // NESTED ENTITIES AND ACROSTIC EMPHASIS ARE DELIBERATE, and documented as such.
        //   entities  "US" inside "US Military", "Comey" inside "James Comey" — each half is
        //             separately certified and each keeps its own hover explanation. Collapsing
        //             them was built, measured and REVERTED: it removed the info box for 27
        //             acronyms. See src/lib/highlightConstants.ts.
        //   emphasis  an acrostic spreads [N][C][S][W][I][C] across a line, so its occurrences
        //             overlap by construction.
        // The owner's no-same-category-overlap rule is about the PRIMARY layer. Both are reported,
        // separated, so the rule is applied where it was meant and not where it would destroy
        // reader explanation.
        const nested = (a.start <= b.start && a.end >= b.end) || (b.start <= a.start && b.end >= a.end)
        sameCategoryOverlap.push({ sentenceId, postNum: a.postNum, kind: a.kind, layer: a.layer,
          nested, deliberate: a.layer !== 'primary',
          a: a.text.slice(0, 70), b: b.text.slice(0, 70) })
      }
    }
  }
  // a review-layer span sitting on exactly the same characters as a primary one
  for (const r of occs.filter(o => o.layer === 'review')) {
    const clash = primary.find(o => o.start === r.start && o.end === r.end)
    if (clash) {
      contextCollision.push({ sentenceId, postNum: r.postNum, reviewKind: r.kind,
        primaryKind: clash.kind, start: r.start, end: r.end, text: r.text.slice(0, 100) })
    }
  }
}

const countBy = (rows, f) => rows.reduce((m, r) => { const k = f(r); m[k] = (m[k] ?? 0) + 1; return m }, {})

const report = {
  note: 'STEP 3A — DRY RUN. Describes what the full-sentence replacement would do. No classification data was changed by this script.',
  generatedFrom: 'public/data/posts.json + questions.json, at the commit this artifact was written on',
  model: {
    primary: 'exactly one adjudicated semantic category per complete sentence — Claim, Prediction, Question, Directive',
    inline: 'Named Entities and Brackets — may overlap a primary span and render above it',
    review: 'Context, Emphasis, theme anchors — a disposition, not a competing sentence colour',
    occurrenceKey: 'postNum | kind | start | end, into the RUNTIME body. Repeated wording stays separate because it is separate ranges.',
  },
  totals: {
    sentences: posts.reduce((n, p) => n + sentencesFor(p.text, p.postNum).length, 0),
    occurrencesKeyed: ledger.length,
    duplicateKeys: ledger.length - new Set(ledger.map(o => o.key)).size,
    byKind: countBy(ledger, o => o.kind),
    byRelation: countBy(ledger, o => o.relation),
    unlocated: unlocated.length,
    crossingSentenceBoundary: crossing,
  },
  findings: {
    partialPrimarySpans: {
      total: replacements.length,
      toReplace: replacements.filter(r => !r.deliberate).length,
      deliberatePartials: replacements.filter(r => r.deliberate).length,
      note: 'A directive-wrapped question is a partial span ON PURPOSE — the embedded question is what gets counted so the Directive relationship survives. Those are excluded from the replacement set.',
      byKind: countBy(replacements.filter(r => !r.deliberate), r => r.kind),
    },
    sentencesWithMoreThanOnePrimaryCategory: {
      total: multiPrimary.length,
      certifiedDirectiveQuestion: multiPrimary.filter(m => m.certifiedOverlap).length,
      needsAnAdjudicatedWinner: multiPrimary.filter(m => !m.certifiedOverlap).length,
      note: 'The directive+question pairs are a CERTIFIED overlap the archive maintains on purpose. Only the rest need a ruling, and none is resolved by an automatic precedence rule.',
      combinations: countBy(multiPrimary.filter(m => !m.certifiedOverlap), m => m.kinds.join('+')),
    },
    sameCategoryOverlaps: {
      total: sameCategoryOverlap.length,
      inPrimaryLayer: sameCategoryOverlap.filter(o => o.layer === 'primary').length,
      deliberateInlineOrReview: sameCategoryOverlap.filter(o => o.deliberate).length,
      byKind: countBy(sameCategoryOverlap, o => o.kind),
      note: 'The owner rule targets the PRIMARY layer. Nested entities and acrostic emphasis overlap by design and are reported separately rather than swept up.',
    },
    reviewLayerCollisions: { count: contextCollision.length, note: 'A Context/Emphasis span on exactly the characters of a primary span. Becomes a reviewDisposition, not a second category.' },
    unlocatedSpans: { count: unlocated.length, note: 'A certified span the ledger could not place in the runtime body. Each is a conflict-queue row, never a silent drop.' },
  },
  crossingRows,
  duplicateRows,
  replacements,
  multiPrimary,
  sameCategoryOverlap,
  contextCollision,
  unlocated,
}

fs.writeFileSync(path.join(OUT, 'occurrence-ledger-dryrun.json'), JSON.stringify(report, null, 1) + '\n')

// THE FULL LEDGER, with every record's complete literal text.
//
// The findings file above carries subsets, and several of them shorten text for readability. Any
// consumer that needs an occurrence's identity must read it FROM HERE and never rediscover it:
// re-locating a shortened string is exactly how one occurrence acquired two different keys.
fs.writeFileSync(path.join(OUT, 'occurrence-ledger.json'), JSON.stringify({
  note: 'Every certified occurrence, keyed postNum|kind|start|end into the RUNTIME body. Full literal text. No consumer may reconstruct an identity from this text - take the key.',
  generatedBy: 'scripts/build-occurrence-ledger.mjs',
  count: ledger.length,
  records: ledger,
}))

console.log('\nSTEP 3A — OCCURRENCE LEDGER (DRY RUN, nothing written to public/data)\n')
console.log(`  sentences                        ${report.totals.sentences.toLocaleString()}`)
console.log(`  occurrences keyed                ${report.totals.occurrencesKeyed.toLocaleString()}`)
console.log(`  duplicate occurrence keys        ${report.totals.duplicateKeys}`)
console.log(`  unlocated spans                  ${report.totals.unlocated}`)
console.log(`  crossing a sentence boundary     ${report.totals.crossingSentenceBoundary}`)
console.log('\n  by relation to its sentence')
for (const [k, v] of Object.entries(report.totals.byRelation)) console.log(`    ${k.padEnd(10)} ${String(v).padStart(7)}`)
console.log('\n  by kind')
for (const [k, v] of Object.entries(report.totals.byKind)) console.log(`    ${k.padEnd(14)} ${String(v).padStart(7)}`)
console.log('\n  WHAT 3B WOULD CHANGE')
console.log(`    partial primary spans                     ${replacements.length}`)
console.log(`        TO REPLACE                            ${replacements.filter(r => !r.deliberate).length}`)
console.log(`        deliberate (directive-wrapped Q)      ${replacements.filter(r => r.deliberate).length}  (no action)`)
for (const [k, v] of Object.entries(report.findings.partialPrimarySpans.byKind)) console.log(`        ${k.padEnd(12)} ${v}`)
console.log(`    sentences with >1 primary category        ${multiPrimary.length}`)
console.log(`        certified directive+question pair     ${multiPrimary.filter(m => m.certifiedOverlap).length}  (deliberate, no action)`)
console.log(`        needs an adjudicated winner           ${multiPrimary.filter(m => !m.certifiedOverlap).length}`)
console.log(`    same-category overlaps                    ${sameCategoryOverlap.length}`)
console.log(`        in the PRIMARY layer                  ${sameCategoryOverlap.filter(o => o.layer === 'primary').length}  (the rule targets these)`)
console.log(`        inline/review, overlap by design      ${sameCategoryOverlap.filter(o => o.deliberate).length}`)
console.log(`    review-layer collisions                   ${contextCollision.length}`)
console.log('\n→ audit/occurrence-ledger-dryrun.json\n')
