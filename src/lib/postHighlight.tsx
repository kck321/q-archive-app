import { overlapStyle, bracketSpansIn } from '../pages/PostDetail'
import { applyGlossary, glossarySync, type GlossEntry } from './glossary'
import React from 'react'
import { getAliasesFor, getFullAliasGroup } from './aliases'
// STATIC_ENTITIES / MIL_INTEL_TERMS / Q_SIGNATURES are deliberately NOT imported: a word list
// cannot decide membership in a certified section.
import { HIGHLIGHT_CLS, wordBoundaryPattern } from './highlightConstants'
import type { PostAnalysis } from '../types'
import { expandToSentence, questionHighlightRegex } from './posts'
import { highlightsEnabled } from './highlightPrefs'

// The extractor stored claims/predictions/checkable-claims as fragments, so the highlight
// stopped mid-sentence: #36's prediction ends at "...prepared to do the unthinkable" and
// left "(this was leaked internally and kept the delegate recount scam and BO from
// declaring fraud)." unmarked. The analysis LISTS already expand these to the full
// sentence; the highlighter did not, so the same item looked different in the two places.
// expandToSentence returns the item untouched when it is a paraphrase that is not in the
// text, so nothing over-extends.

// The post-body highlighter, lifted out of PostCard so quoted posts can use the SAME logic.
//
// A drop that replies to another post showed its quote as flat grey text while its own words
// carried every question, request, claim and entity marking — so the reply looked unanalysed.
// 48% of quoted posts ARE drops we already hold and already analysed, so they can be rendered
// with their own stored analysis and look identical to their post page.
//
// Extracted verbatim; PostCard re-exports it rather than keeping a second copy.

type Kind = 'context' | 'keyword' | 'question' | 'request' | 'requestQuestion' | 'url' | 'namedEntity' | 'claim' | 'prediction' | 'theme' | 'impliedConclusion' | 'verificationHook' | 'emphasis' | 'bracketCode' | 'milIntel' | 'qSignature' | 'topic'
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

