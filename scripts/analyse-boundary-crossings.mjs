// PHASE B2 — the boundary-crossing families, by structural shape.
//
//   node scripts/analyse-boundary-crossings.mjs
//
// Reports only. Writes audit/step3b1-b2-analysis.json.
//
// A boundary-crossing record is a certified span that starts inside one ledger sentence and ends
// inside another. That is one SYMPTOM with several different causes, and the owner's URL ruling
// answers only one of them:
//
//   "A raw URL is NOT claim/question/directive/prediction paint merely for geometric coverage."
//
// So the question this asks is not "how do I make them stop crossing" — it is "which of these is a
// span that accidentally swallowed a non-semantic line, and which is a span that genuinely covers
// two sentences and therefore needs a person."
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const queue = JSON.parse(fs.readFileSync(path.join(OUT, 'step3b1-conflict-queue-rebuilt.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

/** A line that carries no semantic unit of its own: a bare link, a board pointer, empty. */
const URL_RE = /https?:\/\/|www\.[a-z0-9-]+\./i
const POINTER_RE = /^(?:>|&gt;){1,2}\s*\d{3,}$/
//
// TWO DIFFERENT MISTAKES ARE POSSIBLE HERE AND BOTH WERE MADE BEFORE THIS SETTLED.
//
// Call a line non-semantic too readily and genuine Q prose gets dropped: "Smiles." (#1090) and
// "DC access." (#1098) are short, and a word-count floor throws both away. Call it too rarely and a
// claim gets trimmed down to "[30]" (#1280), "@2:20" (#1532) or "[Sample 3]" (#1785), leaving a
// certified Claim that asserts a caption.
//
// The test is therefore not LENGTH. It is whether the line IS a link, a pointer or a bare label —
// whether anything survives once those are removed.
const isNonSemanticLine = t => {
  const s = String(t).trim()
  if (!s) return true
  if (POINTER_RE.test(s)) return true
  // THE BOARD BROKE LONG URLS AFTER THE PROTOCOL, and lib/runtimeText.mjs documents it: a drop
  // carries "https:// www.nbcnews.com/..." for "https://www.nbcnews.com/...". A \S+ after the
  // protocol stops at that space, so the spaced form survived the strip and a bare link line read
  // as prose. #1253 is two spaced links and nothing else, and it sat in the queue because of it.
  const stripUrls = x => x.replace(/\S*https?:\/\/\s*\S+/gi, ' ').replace(/\S*www\.\S+/gi, ' ')
  if (URL_RE.test(s)) {
    // A link line: nothing but punctuation or a short label sits beside the URL.
    return stripUrls(s).replace(/[\s\[\]()<>.,;:—–-]/g, '').length <= 3
  }
  // No URL. Non-semantic only if the whole line is a bracketed label, a timestamp or a bare
  // number — i.e. nothing at all is left once those are removed.
  const residue = s.replace(/\[[^\]]*\]/g, ' ').replace(/@\d[\d:.]*/g, ' ').replace(/^[\s>]*\d+[.)]?\s*$/, ' ')
  return !/[A-Za-z0-9]/.test(residue)
}

const rows = []
for (const c of queue.rows.filter(r => r.reason === 'BOUNDARY_CROSSING')) {
  const [, kind, s, e] = c.heldKey.split('|')
  const start = Number(s), end = Number(e)
  const p = byNum.get(c.postNum)
  const body = runtimeText(p?.text ?? '')
  const sentences = sentencesFor(p?.text ?? '', c.postNum)
  const touched = sentences.filter(x => x.start < end && start < x.end)
  const span = body.slice(start, end)

  // Split the touched sentences into the ones that carry prose and the ones that do not.
  const semantic = touched.filter(t => !isNonSemanticLine(t.text))
  const nonSemantic = touched.filter(t => isNonSemanticLine(t.text))

  // Does the span reach outside the sentences it "should" cover, i.e. is the crossing caused
  // ENTIRELY by non-semantic lines at one or both ends?
  const trimStart = semantic.length ? semantic[0].start : null
  const trimEnd = semantic.length ? semantic[semantic.length - 1].end : null
  const trimmedToOneSentence = semantic.length === 1

  let shape
  if (!touched.length) shape = 'NO_SENTENCE_TOUCHED'
  else if (!semantic.length) shape = 'ENTIRELY_NON_SEMANTIC'
  else if (nonSemantic.length && trimmedToOneSentence) shape = 'TRIM_TO_ONE_SENTENCE'
  else if (nonSemantic.length && semantic.length > 1) shape = 'TRIM_STILL_SPANS_SENTENCES'
  else if (semantic.length > 1) shape = 'GENUINE_MULTI_SENTENCE'
  else shape = 'SINGLE_SENTENCE_OFFSET_DRIFT'

  rows.push({
    conflictId: c.conflictId, heldKey: c.heldKey, postNum: c.postNum, kind, start, end,
    sentencesTouched: touched.length,
    semanticSentences: semantic.length, nonSemanticSentences: nonSemantic.length,
    containsUrl: URL_RE.test(span),
    shape,
    proposedSpan: shape === 'TRIM_TO_ONE_SENTENCE' ? { start: trimStart, end: trimEnd,
      text: body.slice(trimStart, trimEnd) } : null,
    droppedText: shape === 'TRIM_TO_ONE_SENTENCE'
      ? nonSemantic.map(t => t.text.slice(0, 90)) : nonSemantic.map(t => t.text.slice(0, 60)),
    spanPreview: span.slice(0, 140),
    sentencePreviews: touched.map(t => ({ id: t.sentenceId, semantic: !isNonSemanticLine(t.text), text: t.text.slice(0, 90) })),
  })
}

const tally = (list, f) => {
  const t = {}
  for (const x of list) { const k = f(x); t[k] = (t[k] ?? 0) + 1 }
  return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]))
}
const doc = {
  note: 'PHASE B2 analysis. Report only — nothing applied.',
  totalBoundaryRows: rows.length,
  byShape: tally(rows, r => r.shape),
  byShapeAndUrl: tally(rows, r => `${r.shape} | url=${r.containsUrl}`),
  byKind: tally(rows, r => r.kind),
  deterministic: rows.filter(r => r.shape === 'TRIM_TO_ONE_SENTENCE').length,
  rows,
}
fs.writeFileSync(path.join(OUT, 'step3b1-b2-analysis.json'), JSON.stringify(doc, null, 1))

