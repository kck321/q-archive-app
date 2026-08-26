import { overlapStyle, bracketSpansIn } from '../pages/PostDetail'
import { applyGlossary, glossarySync, type GlossEntry } from './glossary'
import React from 'react'
import { getAliasesFor, getFullAliasGroup } from './aliases'
// STATIC_ENTITIES / MIL_INTEL_TERMS / Q_SIGNATURES are deliberately NOT imported: a word list
// cannot decide membership in a certified section.
import { HIGHLIGHT_CLS, HIGHLIGHT_FLASH, HIGHLIGHT_SOLID, isSignOffMatch, keywordUnderKind, wordBoundaryPattern } from './highlightConstants'
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
      // The sign-off is not a mention — owner rule. Identical to PostDetail.
      if (kind === 'namedEntity' && isSignOffMatch(text, m.index, m.index + m[0].length)) continue
      segs.push({ start: m.index, end: m.index + m[0].length, kind })
    }
  }
}

export function highlightText(text: string, questionTexts: string[], keyword: string, requestTexts: string[] = [], analysis?: PostAnalysis, postNum?: number, gloss?: Record<string, GlossEntry[]>) {
  let segs: Seg[] = []

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
    // THEMES NO LONGER PAINT IN THE DROP — owner ruling, 2026-08-24. Same removal as PostDetail's
    // analysis pairs, and it has to be the same on both or the two surfaces show the same drop
    // differently, which is the drift these shared constants exist to prevent.
    //
    // The data is untouched: 2,646 certified theme assignments across 2,393 posts stay in
    // posts.json and stay in their section. What goes is the indigo fill in the drop body — the
    // one that read as Prediction violet whenever it sat inside a Claim, which was 2,153 spans.
    //   addSegs(segs, text, analysis.themeAnchors ?? [], 'theme')
    // CONTEXT NO LONGER PAINTS IN THE DROP — owner ruling, 2026-08-17. Same removal as
    // PostDetail's analysis pairs, and it has to be the same on both or the two surfaces show the
    // same drop differently, which is the drift these shared constants exist to prevent.
    //
    // The data is untouched: 4,816 certified contextUnits across 2,311 posts stay in posts.json
    // and stay in their section. What goes is the grey fill in the drop body.
    //   addSegs(segs, text, analysis.contextUnits ?? [], 'context')
    // Retired with the section (owner ruling): the span is a certified Claim and paints amber.
    // addSegs(segs, text, analysis.conclusionSpans ?? analysis.impliedConclusions ?? [], 'impliedConclusion')
    // Checkable Claims merged into Claims by owner ruling 2026-08-15. All 1,926 were ALREADY The span is a Claim and paints amber.
    // EMPHASIS NO LONGER PAINTS IN THE DROP — owner ruling, 2026-08-17, the same ruling that took
    // the Context fill out and for the same reason: #4961 is nine lines and seven of them were
    // boxed, so the two lines the archive actually classifies — the Question and the Claim —
    // were the hardest things on the drop to see.
    //
    // The data is untouched: 4,238 certified Emphasis units across 1,357 posts stay in posts.json
    // and stay listed in the Post Analysis panel, where the reader can still see exactly which
    // words the audit marked. What goes is the slate fill in the drop body.
    //   addSegs(segs, text, analysis.emphasis ?? [], 'emphasis')
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

  // The space after the scheme is Q's — 44 drops write "https:// wikileaks.org/...". Matched
  // here for the same reason as in PostDetail: identical detection on both surfaces, or the
  // archive and the drop disagree about which addresses are links. Spaces and tabs only,
  // never \s, so an address can never run into the next line.
  const hrefOf = (u: string) => u.replace(/^(https?:\/\/)[ 	]+/i, '$1')
  const urlRx = /https?:\/\/[ 	]{0,3}[^\s<>'")\]]+/g
  let um: RegExpExecArray | null
  while ((um = urlRx.exec(text)) !== null) segs.push({ start: um.index, end: um.index + um[0].length, kind: 'url' })

  // NO HIGHLIGHTS IS NOT NO GLOSSARY.
  //
  // This returned the bare string, which skipped the acronym info boxes entirely — they are applied
  // at the bottom of this function, and an early return never reaches them. It was almost invisible
  // while Context painted, because a grey fill on any reviewed sentence meant nearly every drop had
  // at least one segment. Removing that fill on 2026-08-17 exposed it: 435 drops whose only layer
  // was Context would have lost every info box, and #220 — "Monitored and analyzed in RT." — is one
  // of them. Caught by test-term-info.mjs, which is exactly the failure that test exists for.
  if (segs.length === 0) {
    return postNum === undefined ? text : applyGlossary([text], postNum, gloss ?? glossarySync())
  }

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
          // SOLID — the question is behind it. Same rule and same classes as PostDetail.
          nodes.push(<mark key={iStart} title="bracket — over question"
            className={`${HIGHLIGHT_SOLID.bracketCode} rounded not-italic`}>{matchText}</mark>)
        } else if (innerKinds.includes('namedEntity')) {
          // BRACKETS AND ENTITIES ARE ALWAYS ON TOP — owner rule, inside a question as much as
          // outside one. Identical to the PostDetail branch, which is the point: these two
          // surfaces have shown different colours for the same certified data before.
          nodes.push(<mark key={iStart} title={`entity — over question${innerKinds.length > 1 ? ', ' + innerKinds.filter(k => k !== 'namedEntity').join(', ') : ''}`}
            className={`${HIGHLIGHT_SOLID.namedEntity} rounded not-italic`}>{matchText}</mark>)
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
        // A SEARCH MATCH SHOWS ITS CATEGORY — owner ruling, 2026-08-26.
        //
        // A search hit used to paint flat red no matter what certified layer sat underneath —
        // the reader could see WHERE the term was but not WHAT it was. It still has to stand out
        // as "this is the thing you searched for", which is why keyword stays a DOMINANT kind and
        // still flashes — it just borrows the exact hue of whatever's behind it (HIGHLIGHT_FLASH,
        // shared with PostDetail's chip-click flash) so the flash IS the classification. Falls
        // back to the plain red ring only when nothing certified sits behind the match.
        const underKind = keywordUnderKind(stackable)
        nodes.push(underKind
          ? <mark key={iStart} title={`search match — ${underKind}`}
              className={`${cls[underKind] ?? ''} rounded not-italic ${HIGHLIGHT_FLASH[underKind] ?? 'animate-search-flash-generic'}`}>{matchText}</mark>
          : <mark key={iStart} className={`${cls.keyword ?? ''} not-italic`}>{matchText}</mark>)
      } else {
        nodes.push(<a key={iStart} href={hrefOf(matchText)} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline break-all" onClick={e => e.stopPropagation()}>{matchText}</a>)
      }
    } else if (stackable.length === 1) {
      nodes.push(<mark key={iStart} className={`${cls[stackable[0].kind] ?? ''} rounded not-italic`}>{matchText}</mark>)
    } else if (stackable.some(s => s.kind === 'bracketCode')) {
      // Brackets outrank entities — owner rule, same order as PostDetail. SOLID, because reaching
      // this branch at all means something else covers the same characters.
      nodes.push(<mark key={iStart} title={`bracket — over ${stackable.filter(s => s.kind !== 'bracketCode').map(s => s.kind).join(', ') || 'nothing'}`}
        className={`${HIGHLIGHT_SOLID.bracketCode} rounded not-italic`}>{matchText}</mark>)
    } else if (stackable.some(s => s.kind === 'namedEntity')) {
      nodes.push(<mark key={iStart} title={`entity — over ${stackable.filter(s => s.kind !== 'namedEntity').map(s => s.kind).join(', ') || 'nothing'}`}
        className={`${HIGHLIGHT_SOLID.namedEntity} rounded not-italic`}>{matchText}</mark>)
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
