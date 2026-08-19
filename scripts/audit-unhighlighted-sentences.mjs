// Unhighlighted-sentence audit — every Q-authored unit in #1–#4966 that the drop body does NOT
// paint 100% in a category.
//
// OWNER RULE (locked): if ANY non-whitespace character of a complete sentence is outside an
// active highlight, the WHOLE sentence goes in the list. A highlighted name, bracket, link or
// theme anchor inside a sentence never hides the rest of it. Only 100% coverage excludes.
//
// This is the INVERSE of audit-highlight-coverage.mjs. That one asks "does every certified
// occurrence resolve to a span?"; this one asks "is every character of every sentence owned by
// a category?" — the question behind the goal of a fully classified archive.
//
// FIDELITY: the coverage set is the renderer's own, transcribed from renderPostBody() in
// src/pages/PostDetail.tsx and highlightText() in src/lib/postHighlight.tsx — same layers, same
// escaping, same alias expansion, same word boundaries, same >>ref protection, and the same
// runtimeText() coordinate system the browser paints in. A near-enough reimplementation would
// invent uncovered text that is actually painted, which is the whole failure mode here.
//
// Layers that PAINT (owner rulings 2026-08-17 removed Context and Emphasis from the body):
//   question · request/requestQuestion · namedEntity · claim · prediction · theme · bracketCode · url
// Layers that are CERTIFIED but do NOT paint, reported per row so the leftovers can be triaged:
//   emphasis · contextUnits · evidence · codes
//
// AUDIT ONLY. Classifies nothing, changes nothing, deploys nothing.
//
//   node scripts/audit-unhighlighted-sentences.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import { imperativeMood, familyOf } from './lib/imperative.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit', 'unhighlighted-sentences')

const readRaw = f => fs.readFileSync(path.join(DATA, f), 'utf8')
const read = f => JSON.parse(readRaw(f))
const sha = s => crypto.createHash('sha256').update(s).digest('hex')

const postsRaw = readRaw('posts.json')
const posts = JSON.parse(postsRaw)
const questions = read('questions.json')
const aliasesJson = read('aliases.json')
const entitiesJson = read('entities.json')
const emphasisJson = read('emphasis.json')
const evidenceJson = read('evidence.json')
const codesJson = read('codes.json')

// ── the renderer's matching rule, transcribed ────────────────────────────────
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi

