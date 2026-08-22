// The unhighlighted-sentence census, measured against WHAT THE BROWSER PAINTED.
//
// audit-unhighlighted-sentences.mjs transcribes renderPostBody() into Node. That transcription is
// only true until the renderer moves, and PROJECT_CONTEXT names the consequence: a near-enough
// reimplementation invents uncovered text that is actually painted. This pass takes the painted
// character ranges that audit-painted-truth.mjs read out of the rendered DOM and measures the
// same units against those instead.
//
// Unit boundaries come from scripts/lib/units.mjs — the SAME code the transcription pass uses —
// so where the two disagree it is always about what is painted, never about where a sentence
// starts. The diagnostic columns (certified-but-unpainted layers, quoted-source flags) are joined
// from the census output by post + offset.
//
// AUDIT ONLY. Classifies nothing, changes nothing, deploys nothing.
//
//   node scripts/audit-painted-truth.mjs --base https://qdrops.app
//   node scripts/audit-unhighlighted-from-truth.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import { unitsWithOffsets, coverage, overlapping, formOf, hintFor } from './lib/units.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit', 'unhighlighted-sentences')
const uniq = a => [...new Set(a)]
const sha = s => crypto.createHash('sha256').update(s).digest('hex')

const truthFile = path.join(OUT, 'painted-truth.jsonl')
if (!fs.existsSync(truthFile)) {
  console.error('REFUSED: no painted-truth.jsonl. Run scripts/audit-painted-truth.mjs first.')
  process.exit(2)
}
const truth = fs.readFileSync(truthFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const postsRaw = fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8')
const posts = JSON.parse(postsRaw)
const byNum = new Map(posts.map(p => [p.postNum, p]))

// ── the DOM's mark → the category it is showing ──────────────────────────────
// The renderer sets a `title` on some marks and only Tailwind colour classes on others, so both
// are read. An unmapped mark is reported as `unknown:` rather than silently counted as coverage.
const KNOWN = new Set(['question', 'request', 'requestQuestion', 'namedEntity', 'claim', 'prediction',
  'theme', 'bracketCode', 'url', 'emphasis', 'context', 'topic', 'qSignature', 'milIntel'])
function kindsOf(raw) {
  const s = String(raw ?? '')
  if (s === 'link') return ['url']
  if (s === 'bracket') return ['bracketCode']
  // The renderer also sets a BARE kind as the title on some marks. Without this the class-based
  // fallbacks miss them and 147 real highlights were reported as unmapped, inventing leftovers.
  if (KNOWN.has(s)) return [s]
  let m = s.match(/^(\w+) \(inside a question\)$/)
  if (m) return [m[1]]
  m = s.match(/^\d+ certified layers: (.+)$/)
  if (m) return m[1].split(/,\s*/).filter(Boolean)
  if (/animate-req-question/.test(s)) return ['requestQuestion']
  if (/ring-red-400|animate-flash/.test(s)) return ['searchHighlight']
  if (/bg-blue-500/.test(s)) return ['question']
  if (/bg-green-500/.test(s)) return ['request']
  if (/bg-cyan-500/.test(s)) return ['namedEntity']
  if (/bg-amber-500/.test(s)) return ['claim']
  if (/bg-violet-500/.test(s)) return ['prediction']
  if (/bg-indigo-500/.test(s)) return ['theme']
  if (/bg-red-800/.test(s)) return ['bracketCode']
  if (/bg-yellow-400/.test(s)) return ['topic']
  if (/bg-purple-400/.test(s)) return ['qSignature']
  if (/bg-slate-300/.test(s)) return ['emphasis']
  if (/text-blue-400.*underline/.test(s)) return ['url']
  return ['unknown:' + s.slice(0, 48)]
}

// Categories that can OWN a whole sentence. Same owner rule as the transcription pass: an entity,
// bracket, theme anchor or link inside a sentence never speaks for the sentence around it.
const SENTENCE_LEVEL = new Set(['question', 'request', 'requestQuestion', 'claim', 'prediction'])

// ── diagnostics, joined from the transcription pass ──────────────────────────
const censusFile = path.join(OUT, 'unhighlighted-sentences.jsonl')
const census = new Map()
if (fs.existsSync(censusFile)) {
  for (const line of fs.readFileSync(censusFile, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const r = JSON.parse(line)
    census.set(`${r.postNumber}:${r.sentenceStart}`, r)
  }
}

// ── run ──────────────────────────────────────────────────────────────────────
const rows = []
const stats = { postsRead: 0, units: 0, fullyPainted: 0, marks: 0, byForm: {}, byHint: {}, unknownKinds: {} }
const failed = []

for (const t of truth) {
  if (t.error) { failed.push({ postNum: t.postNum, error: t.error }); continue }
  const post = byNum.get(t.postNum)
  if (!post) continue
  stats.postsRead++
  const text = t.domText
  const quoted = sourceLines(text)

  const painted = []
  for (const s of t.painted ?? []) {
    for (const k of kindsOf(s.kind)) {
      if (k.startsWith('unknown:')) stats.unknownKinds[k] = (stats.unknownKinds[k] ?? 0) + 1
      // The search highlight is navigation, not classification — it only appears when a reader
      // arrives with ?highlight=, and it must never be counted as a category owning the text.
      if (k === 'searchHighlight') continue
      painted.push({ start: s.start, end: s.end, kind: k })
    }
  }
  stats.marks += painted.length
  const catSpans = painted.filter(s => SENTENCE_LEVEL.has(s.kind))
  const refs = [...text.matchAll(/>>\d+/g)].map(m => ({ start: m.index, end: m.index + m[0].length }))
  const inRef = i => refs.some(r => i >= r.start && i < r.end)

  let idx = 0
  for (const u of unitsWithOffsets(text)) {
    stats.units++
    idx++
    const all = coverage(text, u.start, u.end, painted, inRef)
    if (all.total === 0) continue
    const cat = coverage(text, u.start, u.end, catSpans, inRef)

    const inlineOnly = all.uncovered === 0 && cat.covered === 0
    if (all.uncovered === 0 && !inlineOnly) { stats.fullyPainted++; continue }

    const status = all.uncovered === 0 ? 'INLINE_ONLY_FULLY_PAINTED'
      : all.covered > 0 ? 'PARTIAL_ONLY'
        : 'UNHIGHLIGHTED'

    const over = overlapping(painted, u.start, u.end)
    const form = formOf(u.text)
    const { hint, why } = hintFor(u.text, form)
    const uncoveredText = all.runs.map(r => r.text).join(' ⋯ ')
    const prior = census.get(`${t.postNum}:${u.start}`)
    const quotedReasons = uniq(
      Array.from({ length: u.endLine - u.startLine + 1 }, (_, k) => quoted.get(u.startLine + k)).filter(Boolean),
    )

    stats.byForm[form] = (stats.byForm[form] ?? 0) + 1
    stats.byHint[hint] = (stats.byHint[hint] ?? 0) + 1

    rows.push({
      auditId: `p${String(t.postNum).padStart(4, '0')}-s${String(idx).padStart(3, '0')}`,
      postNumber: t.postNum,
      sentenceIndex: idx,
      sentenceText: u.text,
      sentenceStart: u.start,
      sentenceEnd: u.end,
      lineStart: u.startLine,
      lineEnd: u.endLine,
      segConfidence: u.segConfidence,
      coverageStatus: status,
      paintedCoverage: Number(all.pct.toFixed(6)),
      categoryCoverage: Number(cat.pct.toFixed(6)),
      totalNonWhitespaceCharacters: all.total,
      paintedNonWhitespaceCharacters: all.covered,
      unpaintedNonWhitespaceCharacters: all.uncovered,
      uncoveredText,
      uncoveredOnlyPunctuation: Boolean(uncoveredText) && !/[\p{L}\p{N}]/u.test(uncoveredText),
      uncoveredSegments: all.runs.map(r => ({ start: r.start, end: r.end, text: r.text })),
      paintedLayers: uniq(over.map(s => s.kind)),
      paintedDetail: over.map(s => ({ kind: s.kind, start: s.start, end: s.end, text: text.slice(s.start, s.end) })),
      // Diagnostics the DOM cannot know: whether some certified layer holds this text without
      // painting it. Joined from the transcription pass, which reads the artifacts.
      certifiedNotPaintedLayers: prior?.certifiedNotPaintedLayers ?? [],
      certifiedNotPaintedDetail: prior?.certifiedNotPaintedDetail ?? [],
      rendererMissLikely: false,
      rendererMissDetail: [],
      quotedSource: quotedReasons.length > 0 || Boolean(prior?.quotedSource),
      quotedSourceReason: quotedReasons.join('; ') || prior?.quotedSourceReason || null,
      form,
      routingHint: hint,
      routingHintWhy: why,
      contextBefore: text.slice(Math.max(0, u.start - 220), u.start).trim(),
      contextAfter: text.slice(u.end, Math.min(text.length, u.end + 220)).trim(),
      postText: text.length > 2000 ? text.slice(0, 2000) + '…' : text,
      postLink: post.link ?? null,
      measuredIn: 'RENDERED DOM',
      seenByTranscriptionPass: Boolean(prior),
    })
  }
}

rows.sort((a, b) => a.postNumber - b.postNumber || a.sentenceStart - b.sentenceStart)

// ── triage, identical rules to the transcription pass ────────────────────────
const normKey = t => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const repeats = new Map()
for (const r of rows) repeats.set(normKey(r.sentenceText), (repeats.get(normKey(r.sentenceText)) ?? 0) + 1)
const hasCert = (r, prefix) => r.certifiedNotPaintedLayers.some(k => k === prefix || k.startsWith(prefix + ':'))
function bucketOf(r) {
  if (r.form === 'q_signature') return 'A_SIGNATURE'
  if (r.form === 'url_or_reference') return 'B_LINK_OR_REFERENCE'
  if (r.uncoveredOnlyPunctuation) return 'C_PUNCTUATION_ONLY'
  if (r.coverageStatus === 'INLINE_ONLY_FULLY_PAINTED') return 'D_INLINE_ONLY_FULLY_PAINTED'
  if (r.certifiedNotPaintedLayers.includes('evidence:QUOTED_SOURCE')) return 'E_CERTIFIED_QUOTED_SOURCE'
  if (r.quotedSource) return 'E_CERTIFIED_QUOTED_SOURCE'
  if (hasCert(r, 'context')) return 'G_CERTIFIED_CONTEXT_NOT_PAINTED'
  if (hasCert(r, 'code')) return 'H_CERTIFIED_CODE_NOT_PAINTED'
  if (hasCert(r, 'evidence')) return 'I_CERTIFIED_EVIDENCE_NOT_PAINTED'
  return 'J_UNCLASSIFIED_PROSE'
}
const buckets = {}
for (const r of rows) {
  r.normalizedText = normKey(r.sentenceText)
  r.archiveRepeatCount = repeats.get(r.normalizedText)
  r.triageBucket = bucketOf(r)
  buckets[r.triageBucket] = (buckets[r.triageBucket] ?? 0) + 1
}
const distinctByBucket = {}
for (const b of Object.keys(buckets)) {
  distinctByBucket[b] = new Set(rows.filter(r => r.triageBucket === b).map(r => r.normalizedText)).size
}

// ── how the two measurements disagree ────────────────────────────────────────
const truthKeys = new Set(rows.map(r => `${r.postNumber}:${r.sentenceStart}`))
const measuredPosts = new Set(truth.filter(t => !t.error).map(t => t.postNum))
const censusRows = [...census.values()].filter(r => measuredPosts.has(r.postNumber))
const falsePositives = censusRows.filter(r => !truthKeys.has(`${r.postNumber}:${r.sentenceStart}`))
const newlyFound = rows.filter(r => !r.seenByTranscriptionPass)

const manifest = {
  generatedAt: new Date().toISOString(),
  status: 'AUDIT_ONLY — nothing classified, nothing rebuilt, nothing deployed',
  measurement: 'THE RENDERED DOM. Painted ranges read from <mark> and <a> inside pre.post-text on the published site — not a transcription of the renderer.',
  rule: 'A unit stays in the queue unless every non-whitespace character it owns is painted. Inline highlights (entity, bracket, theme anchor, link) never speak for the sentence around them.',
  sources: {
    postsFile: 'public/data/posts.json',
    postsSha256: sha(postsRaw),
    postsMeasured: stats.postsRead,
    postsFailed: failed.length,
    coordinateSystem: 'the rendered DOM on the published site — pre.post-text, its <mark> and <a> ranges',
    segmenter: 'scripts/lib/units.mjs unitsWithOffsets() — shared with the transcription pass',
    paintedLayers: ['question', 'request', 'requestQuestion', 'namedEntity', 'claim', 'prediction', 'theme', 'bracketCode', 'url'],
    sentenceLevelLayers: [...SENTENCE_LEVEL],
    certifiedButUnpaintedLayers: ['context', 'evidence', 'code'],
    notPaintedByOwnerRuling: ['contextUnits (2026-08-17)'],
    retiredEntirely: ['emphasis (2026-08-21)', 'impliedConclusions (2026-08-21)', 'verificationHooks (2026-08-21)'],
    unmappedMarkClasses: stats.unknownKinds,
  },
  counts: {
    posts: posts.length,
    postsWithText: stats.postsRead,
    postsRead: stats.postsRead,
    units: stats.units,
    fullyPainted: stats.fullyPainted,
    paintedMarks: stats.marks,
    queued: rows.length,
    postsInQueue: new Set(rows.map(r => r.postNumber)).size,
    partialOnly: rows.filter(r => r.coverageStatus === 'PARTIAL_ONLY').length,
    unhighlighted: rows.filter(r => r.coverageStatus === 'UNHIGHLIGHTED').length,
    inlineOnlyFullyPainted: rows.filter(r => r.coverageStatus === 'INLINE_ONLY_FULLY_PAINTED').length,
    punctuationOnlyUncovered: rows.filter(r => r.uncoveredOnlyPunctuation).length,
    alreadyCertifiedUnpainted: rows.filter(r => r.certifiedNotPaintedLayers.length > 0).length,
    quotedSource: rows.filter(r => r.quotedSource).length,
    trulyUnclassified: rows.filter(r => r.certifiedNotPaintedLayers.length === 0).length,
    distinctSentenceTexts: new Set(rows.map(r => r.normalizedText)).size,
    byForm: stats.byForm,
    byHint: stats.byHint,
    byTriageBucket: buckets,
    distinctTextsByTriageBucket: distinctByBucket,
  },
  agreement: {
    transcriptionQueuedOnMeasuredPosts: censusRows.length,
    domQueued: rows.length,
    transcriptionSaidUnpaintedButDomPaintsIt: falsePositives.length,
    domSaysUnpaintedButTranscriptionMissedIt: newlyFound.length,
  },
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'unhighlighted-from-truth.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n')
fs.writeFileSync(path.join(OUT, 'truth-manifest.json'), JSON.stringify(manifest, null, 1) + '\n')
if (falsePositives.length) {
  fs.writeFileSync(path.join(OUT, 'transcription-false-positives.jsonl'),
    falsePositives.map(r => JSON.stringify(r)).join('\n') + '\n')
}

const c = manifest.counts
const pct = (n, d) => (d ? `${(n * 100 / d).toFixed(1)}%` : '—')
console.log('\nUNHIGHLIGHTED — MEASURED IN THE RENDERED DOM\n')
console.log(`  posts measured                   : ${c.postsRead.toLocaleString()}${failed.length ? `  (${failed.length} failed)` : ''}`)
console.log(`  marks read from the DOM          : ${c.paintedMarks.toLocaleString()}`)
console.log(`  units segmented                  : ${c.units.toLocaleString()}`)
console.log(`  fully painted, excluded          : ${c.fullyPainted.toLocaleString()}  (${pct(c.fullyPainted, c.units)})`)
console.log(`  QUEUED                           : ${c.queued.toLocaleString()}  across ${c.postsInQueue.toLocaleString()} posts`)
console.log(`    completely unhighlighted       : ${c.unhighlighted.toLocaleString()}`)
console.log(`    partially highlighted          : ${c.partialOnly.toLocaleString()}`)
console.log(`    inline-only                    : ${c.inlineOnlyFullyPainted.toLocaleString()}`)
console.log(`    punctuation-only leftover      : ${c.punctuationOnlyUncovered.toLocaleString()}`)
console.log(`  distinct wordings                : ${c.distinctSentenceTexts.toLocaleString()}`)
console.log('\n  AGREEMENT WITH THE TRANSCRIPTION PASS')
const a = manifest.agreement
console.log(`    transcription queued           : ${a.transcriptionQueuedOnMeasuredPosts.toLocaleString()}`)
console.log(`    DOM queued                     : ${a.domQueued.toLocaleString()}`)
console.log(`    transcription WRONG (it is painted) : ${a.transcriptionSaidUnpaintedButDomPaintsIt.toLocaleString()}`)
console.log(`    transcription MISSED (it is not)    : ${a.domSaysUnpaintedButTranscriptionMissedIt.toLocaleString()}`)
if (Object.keys(stats.unknownKinds).length) {
  console.log('\n  UNMAPPED MARK CLASSES — these were NOT counted as coverage:')
  for (const [k, v] of Object.entries(stats.unknownKinds)) console.log(`    ${v}x  ${k}`)
}
console.log('\n  triage buckets (rows / distinct wordings):')
for (const [k, v] of Object.entries(buckets).sort()) console.log(`    ${k.padEnd(34)} ${String(v).padStart(6)} / ${String(distinctByBucket[k]).padStart(5)}`)
console.log('')
