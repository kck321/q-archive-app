// Sentence/line units, coverage, form and routing hint — SHARED.
//
// Two auditors drawing unit boundaries differently is a duplicated-logic failure this project
// has already hit four times, so the census (audit-unhighlighted-sentences.mjs, which measures
// against a transcription of the renderer) and the ground-truth pass
// (audit-painted-truth.mjs -> audit-unhighlighted-from-truth.mjs, which measures against the
// rendered DOM) draw them from here. If the two disagree it must be about what is PAINTED,
// never about where a sentence starts.
//
// Extracted verbatim from audit-unhighlighted-sentences.mjs, which now imports it.
import { imperativeMood, familyOf } from './imperative.mjs'

// ── segmentation, with offsets into the runtime body ─────────────────────────
// scripts/lib/segment.mjs unitsFor(), extended to carry the offsets a coverage measure needs.
// Same line handling, same continuation rule, same sentence split — two auditors drawing unit
// boundaries differently is the duplicated-logic failure this project has already hit four times.
const CONTINUES = /[,;:]$|\b(and|or|but|of|to|in|on|for|with|from|the|a|an|that|which|while|when|if|by|as)$/i

export function unitsWithOffsets(text) {
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
export function coverage(text, start, end, spans, skip) {
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

export const overlapping = (spans, s, e) => spans.filter(x => x.start < e && x.end > s)
const uniq = arr => [...new Set(arr)]

// ── forms and routing hints (non-binding) ────────────────────────────────────
// Q's sign-off. 4,320 drops end with a bare "Q" and it is not a sentence anybody needs to
// classify twice — one ruling covers the whole population, so it gets its own form and bucket
// rather than 4,320 identical review rows in the middle of the prose.
export const SIGNATURE = /^(?:q\+?|q\s*!\S*|wwg1wga|ncswic|wrwy)[.!?]*$/i

export function formOf(t0) {
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

export function hintFor(t0, form) {
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