function escapeAndNormalize(term) {
  let e = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  e = e.replace(/['\u2018\u2019\u201A\u201B]/g, "(?:'|\u2018|\u2019)")
  e = e.replace(/["\u201C\u201D\u201E\u201F]/g, '(?:"|\u201C|\u201D)')
  e = e.replace(/[-\u2013\u2014]/g, '(?:-|\u2013|\u2014)')
  return e
}
function wordBoundaryPattern(escaped, raw) {
  const startsWord = /[A-Za-z0-9]/.test(raw[0] ?? '')
  const endsWord = /[A-Za-z0-9]/.test(raw[raw.length - 1] ?? '')
  return `${startsWord ? '(?<![A-Za-z0-9])' : ''}${escaped}${endsWord ? '(?![A-Za-z0-9])' : ''}`
}
// src/lib/posts.ts — certifiedQuestionRegex + UNIT_START
const UNIT_START = '(?<=^|[\\n\\r]|[.?!\u2026:]["\'\u201D\u2019)\\]]?\\s|(?:ask\\s+yourself|think)[^\\n\\r]{0,60}?[,\\-\u2013\u2014:]\\s)'
function certifiedQuestionRegex(questionText) {
  const core = String(questionText ?? '').replace(/\s+/g, ' ').trim()
  if (!core) return null
  const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
  try { return new RegExp(`${UNIT_START}\\s*${escaped}(?![a-zA-Z0-9])`, 'gi') } catch { return null }
}
// src/pages/PostDetail.tsx — bracketSpansIn (runtime text is already entity-decoded)
function bracketSpansIn(text) {
  if (!text) return []
  const out = [], seen = new Set()
  for (const m of text.matchAll(/\[[^[\]\n]{1,60}\]/g)) {
    if (!seen.has(m[0])) { seen.add(m[0]); out.push(m[0]) }
  }
  return out
}
// src/lib/posts.ts — expandToSentence
const MAX_SENTENCE = 400
function expandToSentence(item, postText) {
  const needle = String(item ?? '').trim()
  if (!needle || !postText) return needle
  const at = postText.toLowerCase().indexOf(needle.toLowerCase())
  if (at === -1) return needle
  const isEnd = i => '.!?'.includes(postText[i]) && !/[A-Za-z0-9]/.test(postText[i + 1] ?? '')
  let start = at
  while (start > 0) { const ch = postText[start - 1]; if (ch === '\n' || isEnd(start - 1)) break; start-- }
  let end = at + needle.length
  while (end < postText.length) { if (postText[end] === '\n') break; if (isEnd(end)) { end++; break } end++ }
  const out = postText.slice(start, end).trim().replace(/\s+/g, ' ')
  return !out || out.length > MAX_SENTENCE ? needle : out
}

// ── the two alias registries, unioned exactly as getAliasesFor() does ────────
const editableMap = aliasesJson
const canonicalOfEditable = t => {
  for (const [canon, arr] of Object.entries(editableMap)) if (arr.some(a => a.toLowerCase().trim() === t)) return canon
  return null
}
const certifiedMembers = {}
const certifiedIndex = new Map()
for (const e of entitiesJson.entities ?? []) {
  const canon = (e.canonical ?? '').trim()
  if (!canon) continue
  const key = canon.toLowerCase()
  const members = (e.aliases ?? []).map(a => (a.text ?? '').trim()).filter(Boolean)
  if (!members.length) continue
  certifiedMembers[key] = [...new Set(members.filter(m => m.toLowerCase() !== key))]
  certifiedIndex.set(key, key)
  for (const m of certifiedMembers[key]) certifiedIndex.set(m.toLowerCase(), key)
}
const aliasCache = new Map()
function getAliasesFor(term) {
  const t = String(term ?? '').toLowerCase().trim()
  if (!t) return []
  if (aliasCache.has(t)) return aliasCache.get(t)
  const canon = editableMap[t] ? t : canonicalOfEditable(t)
  const editable = canon ? [canon, ...(editableMap[canon] ?? [])] : [term]
  const certKey = certifiedIndex.get(t)
  let cert = []
  if (certKey) {
    const members = certifiedMembers[certKey] ?? []
    cert = [...new Set([members.find(m => m.toLowerCase() === certKey) ?? certKey, ...members])]
  }
  const seen = new Set([t]), out = []
  for (const g of [...editable, ...cert]) {
    const k = g.toLowerCase().trim()
    if (!k || seen.has(k)) continue
    seen.add(k); out.push(g)
  }
  aliasCache.set(t, out)
  return out
}

// ── span collection, per post ────────────────────────────────────────────────
const PAINTED = ['question', 'request', 'requestQuestion', 'namedEntity', 'claim', 'prediction', 'theme', 'bracketCode', 'url']
// Categories that can OWN a whole sentence. Entities, brackets, theme anchors and links are
// inline items — owner rule: they never speak for the sentence around them.
const SENTENCE_LEVEL = new Set(['question', 'request', 'requestQuestion', 'claim', 'prediction'])

function addTerm(segs, text, term, kind) {
  if (!term || !String(term).trim()) return
  const raw = String(term)
  let rx
  try { rx = new RegExp(wordBoundaryPattern(escapeAndNormalize(raw), raw), 'gi') } catch { return }
  let m
  while ((m = rx.exec(text)) !== null) {
    if (m.index === rx.lastIndex) rx.lastIndex++
    if (m[0].length) segs.push({ start: m.index, end: m.index + m[0].length, kind, term: raw })
  }
}

const questionsByPost = new Map()
for (const q of questions) {
  if (!questionsByPost.has(q.postNum)) questionsByPost.set(q.postNum, [])
  questionsByPost.get(q.postNum).push(q)
}
const emphasisByPost = new Map()
for (const o of emphasisJson.occurrences ?? []) {
  if (!emphasisByPost.has(o.postNum)) emphasisByPost.set(o.postNum, [])
  emphasisByPost.get(o.postNum).push(o)
}
const evidenceByPost = new Map()
for (const i of evidenceJson.items ?? []) {
  if (i.kind === 'MEDIA' || !i.value) continue
  if (!evidenceByPost.has(i.postNum)) evidenceByPost.set(i.postNum, [])
  evidenceByPost.get(i.postNum).push(i)
}
const codesByPost = new Map()
for (const c of codesJson.codes ?? []) {
  for (const pn of c.posts ?? []) {
    if (!codesByPost.has(pn)) codesByPost.set(pn, [])
    codesByPost.get(pn).push(c)
  }
}

/** Every span the drop body actually paints, plus the certified layers that do not. */
function spansFor(post, text) {
  const painted = []
  const a = post.postAnalysis ?? {}

  // Questions — question FORM, exactly as the highlighters match. localData strips markup from
  // q.text and nothing else, so this does too.
  for (const q of questionsByPost.get(post.postNum) ?? []) {
    const qt = String(q.text ?? '').replace(MARKUP, '')
    const rx = certifiedQuestionRegex(qt)
    if (!rx) continue
    let m
    while ((m = rx.exec(text)) !== null) {
      painted.push({ start: m.index, end: m.index + m[0].length, kind: 'question', term: qt })
      if (m.index === rx.lastIndex) rx.lastIndex++
    }
  }
  // Directives
  for (const req of post.actionRequests ?? []) {
    addTerm(painted, text, req, String(req).trim().endsWith('?') ? 'requestQuestion' : 'request')
  }
  // Certified analysis layers, each with its registered alias spellings (PostDetail's rule).
  const whole = arr => (arr ?? []).map(t => expandToSentence(t, text))
  const pairs = [
    ['namedEntity', a.namedEntities ?? []],
    ['claim', a.claimSpans ?? whole(a.claims)],
    ['prediction', a.predictionSpans ?? whole(a.predictions)],
    ['theme', a.themeAnchors ?? []],
    ['bracketCode', bracketSpansIn(text)],
  ]
  for (const [kind, items] of pairs) {
    for (const item of items) for (const v of [item, ...getAliasesFor(item)]) addTerm(painted, text, v, kind)
  }
  // URLs
  for (const m of text.matchAll(/https?:\/\/[^\s<>'")\]]+/g)) {
    painted.push({ start: m.index, end: m.index + m[0].length, kind: 'url', term: m[0] })
  }

  // Certified but NOT painted in the body — reported so a leftover can be told apart from a
  // sentence nothing has ever looked at.
  const unpainted = []
  for (const e of a.emphasis ?? []) addTerm(unpainted, text, e, 'emphasis')
  for (const o of emphasisByPost.get(post.postNum) ?? []) {
    const spans = o.type === 'parallel_phrasing'
      ? String(o.line ?? '').split(' / ').map(s => s.trim()).filter(Boolean)
      : [o.sourceText]
    for (const s of spans) addTerm(unpainted, text, s, 'emphasis')
  }
  for (const c of a.contextUnits ?? []) addTerm(unpainted, text, c, 'context')
  for (const i of evidenceByPost.get(post.postNum) ?? []) addTerm(unpainted, text, runtimeText(i.literal ?? i.value), `evidence:${i.kind}`)
  for (const c of codesByPost.get(post.postNum) ?? []) for (const s of c.sourceTexts ?? []) addTerm(unpainted, text, s, 'code')

  // WOULD-PAINT diagnostic: the same certified terms put through runtimeText(). posts.json keeps
  // the board's raw encoding and localData only cleans SIX analysis arrays — claimSpans,
  // predictionSpans and themeAnchors are not among them — so a certified span carrying `&amp;`
  // or an `<em>` tag cannot match the body the browser renders. Text covered here but not in
  // `painted` is a renderer miss, not an unclassified sentence.
  const wouldPaint = []
  for (const [kind, items] of pairs) {
    for (const item of items) {
      const cleaned = runtimeText(item)
      if (cleaned !== item) addTerm(wouldPaint, text, cleaned, kind)
    }
  }
  for (const req of post.actionRequests ?? []) {
    const cleaned = runtimeText(req)
    if (cleaned !== req) addTerm(wouldPaint, text, cleaned, 'request')
  }

  // >>NNNN pointers are never painted — renderPostBody drops any interval overlapping one.
  const refs = [...text.matchAll(/>>\d+/g)].map(m => ({ start: m.index, end: m.index + m[0].length }))
  const clearOfRefs = s => !refs.some(r => s.start < r.end && s.end > r.start)
  return { painted: painted.filter(clearOfRefs), unpainted, wouldPaint: wouldPaint.filter(clearOfRefs), refs }
}

// ── segmentation, with offsets into the runtime body ─────────────────────────
// scripts/lib/segment.mjs unitsFor(), extended to carry the offsets a coverage measure needs.
// Same line handling, same continuation rule, same sentence split — two auditors drawing unit
// boundaries differently is the duplicated-logic failure this project has already hit four times.
const CONTINUES = /[,;:]$|\b(and|or|but|of|to|in|on|for|with|from|the|a|an|that|which|while|when|if|by|as)$/i

function unitsWithOffsets(text) {
  const lines = []
  let pos = 0
  for (const rawLine of text.split('\n')) {
    const lead = rawLine.length - rawLine.replace(/^\s+/, '').length
    const t = rawLine.trim()
    lines.push({ text: t, start: pos + lead, end: pos + lead + t.length })
    pos += rawLine.length + 1
  }
  const out = []
  let i = 0
  while (i < lines.length) {
    const first = lines[i]
    if (!first.text || /^>>\d+/.test(first.text)) { i++; continue }
    const startLine = i
    let joined = first.text
    const map = []
    for (let k = 0; k < first.text.length; k++) map.push(first.start + k)
    let joins = 0
    let segConfidence = 'HIGH'
    while (joins < 2 && i + 1 < lines.length) {
      const next = lines[i + 1]
      if (!next.text || /^>>\d+/.test(next.text)) break
      const incomplete = !/[?.!:\u2026]$/.test(joined) && (CONTINUES.test(joined) || /^[a-z]/.test(next.text))
      if (!incomplete) break
      joined += ' ' + next.text
      map.push(-1)
      for (let k = 0; k < next.text.length; k++) map.push(next.start + k)
      i++; joins++; segConfidence = 'MEDIUM'
    }
    const parts = []
    const rx = /([?!.])(\s+)(?=[A-Z(\u201C"']|\d)/g
    let last = 0, m
    while ((m = rx.exec(joined)) !== null) { parts.push([last, m.index + 1]); last = m.index + m[0].length }
    parts.push([last, joined.length])
    for (const [a0, b0] of parts) {
      let s = a0, e = b0
      while (s < e && /\s/.test(joined[s])) s++
      while (e > s && /\s/.test(joined[e - 1])) e--
      if (e <= s) continue
      let rs = s; while (rs < e && map[rs] === -1) rs++
      let re = e - 1; while (re > s && map[re] === -1) re--
      if (map[rs] === -1 || map[re] === -1) continue
      out.push({
        text: joined.slice(s, e),
        start: map[rs],
        end: map[re] + 1,
        startLine, endLine: i,
        segConfidence: parts.length > 1 && segConfidence === 'HIGH' ? 'MEDIUM' : segConfidence,
      })
    }
    i++
  }
  return out
}

// ── coverage ─────────────────────────────────────────────────────────────────
/** Non-whitespace coverage of [start,end) by `spans`, with the uncovered runs. */
function coverage(text, start, end, spans, skip) {
  const n = end - start
  const hit = new Uint8Array(Math.max(0, n))
  for (const s of spans) {
    const a = Math.max(start, s.start), b = Math.min(end, s.end)
    for (let i = a; i < b; i++) hit[i - start] = 1
  }
  const runs = []
  let total = 0, covered = 0, runStart = null
  const close = at => {
    if (runStart === null) return
    let a = runStart, b = at
    while (a < b && /\s/.test(text[a])) a++
    while (b > a && /\s/.test(text[b - 1])) b--
    if (b > a) runs.push({ start: a, end: b, text: text.slice(a, b) })
    runStart = null
  }
  for (let i = start; i < end; i++) {
    if (/\s/.test(text[i])) continue
    if (skip && skip(i)) continue
    total++
    if (hit[i - start]) { covered++; close(i) } else if (runStart === null) runStart = i
  }
  close(end)
  return { total, covered, uncovered: total - covered, pct: total ? covered / total : 1, runs }
}

const overlapping = (spans, s, e) => spans.filter(x => x.start < e && x.end > s)
const uniq = arr => [...new Set(arr)]

// ── forms and routing hints (non-binding) ────────────────────────────────────
// Q's sign-off. 4,320 drops end with a bare "Q" and it is not a sentence anybody needs to
// classify twice — one ruling covers the whole population, so it gets its own form and bucket
// rather than 4,320 identical review rows in the middle of the prose.
const SIGNATURE = /^(?:q\+?|q\s*!\S*|wwg1wga|ncswic|wrwy)[.!?]*$/i

function formOf(t0) {
  const t = t0.trim()
  if (!t) return 'empty'
  if (SIGNATURE.test(t)) return 'q_signature'
  if (/^(?:https?:\/\/\S+|www\.\S+|>>\d+|\[?\w+\.(?:jpg|jpeg|png|gif|pdf)\]?)$/i.test(t)) return 'url_or_reference'
  if (/^[\W_\d]+$/u.test(t)) return 'symbolic_or_numeric'
  if (/[.!?]+[\]})'"\u201D\u2019\u2026]*$/.test(t)) return 'complete_sentence'
  if (/[:;][\]})'"\u201D\u2019]*$/.test(t)) return 'colon_or_semicolon_block'
  const words = t.match(/[A-Za-z'\u2019]+/g) ?? []
  const hasVerbish = /\b(?:am|are|is|was|were|be|been|being|can|could|do|does|did|has|have|had|may|might|must|shall|should|will|would)\b/i.test(t)
    || /\b\w+(?:ed|ing)\b/i.test(t) || imperativeMood(t).imperative
  if (words.length >= 3 && hasVerbish) return 'sentence_like_no_terminal'
  return 'fragment_or_label'
}

function hintFor(t0, form) {
  const t = t0.trim()
  if (form === 'q_signature') return { hint: 'Q_SIGNATURE', why: "Q's sign-off — one blanket ruling covers every occurrence" }
  if (form === 'url_or_reference') return { hint: 'LINK_OR_CITATION', why: 'the unit is a URL, board pointer or file reference, not prose' }
  if (/[?][\]})'"\u201D\u2019]*$/.test(t)) return { hint: 'QUESTION_NOT_CERTIFIED', why: 'ends in a question mark but no certified question covers it' }
  const mood = imperativeMood(t)
  if (mood.imperative) return { hint: 'DIRECTIVE_CANDIDATE', why: `${mood.why}; family ${familyOf(t)}` }
  if (mood.undecidable) return { hint: 'NEEDS_CONTEXT', why: mood.why }
  if (/\b(?:god|lord|jesus|christ|bible|scripture|pray(?:er)?|faith|amen|satan|devil|heaven|psalm|corinthians|ephesians)\b/i.test(t)) {
    return { hint: 'RELIGIOUS_THEME_CANDIDATE', why: 'religious or scriptural vocabulary — check quoted-source boundaries' }
  }
  if (/\b(?:will|shall|coming|soon|incoming|expect)\b/i.test(t)) {
    return { hint: 'PREDICTION_CANDIDATE', why: 'future-facing language' }
  }
  if (form === 'fragment_or_label' || form === 'symbolic_or_numeric') {
    return { hint: 'LABEL_FRAGMENT_OR_DEVICE', why: 'short label, slogan, heading or symbolic device rather than a proposition' }
  }
  return { hint: 'CLAIM_CANDIDATE', why: 'declarative prose — decide Q-authored claim vs quoted claim vs aphorism' }
}

// ── run ──────────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true })
if (posts.length !== 4966) {
  console.error(`REFUSED: posts.json holds ${posts.length} posts, not the canonical 4,966.`)
  process.exit(2)
}

const rows = []
const stats = {
  postsWithText: 0, units: 0, fullyPainted: 0, paintedSpans: 0,
  byForm: {}, byHint: {},
}

for (const post of posts) {
  const text = runtimeText(post.text ?? '')
  if (!text.trim()) continue
  stats.postsWithText++

  const { painted, unpainted, wouldPaint, refs } = spansFor(post, text)
  stats.paintedSpans += painted.length
  const inRef = i => refs.some(r => i >= r.start && i < r.end)
  const quoted = sourceLines(text)
  const catSpans = painted.filter(s => SENTENCE_LEVEL.has(s.kind))

  let idx = 0
  for (const u of unitsWithOffsets(text)) {
    stats.units++
    idx++
    const all = coverage(text, u.start, u.end, painted, inRef)
    if (all.total === 0) continue                       // nothing but >>refs / whitespace
    const cat = coverage(text, u.start, u.end, catSpans, inRef)

    const inlineOnly = all.uncovered === 0 && cat.covered === 0
    if (all.uncovered === 0 && !inlineOnly) { stats.fullyPainted++; continue }

    const status = all.uncovered === 0 ? 'INLINE_ONLY_FULLY_PAINTED'
      : all.covered > 0 ? 'PARTIAL_ONLY'
        : 'UNHIGHLIGHTED'

    const over = overlapping(painted, u.start, u.end)
    const overUnpainted = overlapping(unpainted, u.start, u.end)
    const overWould = overlapping(wouldPaint, u.start, u.end)
    // Would the leftover be painted if the certified span were normalised to the rendering
    // coordinate system? Then this is a renderer miss, not an unclassified sentence.
    const withWould = coverage(text, u.start, u.end, [...painted, ...overWould], inRef)
    const rendererMiss = overWould.length > 0 && withWould.uncovered < all.uncovered

    const form = formOf(u.text)
    const { hint, why } = hintFor(u.text, form)
    const uncoveredText = all.runs.map(r => r.text).join(' \u22ef ')
    const quotedReasons = uniq(
      Array.from({ length: u.endLine - u.startLine + 1 }, (_, k) => quoted.get(u.startLine + k)).filter(Boolean),
    )

    stats.byForm[form] = (stats.byForm[form] ?? 0) + 1
    stats.byHint[hint] = (stats.byHint[hint] ?? 0) + 1

    rows.push({
      auditId: `p${String(post.postNum).padStart(4, '0')}-s${String(idx).padStart(3, '0')}`,
      postNumber: post.postNum,
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
      certifiedNotPaintedLayers: uniq(overUnpainted.map(s => s.kind)),
      certifiedNotPaintedDetail: overUnpainted.map(s => ({ kind: s.kind, start: s.start, end: s.end, text: text.slice(s.start, s.end) })),
      rendererMissLikely: rendererMiss,
      rendererMissDetail: rendererMiss ? overWould.map(s => ({ kind: s.kind, term: s.term })) : [],
      quotedSource: quotedReasons.length > 0,
      quotedSourceReason: quotedReasons.join('; ') || null,
      form,
      routingHint: hint,
      routingHintWhy: why,
      contextBefore: text.slice(Math.max(0, u.start - 220), u.start).trim(),
      contextAfter: text.slice(u.end, Math.min(text.length, u.end + 220)).trim(),
      postText: text.length > 2000 ? text.slice(0, 2000) + '\u2026' : text,
      postLink: post.link ?? null,
      review: {
        finalCategory: null, subtype: null, explanation: null, confidence: null,
        qAuthored: null, quotedSourceType: null, needsNewCategory: null,
        proposedNewCategory: null, reviewStatus: 'UNREVIEWED',
      },
    })
  }
}

rows.sort((a, b) => a.postNumber - b.postNumber || a.sentenceStart - b.sentenceStart)

// ── triage ───────────────────────────────────────────────────────────────────
// 16,000 rows reviewed one at a time is not a plan. Most of the queue is a handful of
// populations that take ONE ruling each: Q's sign-off (4,320 identical rows), bare links, a
// trailing period left outside an otherwise complete span, and units the archive has already
// dispositioned as Emphasis, Context or quoted source but no longer paints. The bucket is a
// routing aid — it decides nothing, and every row stays in the file.
const normKey = t => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const repeats = new Map()
for (const r of rows) {
  const k = normKey(r.sentenceText)
  repeats.set(k, (repeats.get(k) ?? 0) + 1)
}
const hasCert = (r, prefix) => r.certifiedNotPaintedLayers.some(k => k === prefix || k.startsWith(prefix + ':'))

function bucketOf(r) {
  if (r.form === 'q_signature') return 'A_SIGNATURE'
  if (r.form === 'url_or_reference') return 'B_LINK_OR_REFERENCE'
  if (r.uncoveredOnlyPunctuation) return 'C_PUNCTUATION_ONLY'
  if (r.coverageStatus === 'INLINE_ONLY_FULLY_PAINTED') return 'D_INLINE_ONLY_FULLY_PAINTED'
  if (hasCert(r, 'evidence') && r.certifiedNotPaintedLayers.includes('evidence:QUOTED_SOURCE')) return 'E_CERTIFIED_QUOTED_SOURCE'
  if (r.quotedSource) return 'E_CERTIFIED_QUOTED_SOURCE'
  if (hasCert(r, 'emphasis')) return 'F_CERTIFIED_EMPHASIS_NOT_PAINTED'
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
for (const [b] of Object.entries(buckets)) {
  distinctByBucket[b] = new Set(rows.filter(r => r.triageBucket === b).map(r => r.normalizedText)).size
}

// ── outputs ──────────────────────────────────────────────────────────────────
const CSV = [
  ['postNumber', r => r.postNumber],
  ['postLabel', r => `#${r.postNumber}`],
  ['sentenceIndex', r => r.sentenceIndex],
  ['auditId', r => r.auditId],
  ['triageBucket', r => r.triageBucket],
  ['sentenceText', r => r.sentenceText],
  ['archiveRepeatCount', r => r.archiveRepeatCount],
  ['coverageStatus', r => r.coverageStatus],
  ['paintedCoveragePercent', r => Number((r.paintedCoverage * 100).toFixed(2))],
  ['categoryCoveragePercent', r => Number((r.categoryCoverage * 100).toFixed(2))],
  ['unpaintedCharacters', r => r.unpaintedNonWhitespaceCharacters],
  ['totalCharacters', r => r.totalNonWhitespaceCharacters],
  ['uncoveredText', r => r.uncoveredText],
  ['uncoveredOnlyPunctuation', r => r.uncoveredOnlyPunctuation ? 'YES' : 'NO'],
  ['paintedLayers', r => r.paintedLayers.join(' | ')],
  ['paintedDetail', r => r.paintedDetail.map(d => `${d.kind}: "${d.text}" [${d.start}-${d.end}]`).join(' || ')],
  ['certifiedNotPainted', r => r.certifiedNotPaintedLayers.join(' | ')],
  ['certifiedNotPaintedDetail', r => r.certifiedNotPaintedDetail.map(d => `${d.kind}: "${d.text}"`).join(' || ')],
  ['rendererMissLikely', r => r.rendererMissLikely ? 'YES' : 'NO'],
  ['quotedSource', r => r.quotedSource ? 'YES' : 'NO'],
  ['quotedSourceReason', r => r.quotedSourceReason ?? ''],
  ['form', r => r.form],
  ['segmentationConfidence', r => r.segConfidence],
  ['routingHint', r => r.routingHint],
  ['routingHintWhy', r => r.routingHintWhy],
  ['contextBefore', r => r.contextBefore],
  ['contextAfter', r => r.contextAfter],
  ['sentenceStart', r => r.sentenceStart],
  ['sentenceEnd', r => r.sentenceEnd],
  ['postLink', r => r.postLink ?? ''],
  ['finalCategory', () => ''],
  ['subtype', () => ''],
  ['explanation', () => ''],
  ['confidence', () => ''],
  ['qAuthored', () => ''],
  ['quotedSourceType', () => ''],
  ['needsNewCategory', () => ''],
  ['proposedNewCategory', () => ''],
  ['reviewStatus', () => 'UNREVIEWED'],
]
const NL = String.fromCharCode(10)
// Newlines are folded to a visible marker rather than quoted. RFC 4180 allows a newline inside
// a quoted field and Excel reads it correctly, but these files also get handed to reviewers and
// tools that split on lines, where an embedded newline silently turns one row into three.
const cell = v => `"${String(v ?? '').replace(/\r?\n/g, ' \u23CE ').replace(/"/g, '""')}"`
const csv = [CSV.map(c => cell(c[0])).join(',')]
for (const r of rows) csv.push(CSV.map(c => cell(c[1](r))).join(','))

const manifest = {
  generatedAt: new Date().toISOString(),
  status: 'AUDIT_ONLY — nothing classified, nothing rebuilt, nothing deployed',
  rule: 'A unit stays in the queue unless every non-whitespace character it owns is painted by an active category. Inline highlights (entity, bracket, theme anchor, link) never speak for the sentence around them.',
  sources: {
    postsFile: 'public/data/posts.json',
    postsSha256: sha(postsRaw),
    postCount: posts.length,
    coordinateSystem: 'runtimeText() — board markup stripped and HTML entities decoded, exactly as the browser paints',
    segmenter: 'scripts/lib/segment.mjs unitsFor(), extended with offsets',
    paintedLayers: PAINTED,
    sentenceLevelLayers: [...SENTENCE_LEVEL],
    certifiedButUnpaintedLayers: ['emphasis', 'context', 'evidence', 'code'],
    notPaintedByOwnerRuling: ['emphasis (2026-08-17)', 'contextUnits (2026-08-17)', 'impliedConclusions (retired)', 'verificationHooks (merged into claims)'],
  },
  counts: {
    ...stats,
    posts: posts.length,
    queued: rows.length,
    postsInQueue: new Set(rows.map(r => r.postNumber)).size,
    partialOnly: rows.filter(r => r.coverageStatus === 'PARTIAL_ONLY').length,
    unhighlighted: rows.filter(r => r.coverageStatus === 'UNHIGHLIGHTED').length,
    inlineOnlyFullyPainted: rows.filter(r => r.coverageStatus === 'INLINE_ONLY_FULLY_PAINTED').length,
    punctuationOnlyUncovered: rows.filter(r => r.uncoveredOnlyPunctuation).length,
    rendererMissLikely: rows.filter(r => r.rendererMissLikely).length,
    alreadyCertifiedUnpainted: rows.filter(r => r.certifiedNotPaintedLayers.length > 0).length,
    quotedSource: rows.filter(r => r.quotedSource).length,
    trulyUnclassified: rows.filter(r => !r.rendererMissLikely && r.certifiedNotPaintedLayers.length === 0).length,
    distinctSentenceTexts: new Set(rows.map(r => r.normalizedText)).size,
    byTriageBucket: buckets,
    distinctTextsByTriageBucket: distinctByBucket,
  },
}

// One CSV per triage bucket. 16,024 rows is not something a reviewer -- or a model with a
// context window -- takes in one bite, and the buckets are the populations one ruling settles.
const BUCKET_DIR = path.join(OUT, 'by-bucket')
fs.mkdirSync(BUCKET_DIR, { recursive: true })
for (const bucket of Object.keys(buckets).sort()) {
  const subset = rows.filter(r => r.triageBucket === bucket)
  const lines = [CSV.map(col => cell(col[0])).join(',')]
  for (const r of subset) lines.push(CSV.map(col => cell(col[1](r))).join(','))
  fs.writeFileSync(path.join(BUCKET_DIR, bucket + '.csv'), lines.join(NL) + NL)
}

// One row per distinct wording -- the sheet a reviewer should actually rule on. 8,495 rulings
// settle 16,024 rows, so this is the file that turns the queue into a plan.
const wordingMap = new Map()
for (const r of rows) {
  let g = wordingMap.get(r.normalizedText)
  if (!g) { g = { rows: [], posts: new Set() }; wordingMap.set(r.normalizedText, g) }
  g.rows.push(r); g.posts.add(r.postNumber)
}
const WORDING_CSV = [
  ['occurrences', g => g.rows.length],
  ['distinctPosts', g => g.posts.size],
  ['sentenceWording', g => g.rows[0].sentenceText],
  ['triageBuckets', g => uniq(g.rows.map(r => r.triageBucket)).sort().join(' | ')],
  ['coverageStatuses', g => uniq(g.rows.map(r => r.coverageStatus)).sort().join(' | ')],
  ['forms', g => uniq(g.rows.map(r => r.form)).sort().join(' | ')],
  ['alreadyPainted', g => uniq(g.rows.flatMap(r => r.paintedLayers)).sort().join(' | ')],
  ['certifiedNotPainted', g => uniq(g.rows.flatMap(r => r.certifiedNotPaintedLayers)).sort().join(' | ')],
  ['quotedSource', g => g.rows.some(r => r.quotedSource) ? 'YES' : 'NO'],
  ['routingHints', g => uniq(g.rows.map(r => r.routingHint)).sort().join(' | ')],
  ['examplePosts', g => [...g.posts].sort((a, b) => a - b).slice(0, 25).map(n => '#' + n).join(' ')],
  ['finalCategory', () => ''],
  ['subtype', () => ''],
  ['explanation', () => ''],
  ['confidence', () => ''],
  ['qAuthored', () => ''],
  ['quotedSourceType', () => ''],
  ['needsNewCategory', () => ''],
  ['proposedNewCategory', () => ''],
  ['reviewStatus', () => 'UNREVIEWED'],
]
const wordingRows = [...wordingMap.values()].sort((a, b) => b.rows.length - a.rows.length
  || a.rows[0].sentenceText.localeCompare(b.rows[0].sentenceText))
const wordingCsv = [WORDING_CSV.map(col => cell(col[0])).join(',')]
for (const g of wordingRows) wordingCsv.push(WORDING_CSV.map(col => cell(col[1](g))).join(','))
fs.writeFileSync(path.join(OUT, 'distinct-wordings.csv'), wordingCsv.join(NL) + NL)

fs.writeFileSync(path.join(OUT, 'unhighlighted-sentences.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n')
fs.writeFileSync(path.join(OUT, 'unhighlighted-sentences.csv'), csv.join('\n') + '\n')
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n')

const pct = (n, d) => d ? `${(n * 100 / d).toFixed(1)}%` : '—'
const c = manifest.counts
console.log('\nUNHIGHLIGHTED-SENTENCE AUDIT  (#1–#4966)\n')
console.log(`  posts with text                  : ${c.postsWithText.toLocaleString()}`)
console.log(`  Q-authored units segmented       : ${c.units.toLocaleString()}`)
console.log(`  fully painted, excluded          : ${c.fullyPainted.toLocaleString()}  (${pct(c.fullyPainted, c.units)})`)
console.log(`  QUEUED FOR REVIEW                : ${c.queued.toLocaleString()}  across ${c.postsInQueue.toLocaleString()} posts`)
console.log(`    completely unhighlighted       : ${c.unhighlighted.toLocaleString()}`)
console.log(`    partially highlighted          : ${c.partialOnly.toLocaleString()}`)
console.log(`    inline-only (entity/bracket)   : ${c.inlineOnlyFullyPainted.toLocaleString()}`)
console.log(`    punctuation-only leftover      : ${c.punctuationOnlyUncovered.toLocaleString()}`)
console.log('')
console.log(`  already certified but unpainted  : ${c.alreadyCertifiedUnpainted.toLocaleString()}  (emphasis/context/evidence/code)`)
console.log(`  likely renderer miss             : ${c.rendererMissLikely.toLocaleString()}`)
console.log(`  quoted / source material         : ${c.quotedSource.toLocaleString()}`)
console.log(`  TRULY UNCLASSIFIED               : ${c.trulyUnclassified.toLocaleString()}`)
console.log('\n  triage buckets (rows / distinct wordings):')
for (const [k, v] of Object.entries(buckets).sort()) {
  console.log(`    ${k.padEnd(34)} ${String(v).padStart(6)} / ${String(distinctByBucket[k]).padStart(5)}`)
}
console.log(`\n  distinct wordings across the whole queue: ${c.distinctSentenceTexts.toLocaleString()}`)
console.log('\n  by form:')
for (const [k, v] of Object.entries(stats.byForm).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(28)} ${String(v).padStart(6)}`)
console.log('\n  by routing hint:')
for (const [k, v] of Object.entries(stats.byHint).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(28)} ${String(v).padStart(6)}`)
console.log(`\n→ ${path.relative(ROOT, OUT)}  (jsonl + csv + manifest.json)\n`)