export function highlightText(text: string, questionTexts: string[], keyword: string, requestTexts: string[] = [], analysis?: PostAnalysis, postNum?: number, gloss?: Record<string, GlossEntry[]>) {
  const segs: Seg[] = []

  // Highlight the searched term AND its whole alias group, so a post that matched via an alias
  // (e.g. searching "4,10,20" surfaces POTUS / Q+ posts) shows WHY it matched instead of nothing.
  if (keyword) {
    addSegs(segs, text, getFullAliasGroup(keyword), 'keyword')

    // A question arrives here as its stored text ("Power?"), but the post that matched may
    // write it "power." — the ?/./! grouping. Literal matching found nothing, so the term
    // you clicked was the one thing NOT highlighted on the page. Match the same form the
    // question index matched on.
    if (/[?]\s*$/.test(keyword)) {
      const rx = questionHighlightRegex(keyword)
      if (rx) {
        rx.lastIndex = 0
        let km: RegExpExecArray | null
        while ((km = rx.exec(text)) !== null) {
          segs.push({ start: km.index, end: km.index + km[0].length, kind: 'keyword' })
          if (km.index === rx.lastIndex) rx.lastIndex++
        }
      }
    }
  }

  // Language highlighting off → the drop renders as plain text. The searched term and any
  // URLs still stand out, since those are how you move around rather than what the app
  // concluded about the writing.
  const lang = highlightsEnabled()
  if (lang) {
    // Same question-form rule as the matching — see questionHighlightRegex.
    for (const qt of questionTexts) {
      const rx = questionHighlightRegex(qt)
      if (!rx) continue
      let m: RegExpExecArray | null
      rx.lastIndex = 0
      while ((m = rx.exec(text)) !== null) {
        segs.push({ start: m.index, end: m.index + m[0].length, kind: 'question' })
        if (m.index === rx.lastIndex) rx.lastIndex++
      }
    }
  }

  for (const rt of lang ? requestTexts : []) {
    const escaped = escapeAndNormalize(rt)
    const rx = new RegExp(escaped, 'gi')
    let m: RegExpExecArray | null
    while ((m = rx.exec(text)) !== null) {
      segs.push({ start: m.index, end: m.index + m[0].length, kind: rt.trim().endsWith('?') ? 'requestQuestion' : 'request' })
    }
  }

  if (lang && analysis) {
    const withAliases = (arr: string[]) => arr.flatMap(t => [t, ...getAliasesFor(t)])
    const whole = (arr: string[] = []) => arr.map(t => expandToSentence(t, text))
    addSegs(segs, text, withAliases(analysis.namedEntities ?? []), 'namedEntity')
    // EXACT CERTIFIED SPANS ONLY — no alias expansion, no sentence expansion.
    //
    // withAliases() folds an entity's alias group into the search terms, which is right for a
    // NAME and wrong for a sentence: a claim containing "POTUS" would also paint every "Trump"
    // and "45" nearby. Together with expandToSentence() that produced 593 highlights per surface
    // running past their certified boundary. The literal span is the boundary.
    addSegs(segs, text, analysis.claimSpans ?? whole(analysis.claims), 'claim')
    addSegs(segs, text, analysis.predictionSpans ?? whole(analysis.predictions), 'prediction')
    // ANCHORS, not labels — the same fix PostDetail got, which this surface never received.
    // An independent audit found theme anchors rendering on /post/:id and on none of /posts,
    // because this function was still searching for the taxonomy name. A label is not in the drop.
    addSegs(segs, text, analysis.themeAnchors ?? [], 'theme')
    // Context is added FIRST among the analysis kinds and never wins a stack: where a unit also
    // carries a certified semantic layer, the semantic colour is the truer statement about it.
    addSegs(segs, text, analysis.contextUnits ?? [], 'context')
    // Retired with the section (owner ruling): the span is a certified Claim and paints amber.
    // addSegs(segs, text, analysis.conclusionSpans ?? analysis.impliedConclusions ?? [], 'impliedConclusion')
    // Checkable Claims merged into Claims by owner ruling 2026-08-15. All 1,926 were ALREADY The span is a Claim and paints amber.
    addSegs(segs, text, analysis.emphasis ?? [], 'emphasis')
    // Brackets — owner rule: anything in [..] is red, on every surface. This layer existed in the
    // precedence branches below but was never fed here, so /posts painted no brackets at all.
    addSegs(segs, text, bracketSpansIn(text), 'bracketCode')
  }

  // STATIC VOCABULARIES REMOVED — they painted semantic colours with no certified record.
  //
  // Four blanket rules used to run here: a static entity list, a regex that coloured EVERY
  // bracketed token as a code, a military/intelligence word list, and Q-signature matching.
  // Between them they produced ~6,002 semantic-looking spans on the post page and ~5,631 on the
  // archive that no certified occurrence supported — a reader could not tell them from an
  // adjudicated classification, which is the whole trust proposition of this archive.
  //
  // Entities, Codes and Emphasis are certified sections with occurrence-level data; the renderer
  // consumes that data above. A word list cannot overrule an audit, and 1,332 certified entities
  // do not need a hardcoded list of 40 to help them.
  //
  //   if no certified occurrence supports the exact span in that post, it gets no semantic colour

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
    const allStackable = active.filter(s => !DOMINANT_KINDS.has(s.kind))
    // Context never wins a shared span. Where a unit also carries a certified semantic layer,
    // the semantic colour is the truer statement about it; the neutral treatment only ever marks
    // text that belongs to no category at all.
    const stackable = allStackable.some(s => s.kind !== 'context')
      ? allStackable.filter(s => s.kind !== 'context')
      : allStackable

    if (dominant.length > 0) {
      const top = dominant.sort((a, b) => {
        const p: Record<string, number> = { keyword: 0, question: 1, url: 2 }
        return (p[a.kind] ?? 9) - (p[b.kind] ?? 9)
      })[0]
      if (top.kind === 'question') {
        // A QUESTION IS A CONTAINER, NOT A CLASSIFICATION OF EVERYTHING INSIDE IT.
        //
        // This painted the whole question blue whatever sat under it, so ">End POTUS rally(s)?"
        // hid the certified Entity POTUS on /posts while the same drop showed it cyan on
        // /post/:id. Same defect PostDetail carried until it was fixed there; this surface never
        // got the fix, which is why the two views disagreed about identical certified data.
        //
        // Rules, identical to PostDetail so the surfaces cannot drift again:
        //   brackets are always red, and never rotate
        //   one inner layer  -> that layer's own colour
        //   2+ distinct inner kinds -> rotate through their real colours
        // The question keeps its blue on the sub-intervals either side.
        // OWNER RULE: a question carries no Emphasis — identical to PostDetail, because these two
        // surfaces have drifted apart before and shown different colours for the same certified
        // data. The Emphasis layer itself is untouched; only the paint inside a question changes.
        const innerKinds = [...new Set(stackable.map(x => x.kind))].filter(k => k !== 'emphasis')
        if (innerKinds.includes('bracketCode')) {
          nodes.push(<mark key={iStart} title="bracket"
            className={`${cls.bracketCode ?? ''} rounded not-italic`}>{matchText}</mark>)
        } else if (innerKinds.length === 1) {
          nodes.push(<mark key={iStart} title={`${innerKinds[0]} (inside a question)`}
            className={`${cls[innerKinds[0]] ?? ''} rounded not-italic`}>{matchText}</mark>)
        } else if (innerKinds.length > 1) {
          nodes.push(<mark key={iStart} title={`${innerKinds.length} certified layers: ${innerKinds.join(', ')}`}
            style={overlapStyle(innerKinds)?.style}
            className={`${overlapStyle(innerKinds)?.className ?? ''} rounded not-italic`}>{matchText}</mark>)
        } else {
          nodes.push(<mark key={iStart} className="bg-blue-500/30 text-blue-200 rounded not-italic">{matchText}</mark>)
        }
      } else if (top.kind === 'keyword') {
        // SEARCH STATE, AND IT MUST NOT LOOK CERTIFIED.
        //
        // This hardcoded a flashing red fill and never read cls.keyword, so changing the style
        // constant fixed nothing — the audit that checked the constant reported success while the
        // live page kept painting a fill indistinguishable from a semantic category. Verifying the
        // artifact instead of the consumption is the exact failure this project keeps repeating.
        nodes.push(<mark key={iStart} className={`${cls.keyword ?? ''} not-italic`}>{matchText}</mark>)
      } else {
        nodes.push(<a key={iStart} href={matchText} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline break-all" onClick={e => e.stopPropagation()}>{matchText}</a>)
      }
    } else if (stackable.length === 1) {
      nodes.push(<mark key={iStart} className={`${cls[stackable[0].kind] ?? ''} rounded not-italic`}>{matchText}</mark>)
    } else if (stackable.some(s => s.kind === 'bracketCode')) {
      // Brackets outrank entities — owner rule, same order as PostDetail.
      nodes.push(<mark key={iStart} className="bg-red-800/40 text-red-300 font-mono text-[0.9em] rounded not-italic">{matchText}</mark>)
    } else if (stackable.some(s => s.kind === 'namedEntity')) {
      nodes.push(<mark key={iStart} className="bg-cyan-500/30 text-cyan-200 rounded not-italic">{matchText}</mark>)
    } else if (stackable.some(s => s.kind === 'request' || s.kind === 'requestQuestion')) {
      const hasReqQ = stackable.some(s => s.kind === 'requestQuestion')
      nodes.push(<mark key={iStart} className={`${hasReqQ ? 'animate-req-question' : 'bg-green-500/35 text-green-200'} rounded not-italic font-medium`}>{matchText}</mark>)
    } else {
      // Rotate through every covering category's colour — see PostDetail for the reasoning.
      // Distinct KINDS, not segments: the same kind matching twice is one classification.
      const kinds = [...new Set(stackable.map(s => s.kind))]
      nodes.push(kinds.length > 1
        ? <mark key={iStart} title={`${kinds.length} certified layers: ${kinds.join(', ')}`}
            style={overlapStyle(kinds)?.style}
            className={`${overlapStyle(kinds)?.className ?? ''} rounded not-italic`}>{matchText}</mark>
        : <mark key={iStart} title={kinds[0]}
            className={`${cls[kinds[0]] ?? ''} rounded not-italic`}>{matchText}</mark>,
      )
    }
    pos = iEnd
  }
  if (pos < text.length) nodes.push(text.slice(pos))
  // ONE insertion point for the reader's info box, shared with PostDetail's renderer so the two
  // surfaces cannot disagree about what an acronym means.
  return postNum === undefined ? nodes : applyGlossary(nodes, postNum, gloss ?? glossarySync())
}
