import React from 'react'
import { getAliasesFor, getAliasGroup } from './aliases'
import { STATIC_ENTITIES, MIL_INTEL_TERMS, Q_SIGNATURES, HIGHLIGHT_CLS, wordBoundaryPattern } from './highlightConstants'
import type { PostAnalysis } from '../types'

// The post-body highlighter, lifted out of PostCard so quoted posts can use the SAME logic.
//
// A drop that replies to another post showed its quote as flat grey text while its own words
// carried every question, request, claim and entity marking — so the reply looked unanalysed.
// 48% of quoted posts ARE drops we already hold and already analysed, so they can be rendered
// with their own stored analysis and look identical to their post page.
//
// Extracted verbatim; PostCard re-exports it rather than keeping a second copy.

type Kind = 'keyword' | 'question' | 'request' | 'requestQuestion' | 'url' | 'namedEntity' | 'claim' | 'prediction' | 'theme' | 'impliedConclusion' | 'verificationHook' | 'emphasis' | 'bracketCode' | 'milIntel' | 'qSignature' | 'topic'
type Seg = { start: number; end: number; kind: Kind }

// Dominant kinds take sole ownership — no overlap with stackable kinds
const DOMINANT_KINDS = new Set<Kind>(['keyword', 'question', 'url'])

// Escape for regex AND normalize quote/dash variants so curly and straight versions always match.
// Q posts use curly quotes; Claude often returns straight quotes — without this, nothing highlights.
function escapeAndNormalize(term: string): string {
  let e = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  e = e.replace(/['\u2018\u2019\u201A\u201B]/g, "(?:'|\u2018|\u2019)")
  e = e.replace(/["\u201C\u201D\u201E\u201F]/g, '(?:"|\u201C|\u201D)')
  e = e.replace(/[-\u2013\u2014]/g, '(?:-|\u2013|\u2014)')
  return e
}

function addSegs(segs: Seg[], text: string, terms: string[], kind: Kind) {
  for (const term of terms) {
    if (!term || !term.trim()) continue   // guard: empty term → zero-length infinite loop
    const escaped = escapeAndNormalize(term)
    // Always boundary-matched now. Highlighting "US" inside "rUSsia" / "POTUS" / "HoUSe"
    // made a post unreadable whenever a short entity was selected. wordBoundaryPattern
    // also handles terms edged with punctuation ("Q+", "[RR]"), which plain \b breaks on.
    const rx = new RegExp(wordBoundaryPattern(escaped, term), 'gi')
    let m: RegExpExecArray | null
    while ((m = rx.exec(text)) !== null) {
      if (m.index === rx.lastIndex) rx.lastIndex++   // extra guard against zero-length matches
      segs.push({ start: m.index, end: m.index + m[0].length, kind })
    }
  }
}

export function highlightText(text: string, questionTexts: string[], keyword: string, requestTexts: string[] = [], analysis?: PostAnalysis) {
  const segs: Seg[] = []

  // Highlight the searched term AND its whole alias group, so a post that matched via an alias
  // (e.g. searching "4,10,20" surfaces POTUS / Q+ posts) shows WHY it matched instead of nothing.
  if (keyword) addSegs(segs, text, getAliasGroup(keyword), 'keyword')
  addSegs(segs, text, questionTexts, 'question')

  for (const rt of requestTexts) {
    const escaped = escapeAndNormalize(rt)
    const rx = new RegExp(escaped, 'gi')
    let m: RegExpExecArray | null
    while ((m = rx.exec(text)) !== null) {
      segs.push({ start: m.index, end: m.index + m[0].length, kind: rt.trim().endsWith('?') ? 'requestQuestion' : 'request' })
    }
  }

  if (analysis) {
    const withAliases = (arr: string[]) => arr.flatMap(t => [t, ...getAliasesFor(t)])
    addSegs(segs, text, withAliases(analysis.namedEntities ?? []), 'namedEntity')
    addSegs(segs, text, withAliases(analysis.claims ?? []), 'claim')
    addSegs(segs, text, withAliases(analysis.predictions ?? []), 'prediction')
    addSegs(segs, text, withAliases(analysis.themes ?? []), 'theme')
    addSegs(segs, text, withAliases(analysis.impliedConclusions ?? []), 'impliedConclusion')
    addSegs(segs, text, withAliases(analysis.verificationHooks ?? []), 'verificationHook')
    addSegs(segs, text, analysis.emphasis ?? [], 'emphasis')
  }

  // Static entities always highlighted as namedEntity
  addSegs(segs, text, STATIC_ENTITIES, 'namedEntity')

  // Brackets, mil-intel, Q signatures
  const bracketRx = /\[\[?[A-Za-z0-9][A-Za-z0-9 _\-]{0,30}\]?\]/g
  let bm: RegExpExecArray | null
  while ((bm = bracketRx.exec(text)) !== null) segs.push({ start: bm.index, end: bm.index + bm[0].length, kind: 'bracketCode' })

  addSegs(segs, text, MIL_INTEL_TERMS, 'milIntel')
  addSegs(segs, text, Q_SIGNATURES, 'qSignature')

  const urlRx = /https?:\/\/[^\s<>'")\]]+/g
  let um: RegExpExecArray | null
  while ((um = urlRx.exec(text)) !== null) segs.push({ start: um.index, end: um.index + um[0].length, kind: 'url' })

  if (segs.length === 0) return text

  // Interval decomposition — same logic as PostDetail renderPostBody
  const boundaries = new Set<number>([0, text.length])
  for (const s of segs) { boundaries.add(s.start); boundaries.add(s.end) }
  const bList = Array.from(boundaries).sort((a, b) => a - b)

  const cls = HIGHLIGHT_CLS

  const nodes: (string | React.JSX.Element)[] = []
  let pos = 0

  for (let bi = 0; bi < bList.length - 1; bi++) {
    const iStart = bList[bi], iEnd = bList[bi + 1]
    const active = segs.filter(s => s.start <= iStart && s.end >= iEnd)
    if (active.length === 0) continue
    if (iStart > pos) nodes.push(text.slice(pos, iStart))
    const matchText = text.slice(iStart, iEnd)
    const dominant = active.filter(s => DOMINANT_KINDS.has(s.kind))
    const stackable = active.filter(s => !DOMINANT_KINDS.has(s.kind))

    if (dominant.length > 0) {
      const top = dominant.sort((a, b) => {
        const p: Record<string, number> = { keyword: 0, question: 1, url: 2 }
        return (p[a.kind] ?? 9) - (p[b.kind] ?? 9)
      })[0]
      if (top.kind === 'question') {
        nodes.push(<mark key={iStart} className="bg-blue-500/30 text-blue-200 rounded not-italic">{matchText}</mark>)
      } else if (top.kind === 'keyword') {
        nodes.push(<mark key={iStart} className="bg-red-500/50 text-red-100 rounded not-italic font-semibold">{matchText}</mark>)
      } else {
        nodes.push(<a key={iStart} href={matchText} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline break-all" onClick={e => e.stopPropagation()}>{matchText}</a>)
      }
    } else if (stackable.length === 1) {
      nodes.push(<mark key={iStart} className={`${cls[stackable[0].kind] ?? ''} rounded not-italic`}>{matchText}</mark>)
    } else if (stackable.some(s => s.kind === 'namedEntity')) {
      nodes.push(<mark key={iStart} className="bg-cyan-500/30 text-cyan-200 rounded not-italic">{matchText}</mark>)
    } else if (stackable.some(s => s.kind === 'bracketCode')) {
      nodes.push(<mark key={iStart} className="bg-red-800/40 text-red-300 font-mono text-[0.9em] rounded not-italic">{matchText}</mark>)
    } else if (stackable.some(s => s.kind === 'request' || s.kind === 'requestQuestion')) {
      const hasReqQ = stackable.some(s => s.kind === 'requestQuestion')
      nodes.push(<mark key={iStart} className={`${hasReqQ ? 'animate-req-question' : 'bg-green-500/35 text-green-200'} rounded not-italic font-medium`}>{matchText}</mark>)
    } else {
      nodes.push(<mark key={iStart} className="animate-overlap rounded not-italic">{matchText}</mark>)
    }
    pos = iEnd
  }
  if (pos < text.length) nodes.push(text.slice(pos))
  return nodes
}