console.log(`boundary-crossing rows: ${rows.length}\n`)
for (const [k, v] of Object.entries(doc.byShape)) console.log(`  ${String(v).padStart(4)}  ${k}`)
console.log('\nwith / without a URL in the span:')
for (const [k, v] of Object.entries(doc.byShapeAndUrl)) console.log(`  ${String(v).padStart(4)}  ${k}`)
console.log('\nTRIM_TO_ONE_SENTENCE examples:')
for (const r of rows.filter(x => x.shape === 'TRIM_TO_ONE_SENTENCE').slice(0, 6)) {
  console.log(`  #${r.postNum} ${r.kind} ${r.start}..${r.end} -> ${r.proposedSpan.start}..${r.proposedSpan.end}`)
  console.log(`     keeps  : ${JSON.stringify(r.proposedSpan.text.slice(0, 88))}`)
  console.log(`     drops  : ${JSON.stringify(r.droppedText)}`.slice(0, 130))
}
console.log('\nGENUINE_MULTI_SENTENCE examples:')
for (const r of rows.filter(x => x.shape === 'GENUINE_MULTI_SENTENCE').slice(0, 5))
  console.log(`  #${r.postNum} ${r.kind}  ${JSON.stringify(r.spanPreview.slice(0, 100))}`)
console.log('\n-> audit/step3b1-b2-analysis.json')
