import React, { useEffect, useState, useRef, useMemo } from 'react'
import { applyGlossary, glossarySync, useGlossary, type GlossEntry } from '../lib/glossary'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  getPost, getQuestionFrequency, getAnalysisFrequency, getPostsByNums, getPostNumsContaining, searchAllPosts,
  getTopics, addPostToTopic, removePostFromTopic,
  getQuestionsForPost, updatePost, addQuestions, removeQuestionById, setQuestionStatuses,
  applyAnalysisToMatchingPosts, addQuestionToMatchingPosts, addRequestToMatchingPosts, addBracketToMatchingPosts,
  normalizeItemKey, expandToSentence, questionHighlightRegex,
} from '../lib/posts'
import { detectQuestionsWithVerification, classifyQuestions, detectActionRequests, analyzePost, correlateNews } from '../lib/claude'
import QuestionBadge from '../components/QuestionBadge'
import BackButton from '../components/BackButton'
import AnalysisMap from '../components/AnalysisMap'
import { useAdmin } from '../components/AdminContext'
import { sourceLink } from '../lib/sourceLink'
import { timeAgo } from '../lib/timeAgo'
import { highlightsEnabled, useHighlightsEnabled } from '../lib/highlightPrefs'
import { mediaUrl, dedupeMedia } from '../lib/mediaUrl'
import { resolveReferences, getQuotedContext, type QuotedContext } from '../lib/references'
import QuotedPosts from '../components/QuotedPosts'
import UnresolvedInPost from '../components/UnresolvedInPost'
import { highlightText } from '../lib/postHighlight'
import { linkify } from '../lib/linkify'
import FlagIssue from '../components/FlagIssue'
import { CAN_EDIT } from '../lib/appMode'
import { getAliasesFor, getFullAliasGroup, addAlias, removeAlias, subscribeAliases } from '../lib/aliases'
// STATIC_ENTITIES / MIL_INTEL_TERMS / Q_SIGNATURES are deliberately NOT imported: a word list
// cannot decide membership in a certified section.
import { HIGHLIGHT_CLS, wordBoundaryPattern } from '../lib/highlightConstants'
import type { QPost, QQuestion, PostAnalysis, CorrelatedArticle, QuotedPost } from '../types'

const STOP_WORDS = new Set(['the','and','for','with','from','this','that','are','was','were','have','been','will','into','about','its','their','which','posts'])

// PIN that gates the paid AI "Research news" feature (soft lock — stops casual/accidental use).
const AI_PIN = '162424'


// Returns true only if the question text literally appears in the post body
function questionExistsInPost(questionText: string, postText: string): boolean {
  try {
    const escaped = questionText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(escaped, 'i').test(postText)
  } catch {
    return false
  }
}

function topicKeywordsFrom(topicName: string): string[] {
  return topicName
    .split(/\W+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()))
}

// Render post body with layered highlights:
//   green  — the selected question (flash animation on scroll)
//   lime   — action requests (Q directing reader to do something)
//   yellow — topic keywords when opened from Q Book
//   blue   — all other detected questions
// The first green mark gets data-hl="1" so we can scroll to it.
const CAT_HL_COLORS: Record<string, string> = {
  claims:             'bg-amber-500/60 text-amber-50',
  predictions:        'bg-violet-500/60 text-violet-50',
  namedEntities:      'bg-cyan-500/60 text-cyan-50',
  themes:             'bg-indigo-500/60 text-indigo-50',
  impliedConclusions: 'bg-orange-500/60 text-orange-50',
  verificationHooks:  'bg-fuchsia-500/60 text-fuchsia-50',
}

// Per-category infinite flash animations (white ↔ category color)
const CAT_FLASH_ANIM: Record<string, string> = {
  claims:             'animate-flash-claims',
  predictions:        'animate-flash-predictions',
  namedEntities:      'animate-flash-entities',
  themes:             'animate-flash-themes',
  impliedConclusions: 'animate-flash-conclusions',
  verificationHooks:  'animate-flash-hooks',
}


// Escape for regex AND normalize quote/dash variants so curly quotes (Q posts) match
// straight quotes (Claude output) and vice versa — without this, highlights fail silently.
function escapeAndNormalize(term: string): string {
  let e = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  e = e.replace(/['\u2018\u2019\u201A\u201B]/g, "(?:'|\u2018|\u2019)")
  e = e.replace(/["\u201C\u201D\u201E\u201F]/g, '(?:"|\u201C|\u201D)')
  e = e.replace(/[-\u2013\u2014]/g, '(?:-|\u2013|\u2014)')
  return e
}

function renderPostBody(
  text: string,
  questions: QQuestion[],
  highlight: string,
  _flash: boolean,   // kept for call-site arity; the term now always animates
  topicKeywords: string[],
  onRemoveQuestion?: (id: string) => void,
  newIds?: Set<string>,
  requestTexts?: string[],
  analysis?: PostAnalysis,
  highlightCat?: string,
  postNum?: number,
  gloss?: Record<string, GlossEntry[]>
) {
  // OWNER RULE: a question carries no Emphasis.
  //
  // "if we have a question highlighted app wide i do not want it to be an emphasis. i just want
  // the question highlighted and no emphasis tied to the question."
  //
  // 1,429 emphasis spans sit INSIDE a certified question — CAPS words, quoted words, punctuation
  // runs. The certified Emphasis layer is UNCHANGED at 4,669; this is a rendering rule, so the
  // Emphasis section still lists them and the ruling is reversible. Everything else inside a
  // question still paints: an Entity stays cyan, a bracket stays red.
  const insideQuestionKinds = (segs: { kind: string }[]) =>
    [...new Set(segs.map(x => x.kind))].filter(k => k !== 'emphasis')

  type Kind = 'context' | 'highlight' | 'request' | 'requestQuestion' | 'topic' | 'question' | 'namedEntity' | 'claim' | 'prediction' | 'theme' | 'impliedConclusion' | 'verificationHook' | 'emphasis' | 'bracketCode' | 'milIntel' | 'qSignature' | 'url'
  type Seg = { start: number; end: number; kind: Kind; matchText: string; questionId?: string }
  const segs: Seg[] = []

  // Direct highlight — search raw text for the highlight string (and its aliases) first so
  // sync/search group links work even when the text is not yet in questions[]
  if (highlight) {
    // NO ALIAS EXPANSION on the direct-highlight path.
    //
    // getFullAliasGroup() returns an entity's whole alias family, so arriving with a CLAIM or
    // DIRECTIVE in ?highlight= also painted every alias of any entity inside it — the detail-only
    // behaviour the live audit measured as 3,150 unsupported marks against the archive's 160.
    // Alias resolution belongs to Entities; a sentence is matched literally.
    const isEntityHighlight = highlightCat === 'namedEntities'
    for (const variant of (isEntityHighlight ? getFullAliasGroup(highlight) : [highlight])) {
      if (!variant || !variant.trim()) continue
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Boundary-matched. Without this, arriving with ?highlight=Read. lit up the "read."
      // inside "th[read.]" and "b[read.]" — this is the path a section chip links through,
      // so it is the one a reader actually sees.
      const regex = new RegExp(wordBoundaryPattern(escaped, variant), 'gi')
      let m: RegExpExecArray | null
      while ((m = regex.exec(text)) !== null) {
        if (m.index === regex.lastIndex) regex.lastIndex++
        segs.push({ start: m.index, end: m.index + m[0].length, kind: 'highlight', matchText: m[0] })
      }
    }
  }

  // Normalize for highlight matching — strip trailing punctuation so "WHY?" matches "WHY????????????"
  const normHL = (t: string) => t.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')

  // Language highlighting off → plain text, except the term you searched for (kind
  // 'highlight'), which is navigation rather than analysis.
  const langOn = highlightsEnabled()

  // Question segments
  for (const q of langOn ? questions : questions.filter(q => !!highlight && normHL(q.text) === normHL(highlight))) {
    const isHL = !!highlight && normHL(q.text) === normHL(highlight)
    // Question FORM, not the literal string: a drop asking "Power." is credited with the
    // question "Power?", so the highlight has to accept the same variants the match did.
    const regex = questionHighlightRegex(q.text) ?? new RegExp(wordBoundaryPattern(escapeAndNormalize(q.text), q.text), 'gi')
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      segs.push({ start: m.index, end: m.index + m[0].length, kind: isHL ? 'highlight' : 'question', matchText: m[0], questionId: q.id })
    }
  }

  // Action request segments — ends with '?' → requestQuestion (flashes green↔blue)
  for (const req of langOn ? (requestTexts ?? []) : []) {
    const escaped = escapeAndNormalize(req)
    const regex = new RegExp(wordBoundaryPattern(escaped, req), 'gi')
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      const kind: Kind = req.trim().endsWith('?') ? 'requestQuestion' : 'request'
      segs.push({ start: m.index, end: m.index + m[0].length, kind, matchText: m[0] })
    }
  }

  // Topic keyword segments (yellow)
  for (const kw of langOn ? topicKeywords : []) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      segs.push({ start: m.index, end: m.index + m[0].length, kind: 'topic', matchText: m[0] })
    }
  }

  // Analysis segments (lower priority than questions/requests)
  if (langOn && analysis) {
    // Claims/predictions/checkable-claims were stored as fragments, so the highlight stopped
    // mid-sentence — #36's prediction ended at "...prepared to do the unthinkable", leaving
    // the "(this was leaked internally…)" clause unmarked. The analysis lists already show
    // these expanded; now the highlight agrees. Paraphrases that are not in the text come
    // back unchanged, so nothing over-extends.
    const wholeSentences = (arr?: string[]) => (arr ?? []).map(t => expandToSentence(t, text))
    // Certified layers first; the bracket structure layer is derived from them below.
    const analysisPairsBase: [Kind, string[]][] = [
      ['namedEntity', analysis.namedEntities ?? []],
      ['claim', analysis.claimSpans ?? wholeSentences(analysis.claims)],
      ['prediction', analysis.predictionSpans ?? wholeSentences(analysis.predictions)],
      // Anchors, not labels. A theme label is a taxonomy name and is almost never literal text
      // in the drop, so highlighting on it meant themes never rendered at all.
      ['theme', analysis.themeAnchors ?? []],
      // Implied conclusions / verification hooks are often paraphrases that aren't
      // verbatim in the post — they only highlight when the exact text is present.
      // Q Conclusions retired as a SECTION by owner ruling 2026-08-14 — "basically the same thing"
      // as a Claim. All 966 were already certified Claims carrying isConclusion, so the rows are
      // unchanged; only the duplicate view is gone. The attribute survives on claimMeta.
      // Checkable Claims merged into Claims by owner ruling 2026-08-15. All 1,926 were ALREADY
      ['emphasis', analysis.emphasis ?? []],
    ]
    const analysisPairs: [Kind, string[]][] = [
      ...analysisPairsBase,
      // Bracketed spans, in the same red the [ Brackets ] panel uses — but ONLY where no
      // certified layer already covers exactly that span.
      //
      // [barrage] in #4742 is certified Emphasis of type bracket_emphasis — "an ordinary word set
      // in brackets to mark it out". The bracket IS the emphasis. Painting a structure layer over
      // the identical span made one device look like two overlapping categories, so it rotated
      // between slate and red for no reason a reader could act on.
      //
      // The structure view exists to surface brackets NOTHING else accounts for. Where a certified
      // layer already owns the span, that layer speaks for it.
      // OWNER RULE, 2026-08-14: anything in brackets is red. Full stop.
      //
      // This layer briefly deferred to certified spans, so [barrage] and [counter] on #4741 —
      // both certified Emphasis — showed slate while [past 7 days] beside them showed red. Three
      // bracketed items, two colours, one visual rule broken. Brackets are now always red and
      // never rotate; a bracket that is ALSO Emphasis still says so in the analysis panel, which
      // is where a second membership belongs.
      ['bracketCode', bracketSpansIn(text)],
      // Reviewed, in no semantic category. Listed last so any certified semantic span covering
      // the same text takes precedence.
      ['context', analysis.contextUnits ?? []],
    ]
    for (const [kind, items] of analysisPairs) {
      for (const item of items) {
        // Highlight the term itself plus any registered alias spellings.
        for (const variant of [item, ...getAliasesFor(item)]) {
        if (!variant || !variant.trim()) continue
        const escaped = escapeAndNormalize(variant)
        // Boundary-matched so a short entity like "US" stops lighting up "Russia",
        // "POTUS" and "House" throughout the post.
        const regex = new RegExp(wordBoundaryPattern(escaped, variant), 'gi')
        let m: RegExpExecArray | null
        while ((m = regex.exec(text)) !== null) {
          if (m.index === regex.lastIndex) regex.lastIndex++
          segs.push({ start: m.index, end: m.index + m[0].length, kind, matchText: m[0] })
        }
        }
      }
    }
  }
  // STATIC VOCABULARIES REMOVED — they painted semantic colours with no certified record.
  //
  // Four blanket rules ran here: a static entity list, a regex colouring EVERY bracketed token
  // as a code, a military/intelligence word list, and Q-signature phrase matching. Together they
  // produced ~6,002 semantic-looking spans on this surface that no certified occurrence
  // supported. A reader could not distinguish them from an adjudicated classification, which is
  // the trust proposition of the whole archive.
  //
  // Entities, Codes and Emphasis are certified sections with occurrence-level data, consumed
  // above. A hardcoded list of 40 terms cannot overrule an audit of 1,332 certified entities.
  //
  //   if no certified occurrence supports the exact span in that post, it gets no semantic colour

  // URL segments (lowest priority — clickable links)
  const urlRx = /https?:\/\/[^\s<>'")\]]+/g
  let um: RegExpExecArray | null
  while ((um = urlRx.exec(text)) !== null) {
    segs.push({ start: um.index, end: um.index + um[0].length, kind: 'url', matchText: um[0] })
  }

  if (segs.length === 0) return text

  // Build protected ranges from >>number post references so they are never highlighted
  const protectedRanges: Array<{ start: number; end: number }> = []
  const refRx = />>\d+/g
  let refM: RegExpExecArray | null
  while ((refM = refRx.exec(text)) !== null) {
    protectedRanges.push({ start: refM.index, end: refM.index + refM[0].length })
  }
  function overlapsRef(start: number, end: number) {
    return protectedRanges.some(r => start < r.end && end > r.start)
  }

  // Kinds that always take sole ownership of their span (interaction or navigation critical)
  // request/requestQuestion are stackable so named entities/brackets inside them still show.
  const DOMINANT_KINDS = new Set<Kind>(['highlight', 'question', 'url'])
  const priority: Record<Kind, number> = {
    highlight: 0, request: 1, requestQuestion: 1, topic: 2, question: 3,
    namedEntity: 4, claim: 5, prediction: 6, theme: 7, impliedConclusion: 8, verificationHook: 9,
    // context LAST of all: it means "reviewed, and in no semantic category", so any certified
    // category covering the same span is the truer statement and must win.
    context: 99,
    // emphasis last: it is Q's punctuation, so anything else on the same span wins.
    bracketCode: 10, milIntel: 11, qSignature: 12, url: 13, emphasis: 14,
  }

  // Decompose text into sub-intervals where the set of active segments is constant.
  // This lets multiple overlapping kinds (e.g. namedEntity inside a claim) each render
  // their color — the shortest/innermost chunk gets both colors as the overlap flash.
  const boundaries = new Set<number>([0, text.length])
  for (const s of segs) { boundaries.add(s.start); boundaries.add(s.end) }
  const bList = Array.from(boundaries).sort((a, b) => a - b)

  const nodes: (string | React.JSX.Element)[] = []
  let pos = 0
  let firstHL = true

  for (let bi = 0; bi < bList.length - 1; bi++) {
    const iStart = bList[bi], iEnd = bList[bi + 1]

    // Find all segments that fully cover this sub-interval
    const active = segs.filter(s => s.start <= iStart && s.end >= iEnd)
    if (active.length === 0) continue   // plain text — gap will be emitted below

    // Emit any plain text gap before this interval
    if (iStart > pos) nodes.push(text.slice(pos, iStart))

    // Skip if this interval is inside a >>number reference
    if (overlapsRef(iStart, iEnd)) { pos = iEnd; continue }

    const matchText = text.slice(iStart, iEnd)
    const dominant = active.filter(s => DOMINANT_KINDS.has(s.kind))
    const stackable = active.filter(s => !DOMINANT_KINDS.has(s.kind))

    if (dominant.length > 0) {
      // Highest-priority dominant kind wins the whole interval
      dominant.sort((a, b) => priority[a.kind] - priority[b.kind])
      const top = dominant[0]
      if (top.kind === 'highlight') {
        const isFirst = firstHL; firstHL = false
        const catClass = highlightCat ? CAT_HL_COLORS[highlightCat] : null
        const flashAnim = highlightCat ? (CAT_FLASH_ANIM[highlightCat] ?? 'animate-flash') : 'animate-flash'
        // Always animate the term you came here to see. It used to depend on a ?flash=1
        // arrival, so opening a post from a term chip showed a static red mark that was easy
        // to lose inside a long drop — which is exactly the case the flash exists for.
        const hlClass = catClass
          ? `rounded not-italic ${catClass} ${flashAnim}`
          // SEARCH STATE, NOT CLASSIFICATION. This was a filled red flashing mark, visually
          // indistinguishable from a semantic category — the live audit failed it on exactly that.
          // The archive uses the same outline treatment; both surfaces must agree.
          : `not-italic font-semibold bg-transparent ring-1 ring-red-400/80 underline decoration-dashed decoration-red-400/80 underline-offset-2 text-red-200 rounded-sm`
        nodes.push(<mark key={iStart} {...(isFirst ? { 'data-hl': '1' } : {})} className={hlClass}>{matchText}</mark>)
      } else if (top.kind === 'requestQuestion') {
        nodes.push(<mark key={iStart} className="animate-req-question rounded not-italic font-medium">{matchText}</mark>)
      } else if (top.kind === 'request') {
        nodes.push(<mark key={iStart} className="bg-green-500/35 text-green-200 rounded not-italic font-medium">{matchText}</mark>)
      } else if (top.kind === 'url') {
        nodes.push(<a key={iStart} href={matchText} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline break-all" onClick={e => e.stopPropagation()}>{matchText}</a>)
      } else if (insideQuestionKinds(stackable).length > 0) {
        // CONTAINMENT IS NOT OVERLAP.
        //
        // A bracket sitting inside a question is not two classifications of the same span — the
        // question is the CONTAINER. Counting it as a co-membership made #4742's brackets rotate
        // through question-blue, and [+family (follow)] is listed under [ Brackets ] and nothing
        // else, so it must simply be red.
        //
        // The rule, stated once: a span shows the colour of the category it BELONGS to, and it
        // rotates only when that same span genuinely belongs to two or more. The enclosing
        // question keeps its colour on the sub-intervals either side, so the line still reads as
        // a question.
        const innerKinds = insideQuestionKinds(stackable)
        // Same rule as the general branch: distinct KINDS, not segments.
        // Brackets are red even inside a question, and never rotate — owner rule.
        nodes.push(innerKinds.includes('bracketCode')
          ? <mark key={iStart} title="bracket"
              className={`${HIGHLIGHT_CLS.bracketCode ?? ''} rounded not-italic`}>{matchText}</mark>
          : innerKinds.length === 1
          ? <mark key={iStart} title={`${innerKinds[0]} (inside a question)`}
              className={`${HIGHLIGHT_CLS[innerKinds[0]] ?? ''} rounded not-italic`}>{matchText}</mark>
          : <mark key={iStart} title={`${innerKinds.length} certified layers: ${innerKinds.join(', ')}`}
              style={overlapStyle(innerKinds)?.style}
              className={`${overlapStyle(innerKinds)?.className ?? ''} rounded not-italic`}>{matchText}</mark>,
        )
      } else {
        // question
        const qSeg = dominant.find(s => s.kind === 'question') ?? top
        nodes.push(
          <span key={iStart} className="group/q relative inline">
            {/* A dominant kind takes sole ownership of its span, which meant certified layers
                UNDERNEATH it were invisible: #2917 lists FAKE and NEWS as Emphasis, both sitting
                inside the certified question "FAKE NEWS coverage?", so the chips appeared with no
                highlight anywhere in the drop. Same remedy as the overlap fix — the question keeps
                its colour, and the second membership shows on the underline channel. */}
            <mark
              // Emphasis is filtered here too: under the owner ruling a question does not carry
              // it, so the drop must not claim it on hover either. The span is still listed in
              // the Emphasis section — the certified layer is untouched, only this drop's paint.
              title={insideQuestionKinds(stackable).length ? `also: ${insideQuestionKinds(stackable).join(', ')}` : undefined}
              className={`rounded not-italic ${newIds?.has(qSeg.questionId ?? '') ? 'bg-purple-500/30 text-purple-200' : 'bg-blue-500/30 text-blue-200'}`}>{matchText}</mark>
            {onRemoveQuestion && qSeg.questionId && (
              <button onClick={e => { e.stopPropagation(); onRemoveQuestion(qSeg.questionId!) }}
                className="hidden group-hover/q:inline-flex items-center gap-0.5 ml-0.5 align-middle text-[10px] text-red-400 hover:text-red-200 bg-red-900/50 hover:bg-red-800/70 border border-red-700/60 px-1 py-px rounded transition-colors leading-none">
                ✕ not a question
              </button>
            )}
          </span>
        )
      }
    } else {
      const cls = HIGHLIGHT_CLS
      if (stackable.length === 1) {
        // Single stackable kind — use its color
        nodes.push(<mark key={iStart} className={`${cls[stackable[0].kind] ?? ''} rounded not-italic`}>{matchText}</mark>)
      } else if (stackable.some(s => s.kind === 'bracketCode')) {
        // OWNER RULE: anything in brackets is red — including a bracket that contains an entity.
        //
        // namedEntity used to be tested first, which split the span: "[Mueller failed]" rendered
        // as a red "[", a cyan "Mueller" and a red " failed]". One bracket, two colours, and the
        // bracket rule visibly broken inside the very thing it governs. The entity is still
        // certified and still listed under Entities; the bracket owns the paint.
        nodes.push(<mark key={iStart} className="bg-red-800/40 text-red-300 font-mono text-[0.9em] rounded not-italic">{matchText}</mark>)
      } else if (stackable.some(s => s.kind === 'namedEntity')) {
        // Named entity wins solid cyan over everything except a bracket.
        nodes.push(<mark key={iStart} className="bg-cyan-500/30 text-cyan-200 rounded not-italic">{matchText}</mark>)
      } else if (stackable.some(s => s.kind === 'request' || s.kind === 'requestQuestion')) {
        // Request wins over lower-priority analysis kinds
        const hasReqQ = stackable.some(s => s.kind === 'requestQuestion')
        nodes.push(<mark key={iStart} className={`${hasReqQ ? 'animate-req-question' : 'bg-green-500/35 text-green-200'} rounded not-italic font-medium`}>{matchText}</mark>)
      } else {
        // ROTATE THROUGH EVERY CATEGORY'S COLOUR.
        //
        // This is the point of the app: showing how one piece of Q's language is classified by
        // several layers at once. A single blended or precedence-picked colour hides that. The
        // animation cycles the actual category colours covering this span, so a reader can see
        // it is (say) both a Claim and Emphasis.
        //
        // Counted by DISTINCT KIND, not by segment. Two segments of the same kind are one
        // classification: [A] in #129 belongs to both the CIA and the NSA acrostic, so it matched
        // Emphasis twice and rotated with the title "2 certified layers: emphasis" — one kind,
        // named once, presented as an overlap. A span rotates only when it genuinely belongs to
        // two different categories.
        const kinds = [...new Set(stackable.map(s => s.kind))]
        nodes.push(kinds.length > 1
          ? <mark key={iStart} title={`${kinds.length} certified layers: ${kinds.join(', ')}`}
              style={overlapStyle(kinds)?.style}
              className={`${overlapStyle(kinds)?.className ?? ''} rounded not-italic`}>{matchText}</mark>
          : <mark key={iStart} title={kinds[0]}
              className={`${HIGHLIGHT_CLS[kinds[0]] ?? ''} rounded not-italic`}>{matchText}</mark>,
        )
      }
    }

    pos = iEnd
  }

  if (pos < text.length) nodes.push(text.slice(pos))
  // Same glossary layer as postHighlight — see src/lib/glossary.tsx.
  return postNum === undefined ? nodes : applyGlossary(nodes, postNum, gloss ?? glossarySync())
}

// Labels + badge styles for the analysis category the user arrived from (entity/claim/etc.)
const ANALYSIS_CAT_LABEL: Record<string, string> = {
  claims: 'Claims',
  predictions: 'Predictions',
  namedEntities: 'Named Entities',
  themes: 'Themes',
  impliedConclusions: 'Implied Conclusions',
  verificationHooks: 'Checkable Claims',
  question: 'Q Questions',
  request: 'Q Directives',
  bracket: 'Q [ Brackets ]',
  overlap: 'Overlap',
  term: 'Q Uncategorized',
}
const ANALYSIS_CAT_BADGE: Record<string, string> = {
  claims: 'bg-amber-900/60 text-amber-300 border-amber-700/60',
  predictions: 'bg-violet-900/60 text-violet-300 border-violet-700/60',
  namedEntities: 'bg-cyan-900/60 text-cyan-300 border-cyan-700/60',
  themes: 'bg-indigo-900/60 text-indigo-300 border-indigo-700/60',
  impliedConclusions: 'bg-orange-900/60 text-orange-300 border-orange-700/60',
  verificationHooks: 'bg-fuchsia-900/60 text-fuchsia-300 border-fuchsia-700/60',
  question: 'bg-blue-900/60 text-blue-300 border-blue-700/60',
  request: 'bg-green-900/60 text-green-300 border-green-700/60',
  bracket: 'bg-red-900/60 text-red-300 border-red-700/60',
  overlap: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/60',
  term: 'bg-gray-800 text-gray-300 border-gray-600',
}

// Distinct highlight shades so each alias in a multi-alias group (e.g. POTUS · 45 · 4 · 10 · 20 · Q+)
// lights up in its OWN color across the reader feed — letting you see at a glance which reference a
// given post actually uses. Legend in the reader header maps each color back to its alias.
const ALIAS_HL_PALETTE = [
  'bg-red-500/50 text-red-50',
  'bg-sky-500/50 text-sky-50',
  'bg-amber-500/50 text-amber-950',
  'bg-green-500/50 text-green-50',
  'bg-violet-500/50 text-violet-50',
  'bg-pink-500/50 text-pink-50',
  'bg-orange-500/50 text-orange-950',
  'bg-teal-500/50 text-teal-50',
  'bg-lime-500/50 text-lime-950',
  'bg-fuchsia-500/50 text-fuchsia-50',
]

type AliasColor = { variant: string; cls: string }

/**
 * Every bracketed span in a drop, in the form the browser renders.
 *
 * ONE definition, used by both the [ Brackets ] panel and the red highlight layer. They were
 * separate before and the panel's regex admitted only letters, digits, space, underscore and
 * hyphen — so #4742 listed [barrage] and [faith in Humanity] while dropping [+family (follow)]
 * and [safeguarding women & children], and archive-wide it lost 618 spans across 353 posts.
 *
 * SERIALIZATION PROVENANCE: the raw archive stores &amp;/&gt;/&lt;; the browser renders & > <.
 * Both callers need the rendered form or the chip disagrees with the drop body above it.
 */
export function bracketSpansIn(text: string): string[] {
  if (!text) return []
  const decode = (s: string) => s
    .replace(/&amp;/gi, '&').replace(/&gt;/gi, '>').replace(/&lt;/gi, '<')
    .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/&nbsp;/gi, ' ')
  const out: string[] = []
  const seen = new Set<string>()
  const rx = /\[[^[\]\n]{1,60}\]/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(text)) !== null) {
    const shown = decode(m[0])
    if (!seen.has(shown)) { seen.add(shown); out.push(shown) }
  }
  return out
}


/**
 * The actual fill + text colour of each highlight kind, so an overlap can cycle the colours the
 * span really belongs to instead of a fixed rainbow. Kept beside HIGHLIGHT_CLS deliberately —
 * if a category's colour changes there it must change here, or the overlap lies about it.
 */
const KIND_RGBA: Record<string, [string, string]> = {
  question:          ['rgba(59,130,246,0.30)', '#bfdbfe'],
  request:           ['rgba(34,197,94,0.40)',  '#dcfce7'],
  requestQuestion:   ['rgba(34,197,94,0.40)',  '#dcfce7'],
  claim:             ['rgba(245,158,11,0.40)', '#fef3c7'],
  prediction:        ['rgba(139,92,246,0.40)', '#ede9fe'],
  namedEntity:       ['rgba(6,182,212,0.30)',  '#cffafe'],
  theme:             ['rgba(99,102,241,0.40)', '#e0e7ff'],
  impliedConclusion: ['rgba(249,115,22,0.40)', '#ffedd5'],
  verificationHook:  ['rgba(217,70,239,0.40)', '#fae8ff'],
  emphasis:          ['rgba(203,213,225,0.60)', '#0f172a'],
  bracketCode:       ['rgba(153,27,27,0.50)',  '#fecaca'],
  context:           ['rgba(107,114,128,0.35)', '#f3f4f6'],
  topic:             ['rgba(250,204,21,0.40)', '#fef9c3'],
  milIntel:          ['rgba(20,184,166,0.35)', '#ccfbf1'],
  qSignature:        ['rgba(192,132,252,0.30)', '#f3e8ff'],
}

/** Class + inline vars that cycle exactly this span's category colours. */
export function overlapStyle(kinds: string[]) {
  const picked = kinds.filter(k => KIND_RGBA[k]).slice(0, 3)
  if (picked.length < 2) return null
  const vars: Record<string, string> = {}
  picked.forEach((k, i) => {
    vars[`--hl-${i + 1}`] = KIND_RGBA[k][0]
    vars[`--hl-${i + 1}-fg`] = KIND_RGBA[k][1]
  })
  return { className: picked.length >= 3 ? 'animate-overlap-3' : 'animate-overlap-2', style: vars as React.CSSProperties }
}

export default function PostDetail() {
  // The reader's acronym info box. Post-aware, so BO reads Barack Obama or Bruce Ohr
  // depending on the drop it is standing in. See src/lib/glossary.tsx.
  const gloss = useGlossary()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlight = searchParams.get('highlight') ?? ''
  const highlightCat = searchParams.get('cat') ?? ''
  // Reader kind drives how sibling posts are found for the reader feed:
  //   (cat present)        → analysis category, siblings via getAnalysisFrequency
  //   rk=question          → siblings via getQuestionFrequency (same question asked)
  //   rk=request|bracket|overlap|term → siblings via full-text search of all posts
  // readerKey drives the badge/label; readerQuery keeps the mode when navigating the feed.
  const readerKind = searchParams.get('rk') ?? ''
  const TEXT_READER_KINDS = ['request', 'bracket', 'overlap', 'term']
  const readerActive = !!highlight && (!!highlightCat || readerKind === 'question' || TEXT_READER_KINDS.includes(readerKind))
  const readerKey = highlightCat || readerKind
  const readerVerb = readerKind === 'question' ? 'asking' : readerKind === 'bracket' ? 'containing' : 'mentioning'
  const topicParam = searchParams.get('topic') ?? ''
  const cardFlash = searchParams.get('flash') === '1'
  const topicKeywords = topicParam ? topicKeywordsFrom(topicParam) : []
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<HTMLPreElement | null>(null)
  const [flash, setFlash] = useState(false)
  const [bodyFlash, setBodyFlash] = useState(false)
  const [localHighlight, setLocalHighlight] = useState('')
  const activeHL = localHighlight || highlight
  const [post, setPost] = useState<QPost | null>(null)
  const [questions, setQuestions] = useState<QQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [detectError, setDetectError] = useState('')
  const [freqMap, setFreqMap] = useState<Map<string, { count: number; postNums: number[] }>>(new Map())
  const [activeFreqQ, setActiveFreqQ] = useState<string | null>(null)
  const [newQuestionIds, setNewQuestionIds] = useState<Set<string>>(new Set())
  const [actionRequests, setActionRequests] = useState<string[]>([])
  const [detectingRequests, setDetectingRequests] = useState(false)
  const [postAnalysis, setPostAnalysis] = useState<PostAnalysis | null>(null)
  const [analyzingPost, setAnalyzingPost] = useState(false)
  const [researchingNews, setResearchingNews] = useState(false)
  const [newsError, setNewsError] = useState('')
  const [aiUnlocked, setAiUnlocked] = useState(false)
  const [pinPromptOpen, setPinPromptOpen] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  // App-wide admin gate (shared with Dashboard, bulk classify, etc.)
  const { unlocked: adminUnlocked, requireAdmin } = useAdmin()
  useHighlightsEnabled()   // re-render the body when the language toggle flips
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMsg, setBulkMsg] = useState<string | null>(null)
  // Alias editing — re-render highlights when aliases change.
  const [aliasTick, setAliasTick] = useState(0)
  useEffect(() => subscribeAliases(() => setAliasTick(t => t + 1)), [])
  // Per-alias colors for the reader feed: when the researched entity has 2+ aliases
  // (e.g. POTUS · 45 · 4 · 10 · 20 · Q+), each gets its own shade so you can see which
  // reference a post actually uses. Single-alias entities stay solid red.
  const aliasColors = useMemo<AliasColor[]>(() => {
    void aliasTick // recompute when aliases load/change
    const variants = [...new Set([highlight, ...getFullAliasGroup(highlight)])].filter(v => v && v.trim())
    if (variants.length <= 1) return variants.map(v => ({ variant: v, cls: 'bg-red-500/50 text-red-50' }))
    return variants.map((v, i) => ({ variant: v, cls: ALIAS_HL_PALETTE[i % ALIAS_HL_PALETTE.length] }))
  }, [highlight, aliasTick])
  const [aliasFor, setAliasFor] = useState<string | null>(null)  // which item's alias input is open
  const [aliasInput, setAliasInput] = useState('')
  const aliasForRef = useRef<string | null>(null)
  aliasForRef.current = aliasFor
  const [analysisFreqMap, setAnalysisFreqMap] = useState<Map<string, { count: number; postNums: number[] }>>(new Map())
  // How many posts in the WHOLE archive contain each chip's wording.
  //
  // analysisFreqMap answers a different question — how many posts classify it in THIS category —
  // which is why "Knowledge is power." read x19 under Claims and x6 under Implied Conclusions,
  // and why a phrase classified in one post showed no number at all. Both are true; the archive
  // count is the one a reader wants when asking "did Q ever say this again?".
  const [corpusCounts, setCorpusCounts] = useState<Map<string, number>>(new Map())

  // Counted once per drop, for the handful of phrases this drop actually shows. Cancelled on
  // navigation so a fast click-through does not leave a stale count on the next post.
  useEffect(() => {
    if (!post) return
    let cancelled = false
    const a = (post.postAnalysis ?? {}) as Record<string, unknown>
    const texts = [...new Set([
      ...(questions ?? []).map(q => q.text),
      ...(post.actionRequests ?? []),
      ...['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks', 'emphasis']
        .flatMap(k => (a[k] as string[] | undefined) ?? []),
      // Brackets too — every category that renders a chip gets a count, or the absence of a
      // number reads as "appears once" when it only means "nobody counted this row".
      ...bracketSpansIn(post.text ?? ''),
    ])].filter(t => t && t.trim().length > 2)
    ;(async () => {
      const next = new Map<string, number>()
      for (const t of texts) {
        if (cancelled) return
        try { next.set(t, (await getPostNumsContaining(t)).length) } catch { /* skip */ }
      }
      if (!cancelled) setCorpusCounts(next)
    })()
    return () => { cancelled = true }
  }, [post, questions])
  const [knownEntities, setKnownEntities] = useState<string[]>([])  // for alias-connect autocomplete
  const [analysisOpen, setAnalysisOpen] = useState(true)
  const [addingToKey, setAddingToKey] = useState<string | null>(null)
  const addingToKeyRef = useRef<string | null>(null)
  addingToKeyRef.current = addingToKey
  const [addInput, setAddInput] = useState('')
  const [customBrackets, setCustomBrackets] = useState<string[]>([])
  const [excludedBrackets, setExcludedBrackets] = useState<string[]>([])
  const [allTopics, setAllTopics] = useState<{ id: string; name: string }[]>([])
  const [topicSearch, setTopicSearch] = useState('')
  const [topicPickerOpen, setTopicPickerOpen] = useState(false)
  const [topicSaving, setTopicSaving] = useState<string | null>(null)

  // Related posts that share the same analysis item (entity/claim/etc.) the user clicked from.
  // Populated only when arriving via an analysis chip (highlight + cat present in the URL).
  // Board post id → Q drop, so a quoted post that is itself one of ours links through to it.
  // Also the fallback source of quoted text where the scrape came up empty.
  // Shared context (board-id → drop, postId → questions), used by the reader feed to
  // highlight each post with its OWN questions rather than only the searched term.
  const [readerCtx, setReaderCtx] = useState<QuotedContext | null>(null)
  useEffect(() => { getQuotedContext().then(setReaderCtx).catch(() => {}) }, [])

  const [refIndex, setRefIndex] = useState<Map<string, QPost> | null>(null)
  useEffect(() => {
    if (!post?.text?.includes('>>')) return
    let cancelled = false
    // The shared, cached context — this used to call getAllPosts() and rebuild a 4,867-entry
    // map on EVERY post you opened, which was my own regression from the quoted-post work.
    getQuotedContext().then(c => { if (!cancelled) setRefIndex(c.byBoardId) })
    return () => { cancelled = true }
  }, [post])

  const qDropFor = useMemo(
    () => (boardId: string) => refIndex?.get(boardId) ?? null,
    [refIndex]
  )

  const quotedPosts = useMemo<QuotedPost[]>(() => {
    if (post?.quotedPosts?.length) return post.quotedPosts
    if (!post?.text?.includes('>>') || !refIndex) return []
    // Fallback: synthesise from the drop the pointer resolves to.
    return resolveReferences(post.text, refIndex)
      .filter(r => r.post)
      .map(r => ({
        boardId: r.boardId,
        link: r.post!.link ?? '',
        name: r.post!.name || 'Q',
        trip: r.post!.trip ?? '',
        userId: r.post!.userId ?? '',
        time: '',
        text: r.post!.text ?? '',
        media: r.post!.media ?? [],
        depth: 0,
      }))
  }, [post, refIndex])

  const [relatedPosts, setRelatedPosts] = useState<QPost[] | null>(null)
  const [relatedLoading, setRelatedLoading] = useState(false)
  // Always open: the collapse control was removed — collapsing left an empty header, and
  // Back is the same action with a clearer name.
  const relatedOpen = true
  const feedRef = useRef<HTMLDivElement | null>(null)
  const currentCardRef = useRef<HTMLDivElement | null>(null)

  // Referenced post image — fetch from 4plebs when post text is only >>XXXXXXX
  const [refImages, setRefImages] = useState<{ num: string; url: string; filename: string }[]>([])
  useEffect(() => {
    if (!post) return
    const refs = Array.from(post.text.matchAll(/>>(\d{6,})/g)).map(m => m[1])
    if (refs.length === 0) return
    setRefImages([])
    Promise.all(refs.map(async num => {
      try {
        const res = await fetch(`/4plebs-proxy/_/api/chan/post/?board=pol&num=${num}`)
        if (!res.ok) return null
        const data = await res.json()
        const tim = data?.tim
        const ext = data?.ext
        if (!tim || !ext) return null
        return { num, url: `https://i.4pcdn.org/pol/${tim}${ext}`, filename: data?.filename ? `${data.filename}${ext}` : `${tim}${ext}` }
      } catch { return null }
    })).then(results => {
      setRefImages(results.filter(Boolean) as { num: string; url: string; filename: string }[])
    })
  }, [post?.id])

  // Load cross-post question frequency counts (includes post numbers for popover)
  useEffect(() => {
    const norm = (t: string) => t.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')
    getQuestionFrequency(1).then(freqs => {
      const map = new Map<string, { count: number; postNums: number[] }>()
      for (const f of freqs) map.set(norm(f.text), { count: f.count, postNums: f.postNums })
      setFreqMap(map)
    })
  }, [])

  // Load all topic clusters once
  useEffect(() => {
    getTopics().then(topics => setAllTopics(topics.map(t => ({ id: t.id, name: t.name }))))
  }, [])

  // When opened from a list chip — an analysis item (e.g. "Jack" under Q Entities) or a
  // question (Q Questions) — load every other post that shares that item so we can list
  // them in post-number order for the reader feed.
  useEffect(() => {
    if (!readerActive || !post) { setRelatedPosts(null); return }
    let cancelled = false
    setRelatedLoading(true)

    // Resolve the sibling posts for whichever reader kind we're in.
    let postsPromise: Promise<QPost[]>
    if (readerKind === 'question') {
      // Same question asked across posts → question frequency index
      const normQ = (t: string) => t.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')
      const target = normQ(highlight)
      postsPromise = getQuestionFrequency(1)
        .then(freqs => freqs.find(f => normQ(f.text) === target)?.postNums ?? [post.postNum])
        .then(getPostsByNums)
    } else if (TEXT_READER_KINDS.includes(readerKind)) {
      // Requests / brackets / overlaps / uncategorized terms → posts whose text contains it
      postsPromise = searchAllPosts(highlight)
        .then(posts => posts.length > 0 ? posts : getPostsByNums([post.postNum]))
    } else {
      // Analysis category (entities, claims, …) → curated analysis frequency index, expanded
      // to the whole alias group (so "HRC" pulls in "Hillary Clinton" / "Hillary" posts too).
      const group = new Set(getFullAliasGroup(highlight).map(t => t.toLowerCase().trim()))
      const groupArr = [...group]
      postsPromise = Promise.all([getAnalysisFrequency(), ...groupArr.map(g => getPostNumsContaining(g))])
        .then(([freqs, ...aliasNums]) => {
          const nums = new Set<number>()
          for (const f of freqs) if (f.category === highlightCat && group.has(f.text.toLowerCase().trim())) f.postNums.forEach(n => nums.add(n))
          for (const arr of aliasNums) arr.forEach(n => nums.add(n))
          return nums.size ? [...nums].sort((a, b) => a - b) : [post.postNum]
        })
        .then(getPostsByNums)
    }

    postsPromise
      .then(posts => {
        if (cancelled) return
        const list = posts
          .map(p => p)
          .sort((a, b) => a.postNum - b.postNum)
        setRelatedPosts(list)
      })
      .catch(() => { if (!cancelled) setRelatedPosts(null) })
      .finally(() => { if (!cancelled) setRelatedLoading(false) })
    return () => { cancelled = true }
  }, [highlight, highlightCat, readerKind, readerActive, post?.id])

  // Center the current post inside the reader feed once the related posts render,
  // so the user starts on the post they clicked and can scroll up/down to the others.
  useEffect(() => {
    if (!relatedPosts || !relatedOpen) return
    const t = setTimeout(() => {
      const c = feedRef.current
      const card = currentCardRef.current
      if (!c || !card) return
      const cRect = c.getBoundingClientRect()
      const rRect = card.getBoundingClientRect()
      c.scrollTop += rRect.top - cRect.top - 12
    }, 80)
    return () => clearTimeout(t)
  }, [relatedPosts, relatedOpen])

  async function handleAddToTopic(topicId: string, topicName: string) {
    if (!post) return
    setTopicSaving(topicId)
    try {
      await addPostToTopic(topicId, post.id, post.postNum, topicName)
      setPost(prev => prev ? { ...prev, topicTags: [...(prev.topicTags ?? []), topicName] } : prev)
      setTopicPickerOpen(false)
      setTopicSearch('')
    } finally {
      setTopicSaving(null)
    }
  }

  async function handleRemoveFromTopic(topicId: string, topicName: string) {
    if (!post) return
    setTopicSaving(topicId)
    try {
      await removePostFromTopic(topicId, post.id, topicName)
      setPost(prev => prev ? { ...prev, topicTags: (prev.topicTags ?? []).filter(t => t !== topicName) } : prev)
    } finally {
      setTopicSaving(null)
    }
  }

  // Manual question add — explicit button-driven flow
  const [selectMode, setSelectMode] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  const [savedManual, setSavedManual] = useState(false)

  function enterSelectMode() {
    setSelectMode(true)
    setSelectedText('')
    setSavedManual(false)
    window.getSelection()?.removeAllRanges()
  }

  function cancelSelectMode() {
    setSelectMode(false)
    setSelectedText('')
    setSavedManual(false)
    window.getSelection()?.removeAllRanges()
  }

  // Use a document-level mouseup so selections that start in the post body
  // but end outside it (very common when dragging down) are still captured.
  // Also feeds directly into the open add-row input via addingToKeyRef.
  useEffect(() => {
    function handleBodyMouseUp() {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !bodyRef.current?.contains(sel.anchorNode)) return
      const text = sel.toString().trim()
      if (text.length >= 3) {
        setSelectedText(text)
        if (addingToKeyRef.current) setAddInput(text)
        if (aliasForRef.current) setAliasInput(text)
      }
    }
    document.addEventListener('mouseup', handleBodyMouseUp)
    return () => document.removeEventListener('mouseup', handleBodyMouseUp)
  }, [])

  async function handleManualSave() {
    if (!selectedText || !post || savingManual) return
    setSavingManual(true)
    try {
      const newQ: QQuestion = {
        id: crypto.randomUUID(),
        postId: post.id,
        postNum: post.postNum,
        text: selectedText.trim(),
        status: 'unprocessed',
        infographId: null,
        createdAt: Date.now(),
      }
      await addQuestions([newQ])
      setQuestions(prev => [...prev, newQ])
      setSavedManual(true)
      window.getSelection()?.removeAllRanges()
      setTimeout(() => {
        setSelectMode(false)
        setSelectedText('')
        setSavedManual(false)
      }, 1500)
    } finally {
      setSavingManual(false)
    }
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      getPost(id),
      getQuestionsForPost(id),
    ]).then(([p, postQuestions]) => {
      setPost(p)
      const norm = (t: string) => t.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')
      const seen = new Set<string>()
      const valid: QQuestion[] = []
      const toDelete: string[] = []

      for (const q of postQuestions) {
        const key = norm(q.text)
        if (seen.has(key)) {
          // Duplicate — queue for deletion
          toDelete.push(q.id)
        } else if (p && !questionExistsInPost(q.text, p.text)) {
          // Question text not found in post body — queue for deletion
          toDelete.push(q.id)
          seen.add(key)
        } else {
          seen.add(key)
          valid.push(q)
        }
      }

      // Fire-and-forget cleanup of ghost/duplicate questions from the local store
      for (const qid of toDelete) {
        removeQuestionById(qid).catch(() => {})
      }

      // Sort by position in post text so list matches reading order
      if (p) {
        const lower = p.text.toLowerCase()
        valid.sort((a, b) => {
          const pa = lower.indexOf(a.text.toLowerCase().trim())
          const pb = lower.indexOf(b.text.toLowerCase().trim())
          return (pa === -1 ? Infinity : pa) - (pb === -1 ? Infinity : pb)
        })
      }

      setQuestions(valid)
      setActionRequests(p?.actionRequests ?? [])
      setPostAnalysis(p?.postAnalysis ?? null)
      setCustomBrackets(p?.customBrackets ?? [])
      setExcludedBrackets(p?.excludedBrackets ?? [])
      setLoading(false)

      // Load analysis frequency map if this post has been analyzed
      if (p?.analysisScanned) {
        getAnalysisFrequency().then(freqs => {
          const map = new Map<string, { count: number; postNums: number[] }>()
          for (const f of freqs) {
            map.set(`${f.category}::${normalizeItemKey(f.text)}`, { count: f.count, postNums: f.postNums })
          }
          setAnalysisFreqMap(map)
          // Known entity names for the alias-connect autocomplete.
          setKnownEntities([...new Set(freqs.filter(f => f.category === 'namedEntities').map(f => f.text))].sort())
        })
      }
    })
  }, [id])

  // Flash the post body white when navigated via ?flash=1 — but NOT for analysis category links
  // (those do a text-specific flash only, not the whole body)
  useEffect(() => {
    if (!cardFlash || highlightCat) return
    setBodyFlash(true)
    const t = setTimeout(() => setBodyFlash(false), 1800)
    return () => clearTimeout(t)
  }, [id, cardFlash])

  // Scroll to the highlighted mark in the post body (from URL param)
  useEffect(() => {
    if (!highlight) return
    setFlash(true)
    // Scroll to the [data-hl="1"] mark in the body — works for both questions and analysis items
    setTimeout(() => {
      const mark = bodyRef.current?.querySelector('[data-hl="1"]') as HTMLElement | null
      if (mark) mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else if (highlightRef.current) highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
    // cardFlash=true → keep flashing permanently (user wants constant white ↔ color pulse)
    // cardFlash=false (e.g. clicking question in list) → clear after 1.8s
    if (!cardFlash) {
      const t = setTimeout(() => setFlash(false), 1800)
      return () => clearTimeout(t)
    }
  }, [highlight, questions, cardFlash])

  // Scroll the POST BODY to the first green mark when a question is clicked in the list
  useEffect(() => {
    if (!localHighlight || !bodyRef.current) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 1800)
    setTimeout(() => {
      const mark = bodyRef.current?.querySelector('[data-hl="1"]') as HTMLElement | null
      mark?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    return () => clearTimeout(t)
  }, [localHighlight])

  // Close freq popover on outside click
  useEffect(() => {
    if (!activeFreqQ) return
    const close = () => setActiveFreqQ(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [activeFreqQ])

  async function handleDetectQuestions() {
    if (!post) return
    setProcessing(true)
    setDetectError('')
    try {
      // Use the verified multi-pass pipeline: regex scan + Claude chunks + verification
      const detected = await detectQuestionsWithVerification(post.text)

      // Filter to only questions that actually exist in the post body
      const valid = detected.filter(q => questionExistsInPost(q.text, post.text))

      // Deduplicate against questions already stored for this post
      const normalize = (t: string) => t.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')
      const existingKeys = new Set(questions.map(q => normalize(q.text)))

      const batch: QQuestion[] = []
      for (const q of valid) {
        if (existingKeys.has(normalize(q.text))) continue
        batch.push({ id: crypto.randomUUID(), postId: post.id, postNum: post.postNum, text: q.text, status: 'unprocessed', infographId: null, createdAt: Date.now() })
      }
      await addQuestions(batch)

      const allQuestions = [...questions, ...batch]
      await updatePost(post.id, { hasQuestions: allQuestions.length > 0 })
      setPost(prev => prev ? { ...prev, hasQuestions: allQuestions.length > 0 } : prev)
      // Sort merged list by position in post
      const lower = post.text.toLowerCase()
      allQuestions.sort((a, b) => {
        const pa = lower.indexOf(a.text.toLowerCase().trim())
        const pb = lower.indexOf(b.text.toLowerCase().trim())
        return (pa === -1 ? Infinity : pa) - (pb === -1 ? Infinity : pb)
      })
      setNewQuestionIds(new Set(batch.map(q => q.id)))
      setQuestions(allQuestions)
      if (batch.length === 0 && questions.length === 0) setDetectError('No questions found in this post.')
    } catch (e) {
      setDetectError(String(e))
    } finally {
      setProcessing(false)
    }
  }

  async function handleRemoveQuestion(questionId: string) {
    removeQuestionById(questionId).catch(() => {})   // also recomputes the post's hasQuestions in the store
    const remaining = questions.filter(q => q.id !== questionId)
    setQuestions(remaining)
    if (remaining.length === 0 && post) {
      setPost(prev => prev ? { ...prev, hasQuestions: false } : prev)
    }
  }

  async function handleDetectRequests() {
    if (!post) return
    setDetectingRequests(true)
    try {
      const found = await detectActionRequests(post.text)
      // Merge with existing, deduplicate
      const combined = [...new Set([...actionRequests, ...found])]
      setActionRequests(combined)
      await updatePost(post.id, { actionRequests: combined, hasRequests: combined.length > 0 })
    } finally {
      setDetectingRequests(false)
    }
  }

  async function handleAddAnalysisItem(key: keyof PostAnalysis, text: string) {
    if (!post || !text.trim()) return
    const trimmed = text.trim()
    const current = (postAnalysis?.[key] as string[] | undefined) ?? []
    if (current.some(i => i.toLowerCase() === trimmed.toLowerCase())) return
    const updated = [...current, trimmed]
    const newAnalysis = { ...(postAnalysis ?? {}), [key]: updated } as PostAnalysis
    setPostAnalysis(newAnalysis)
    await updatePost(post.id, { postAnalysis: newAnalysis, analysisScanned: true })
  }

  async function handleRemoveAnalysisItem(key: keyof PostAnalysis, text: string) {
    if (!post) return
    const current = (postAnalysis?.[key] as string[] | undefined) ?? []
    const updated = current.filter(i => i !== text)
    const newAnalysis = { ...(postAnalysis ?? {}), [key]: updated } as PostAnalysis
    setPostAnalysis(newAnalysis)
    await updatePost(post.id, { postAnalysis: newAnalysis })
  }

  // Bulk: classify this snippet as `key` on every post whose text contains it (admin-gated).
  async function runBulkClassify(key: keyof PostAnalysis, item: string) {
    setBulkBusy(true)
    setBulkMsg(null)
    try {
      const { changed, matched } = await applyAnalysisToMatchingPosts(item, key)
      if (post) {
        const fresh = await getPost(post.id)
        setPostAnalysis(fresh?.postAnalysis ?? null)
      }
      const freqs = await getAnalysisFrequency()
      const map = new Map<string, { count: number; postNums: number[] }>()
      for (const f of freqs) map.set(`${f.category}::${normalizeItemKey(f.text)}`, { count: f.count, postNums: f.postNums })
      setAnalysisFreqMap(map)
      setBulkMsg(`✓ Classified "${item}" on ${changed} post${changed === 1 ? '' : 's'} (of ${matched} containing the phrase).`)
    } catch {
      setBulkMsg('Bulk classify failed.')
    } finally {
      setBulkBusy(false)
    }
  }

  function requestBulkClassify(key: keyof PostAnalysis, item: string) {
    setBulkMsg(null)
    requireAdmin(`classify "${item}" on every post that contains it`, () => runBulkClassify(key, item))
  }

  // Bulk: add this question to every post whose body contains it (admin-gated).
  async function runBulkAddQuestion(text: string) {
    setBulkBusy(true); setBulkMsg(null)
    try {
      const { added, matched } = await addQuestionToMatchingPosts(text)
      if (post) setQuestions(await getQuestionsForPost(post.id))
      setBulkMsg(`✓ Added question "${text}" to ${added} post${added === 1 ? '' : 's'} (of ${matched} containing it).`)
    } catch {
      setBulkMsg('Bulk add failed.')
    } finally {
      setBulkBusy(false)
    }
  }
  function requestBulkAddQuestion(text: string) {
    setBulkMsg(null)
    requireAdmin(`add question "${text}" to every post that contains it`, () => runBulkAddQuestion(text))
  }

  // Bulk add for requests and brackets across every matching post (admin-gated).
  async function runBulk(label: string, fn: () => Promise<{ added: number; matched: number }>) {
    setBulkBusy(true); setBulkMsg(null)
    try {
      const { added, matched } = await fn()
      setBulkMsg(`✓ Added ${label} to ${added} post${added === 1 ? '' : 's'} (of ${matched} containing it).`)
    } catch {
      setBulkMsg('Bulk add failed.')
    } finally {
      setBulkBusy(false)
    }
  }
  function requestBulkAddRequest(text: string) {
    setBulkMsg(null)
    requireAdmin(`add request "${text}" to every post that contains it`, () => runBulk(`request "${text}"`, () => addRequestToMatchingPosts(text)))
  }
  function requestBulkAddBracket(code: string) {
    setBulkMsg(null)
    requireAdmin(`add bracket "${code}" to every post that contains it`, () => runBulk(`bracket "${code}"`, () => addBracketToMatchingPosts(code)))
  }

  // Add a question manually (e.g. from highlighted text), gated by the admin PIN.
  async function handleAddQuestionText(text: string) {
    if (!post) return
    const trimmed = text.trim()
    if (!trimmed) return
    if (questions.some(q => q.text.toLowerCase().trim() === trimmed.toLowerCase())) return
    const newQ: QQuestion = {
      id: crypto.randomUUID(),
      postId: post.id,
      postNum: post.postNum,
      text: trimmed,
      status: 'unprocessed',
      infographId: null,
      createdAt: Date.now(),
    }
    await addQuestions([newQ])
    setQuestions(prev => [...prev, newQ])
  }

  async function handleAddRequest(text: string) {
    if (!post || !text.trim()) return
    const trimmed = text.trim()
    if (actionRequests.some(r => r.toLowerCase() === trimmed.toLowerCase())) return
    const updated = [...actionRequests, trimmed]
    setActionRequests(updated)
    await updatePost(post.id, { actionRequests: updated, hasRequests: true })
  }

  async function handleRemoveRequest(text: string) {
    if (!post) return
    const updated = actionRequests.filter(r => r !== text)
    setActionRequests(updated)
    await updatePost(post.id, { actionRequests: updated, hasRequests: updated.length > 0 })
  }

  async function handleAddBracket(text: string) {
    if (!post || !text.trim()) return
    let code = text.trim().toUpperCase()
    if (!code.startsWith('[')) code = `[${code}]`
    if (customBrackets.includes(code)) return
    const updated = [...customBrackets, code]
    setCustomBrackets(updated)
    await updatePost(post.id, { customBrackets: updated })
  }

  async function handleExcludeBracket(code: string) {
    if (!post) return
    const updatedExcluded = excludedBrackets.includes(code) ? excludedBrackets : [...excludedBrackets, code]
    const updatedCustom = customBrackets.filter(b => b !== code)
    setExcludedBrackets(updatedExcluded)
    setCustomBrackets(updatedCustom)
    await updatePost(post.id, { excludedBrackets: updatedExcluded, customBrackets: updatedCustom })
  }

  async function handleRestoreBracket(code: string) {
    if (!post) return
    const updated = excludedBrackets.filter(b => b !== code)
    setExcludedBrackets(updated)
    await updatePost(post.id, { excludedBrackets: updated })
  }

  async function handleAnalyzePost() {
    if (!post) return
    setAnalyzingPost(true)
    try {
      const analysis = await analyzePost(post.text)
      setPostAnalysis(analysis)
      setAnalysisOpen(true)
      await updatePost(post.id, { postAnalysis: analysis, analysisScanned: true })
      // Refresh frequency map
      getAnalysisFrequency().then(freqs => {
        const map = new Map<string, { count: number; postNums: number[] }>()
        for (const f of freqs) {
          map.set(`${f.category}::${normalizeItemKey(f.text)}`, { count: f.count, postNums: f.postNums })
        }
        setAnalysisFreqMap(map)
      })
    } finally {
      setAnalyzingPost(false)
    }
  }

  // News Correlator — on-demand web research for date-correlated articles
  async function handleResearchNews() {
    if (!post) return
    setResearchingNews(true)
    setNewsError('')
    try {
      const found = await correlateNews({ text: post.text, timestamp: post.timestamp, postAnalysis: postAnalysis ?? undefined })
      const articles: CorrelatedArticle[] = found.map(a => ({
        ...a,
        id: crypto.randomUUID(),
        userRating: null,
        credibility: 'unverified',
        notes: '',
        addedAt: Date.now(),
      }))
      // Merge with any existing, de-duplicating by URL
      const existing = post.correlatedNews ?? []
      const seen = new Set(existing.map(a => a.url))
      const merged = [...existing, ...articles.filter(a => !seen.has(a.url))]
      setPost(prev => prev ? { ...prev, correlatedNews: merged, newsScanned: true } : prev)
      await updatePost(post.id, { correlatedNews: merged, newsScanned: true })
      if (articles.length === 0) setNewsError('No corroborating articles found for this post.')
    } catch (e) {
      setNewsError(String(e instanceof Error ? e.message : e))
    } finally {
      setResearchingNews(false)
    }
  }

  // PIN gate — the AI research is paid, so require the PIN once per session before running it.
  function requestResearch() {
    if (aiUnlocked) { handleResearchNews(); return }
    setPinError('')
    setPinPromptOpen(true)
  }
  function submitPin(e: React.FormEvent) {
    e.preventDefault()
    if (pinInput === AI_PIN) {
      setAiUnlocked(true)
      setPinPromptOpen(false)
      setPinInput('')
      setPinError('')
      handleResearchNews()
    } else {
      setPinError('Incorrect PIN.')
    }
  }

  // Local honesty layer — update one article's rating/credibility/notes, persist locally
  async function updateArticle(id: string, patch: Partial<CorrelatedArticle>) {
    if (!post) return
    const updated = (post.correlatedNews ?? []).map(a => a.id === id ? { ...a, ...patch } : a)
    setPost(prev => prev ? { ...prev, correlatedNews: updated } : prev)
    await updatePost(post.id, { correlatedNews: updated })
  }

  async function removeArticle(id: string) {
    if (!post) return
    const updated = (post.correlatedNews ?? []).filter(a => a.id !== id)
    setPost(prev => prev ? { ...prev, correlatedNews: updated } : prev)
    await updatePost(post.id, { correlatedNews: updated })
  }

  async function handleClassify() {
    if (questions.length === 0) return
    setClassifying(true)
    try {
      const statuses = await classifyQuestions(
        questions.map(q => ({ id: q.id, text: q.text })),
        'Q post archive — political/government research posts from 2017-2020'
      )
      const statusMap: Record<string, QQuestion['status']> = {}
      const updated: QQuestion[] = []
      for (const q of questions) {
        const status = statuses[q.id] ?? 'unprocessed'
        statusMap[q.id] = status
        updated.push({ ...q, status })
      }
      await setQuestionStatuses(statusMap)
      setQuestions(updated)
    } finally {
      setClassifying(false)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Loading…</div>
  if (!post) return <div className="p-6 text-red-400">Post not found.</div>

  const date = new Date(post.timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const prevNum = post.postNum - 1
  const nextNum = post.postNum + 1

  // Navigation bar — reused by both the reader-only layout and the full post layout.
  // Prev/next use { replace: true } so stepping through posts doesn't pile up history — one "Back"
  // always returns to wherever you entered from (the search results, the Entities list, etc.)
  // instead of walking back one post at a time.
  const navBar = (
    <div className="flex items-center justify-between">
        <BackButton fallback="/archive" />
        <div className="flex items-center gap-2">
          {prevNum >= 1 ? (
            <button
              onClick={() => navigate(`/post/${prevNum}`, { replace: true })}
              className="flex items-center gap-1 text-sm bg-q-panel border border-q-border hover:border-gray-500 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              ← #{prevNum}
            </button>
          ) : (
            <span className="text-sm text-gray-700 px-3 py-1.5">← First post</span>
          )}
          <span className="text-xs text-gray-600 px-1">Post #{post.postNum}</span>
          <button
            onClick={() => navigate(`/post/${nextNum}`, { replace: true })}
            className="flex items-center gap-1 text-sm bg-q-panel border border-q-border hover:border-gray-500 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            #{nextNum} →
          </button>
        </div>
    </div>
  )

  // Reader — full body of every post tied to the clicked item (entity, question, request,
  // bracket, …), in post-number order. In reader mode this is the WHOLE screen (below the nav):
  // current post on top, scroll (wheel or finger) up / down. The standard single-post view and
  // analysis tools are hidden so the feed is the entire experience.
  const readerPanel = readerActive && (
        <div className="bg-q-panel border border-cyan-800/40 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded font-medium border ${ANALYSIS_CAT_BADGE[readerKey] ?? 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                {ANALYSIS_CAT_LABEL[readerKey] ?? readerKey}
              </span>
              <h2 className="font-semibold text-white">
                Reading every post {readerVerb} "<span className="text-cyan-300">{highlight}</span>"
              </h2>
              {relatedPosts && (
                <span className="text-xs text-gray-500">
                  {relatedPosts.length} post{relatedPosts.length !== 1 ? 's' : ''} · scroll ↑ earlier / ↓ later
                </span>
              )}
            </div>
          </div>

          {/* Alias color legend — only when the entity has 2+ aliases, so you can tell which
              reference (POTUS vs 45 vs 4/10/20 vs Q+) each highlighted post is actually using. */}
          {aliasColors.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <span className="text-[11px] text-gray-500 mr-0.5">Alias colors:</span>
              {aliasColors.map(a => (
                <span key={a.variant} className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${a.cls}`}>
                  {a.variant}
                </span>
              ))}
            </div>
          )}

          {(relatedLoading || !relatedPosts) ? (
            <p className="text-gray-500 text-sm animate-pulse py-2">Finding related posts…</p>
          ) : relatedOpen && (
            <div
              ref={feedRef}
              className="max-h-[78vh] overflow-y-auto overscroll-contain rounded-lg border border-q-border bg-black/20 divide-y divide-q-border"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            >
              {relatedPosts.map(rp => {
                const isCurrent = rp.postNum === post.postNum
                const ms = rp.timestamp > 1e10 ? rp.timestamp : rp.timestamp * 1000
                const rpDate = new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                return (
                  <div
                    key={rp.postNum}
                    ref={isCurrent ? currentCardRef : null}
                    className={`px-4 py-3 scroll-mt-2 ${isCurrent ? 'bg-cyan-900/15 ring-1 ring-inset ring-cyan-700/50' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Link
                        to={`/post/${rp.postNum}?flash=1&highlight=${encodeURIComponent(highlight)}`}
                        className={`font-mono text-xs px-2 py-0.5 rounded border transition-colors ${
                          isCurrent
                            ? 'bg-cyan-900/40 text-cyan-200 border-cyan-700/60 font-bold'
                            : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-cyan-900/40 hover:text-cyan-200 hover:border-cyan-600'
                        }`}
                        title={`Open post #${rp.postNum} on its own with "${highlight}" highlighted`}
                      >
                        #{rp.postNum}
                      </Link>
                      <span className="text-[11px] text-gray-500">{rpDate}</span>
                      <span className={`text-[10px] ml-auto ${
                        isCurrent ? 'text-cyan-400 font-medium' : 'text-gray-600'
                      }`}>
                        {isCurrent ? '● current' : rp.postNum < post.postNum ? '↑ earlier' : '↓ later'}
                      </span>
                    </div>
                    <QuotedPosts quoted={rp.quotedPosts ?? []} searchKeyword={highlight} />
                    {/* The full highlighter, not just the term. This feed used to render
                        plain text with only the searched phrase marked, so every post you
                        scrolled through lost its questions, claims and entities — the whole
                        point of the archive. */}
                    <pre className="text-gray-200 post-text whitespace-pre-wrap break-words">
                      {linkify(highlightText(
                        rp.text,
                        readerCtx?.questionsByPostId.get(rp.id) ?? [],
                        highlight,
                        rp.actionRequests ?? [],
                        rp.postAnalysis,
                        rp.postNum,
                        gloss,
                      ))}
                    </pre>
                  </div>
                )
              })}
            </div>
          )}
        </div>
  )

  // Reader mode: nav + the full-post reader feed only — no duplicate single-post card below.
  if (readerActive) {
    return (
      <div className="p-6 space-y-6 max-w-3xl">
        {navBar}
        {readerPanel}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {navBar}

      {/* Post header */}
      <div className="bg-q-panel border border-q-border rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="text-gray-400 font-bold text-xl">
              {/* The WHOLE label is the link, not just the digits — and it goes to ?goto=, which
                  scrolls the archive list to this drop with its neighbours around it. ?q=#N was a
                  text search for "#N" and landed on a one-post search page instead. */}
              <Link
                to={`/posts?goto=${post.postNum}`}
                title={`See #${post.postNum} in the Post Archive, with the drops around it`}
                className="hover:underline underline-offset-4 decoration-2 hover:text-blue-300 transition-colors"
              >{CAN_EDIT ? `Qpost #${post.postNum}` : `Post #${post.postNum}`}</Link>
              {CAN_EDIT ? ' Editing' : ''}
            </span>
            {(() => {
              const src = sourceLink(post)
              return (
                <p className="text-xs text-gray-500 mt-1">
                  {date}<span className="mx-2 text-gray-700">·</span><span className="text-gray-600" title="How long ago this drop was posted">{timeAgo(post.timestamp)}</span><span className="mx-2 text-gray-700">·</span>{src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      title={src.hint}
                      className="text-gray-400 hover:text-blue-300 underline decoration-dotted underline-offset-2 transition-colors"
                    >
                      {src.label} {src.kind === 'archived' ? '🗄' : '↗'}
                    </a>
                  ) : (
                    <span title={src.hint}>{src.label}</span>
                  )}
                </p>
              )
            })()}
            {post.trip && <p className="text-xs text-indigo-400 mt-0.5">Trip: {post.trip}</p>}
          </div>
          {/* Topic cluster chips — interactive */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap gap-1 justify-end">
              {(post.topicTags ?? []).map(t => {
                const topic = allTopics.find(at => at.name === t)
                return (
                  <span key={t} className="flex items-center gap-1 text-xs bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded group">
                    {t}
                    {CAN_EDIT && topic && (
                      <button
                        onClick={() => handleRemoveFromTopic(topic.id, t)}
                        disabled={topicSaving === topic.id}
                        className="opacity-0 group-hover:opacity-100 text-[10px] hover:text-red-300 transition-all leading-none ml-0.5"
                        title="Remove from this topic"
                      >
                        {topicSaving === topic.id ? '…' : '✕'}
                      </button>
                    )}
                  </span>
                )
              })}
              {CAN_EDIT && (
              <button
                onClick={() => setTopicPickerOpen(v => !v)}
                className="text-xs bg-indigo-900/20 hover:bg-indigo-900/50 border border-indigo-700/40 text-indigo-400 hover:text-indigo-200 px-2 py-0.5 rounded transition-colors"
                title="Add to a topic cluster"
              >
                + topic
              </button>
              )}
            </div>
            {/* Topic picker dropdown */}
            {topicPickerOpen && (
              <div className="w-72 bg-[#0f1623] border border-indigo-700/60 rounded-xl p-3 shadow-xl z-30">
                <input
                  autoFocus
                  value={topicSearch}
                  onChange={e => setTopicSearch(e.target.value)}
                  placeholder="Search topic clusters…"
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 mb-2"
                />
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {allTopics
                    .filter(t => !topicSearch || t.name.toLowerCase().includes(topicSearch.toLowerCase()))
                    .map(t => {
                      const already = (post.topicTags ?? []).includes(t.name)
                      return (
                        <button
                          key={t.id}
                          onClick={() => !already && handleAddToTopic(t.id, t.name)}
                          disabled={already || topicSaving === t.id}
                          className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                            already
                              ? 'text-indigo-400 bg-indigo-900/30 cursor-default'
                              : 'text-gray-300 hover:bg-indigo-900/40 hover:text-white'
                          }`}
                        >
                          {already ? '✓ ' : ''}{t.name}
                          {topicSaving === t.id && <span className="ml-1 text-gray-500">…</span>}
                        </button>
                      )
                    })}
                  {allTopics.filter(t => !topicSearch || t.name.toLowerCase().includes(topicSearch.toLowerCase())).length === 0 && (
                    <p className="text-xs text-gray-600 px-2 py-2">No topics match</p>
                  )}
                </div>
                <button
                  onClick={() => { setTopicPickerOpen(false); setTopicSearch('') }}
                  className="mt-2 w-full text-xs text-gray-500 hover:text-white text-center transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Topic context banner */}
        {topicParam && (
          <div className="mb-3 flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2">
            <span className="text-yellow-400 text-xs">📖</span>
            <p className="text-xs text-yellow-300">
              Opened from chapter: <span className="font-semibold">{topicParam}</span>
              {topicKeywords.length > 0 && (
                <span className="text-yellow-500 ml-2">— topic keywords highlighted in yellow</span>
              )}
            </p>
          </div>
        )}

        {/* Selection mode instruction banner */}
        {selectMode && (
          <div className="mb-3 flex items-center gap-2 bg-blue-900/30 border border-blue-600 rounded-lg px-3 py-2">
            <span className="text-blue-400">👆</span>
            <p className="text-xs text-blue-300 font-medium">
              Highlight the missed question text below, then click <span className="text-white font-bold">Save Additional Question</span>
            </p>
          </div>
        )}

        {/* What this drop quotes. Scraped content when we have it; otherwise the Q drop the
            pointer resolves to internally, so a reply is never just a bare number. */}
        <QuotedPosts quoted={quotedPosts} qDropFor={qDropFor} />

        {/* Post body */}
        <pre
          ref={bodyRef}
          className={`text-gray-200 post-text whitespace-pre-wrap break-words rounded-lg p-4 overflow-x-auto transition-colors ${
            selectMode ? 'bg-blue-950/30 cursor-text select-text border border-blue-800' : 'bg-black/30'
          } ${bodyFlash ? 'animate-body-flash' : ''}`}
        >
          {linkify(renderPostBody(post.text, questions, activeHL, flash, topicKeywords, undefined, newQuestionIds, actionRequests, postAnalysis ?? undefined, highlightCat || undefined, post.postNum, gloss))}
        </pre>

        {/* Unresolved references in this drop, each deep-linking to its exact occurrence. */}
        <UnresolvedInPost postNum={post.postNum} />

        {/* Manual add — selected text preview + save/cancel */}
        {selectMode && (
          <div className="mt-3 space-y-2">
            {selectedText ? (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1 font-medium">Selected question text:</p>
                <p className="text-sm text-white leading-snug">"{selectedText}"</p>
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-dashed border-gray-600 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">No text selected yet — highlight text above</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleManualSave}
                disabled={!selectedText || savingManual || savedManual}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  savedManual
                    ? 'bg-green-700 text-green-200'
                    : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40'
                }`}
              >
                {savedManual ? '✓ Question Saved!' : savingManual ? 'Saving…' : 'Save Additional Question'}
              </button>
              <button
                onClick={cancelSelectMode}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Media — Q's own attached images */}
        {dedupeMedia(post.media).length > 0 && (
          <div className="mt-4 space-y-3">
            {dedupeMedia(post.media).map(m => {
              if (!m.url) return null
              const isNonImage = /\.(pdf|mp4|webm|mov|doc|docx|xls|xlsx)$/i.test(m.url)
              return isNonImage ? (
                <a key={m.url} href={mediaUrl(m.url)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline bg-gray-800 px-2 py-1 rounded">
                  📎 {m.filename || m.url}
                </a>
              ) : (
                <div key={m.url} className="rounded-lg overflow-hidden border border-gray-700">
                  <img
                    src={mediaUrl(m.url)}
                    alt={m.filename}
                    className="max-w-full h-auto block"
                    loading="lazy"
                    onError={e => { (e.currentTarget.closest('.rounded-lg') as HTMLElement).style.display = 'none' }}
                  />
                  <div className="bg-gray-800/70 px-3 py-1.5 flex items-center justify-between">
                    <span className="text-xs text-gray-400 truncate mr-2">{m.filename}</span>
                    <a href={mediaUrl(m.url)} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline shrink-0">Open ↗</a>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Referenced post images — fetched from 4plebs for >>XXXXXXX quotes */}
        {refImages.length > 0 && (
          <div className="mt-4 space-y-3">
            {refImages.map(img => (
              <div key={img.num} className="rounded-lg overflow-hidden border border-indigo-700/50">
                <div className="bg-indigo-900/30 px-3 py-1.5 text-xs text-indigo-300 font-mono">
                  Referenced post &gt;&gt;{img.num}
                </div>
                <img
                  src={mediaUrl(img.url)}
                  alt={img.filename}
                  className="max-w-full h-auto block"
                  loading="lazy"
                  onError={e => { (e.currentTarget.closest('.rounded-lg') as HTMLElement).style.display = 'none' }}
                />
                <div className="bg-gray-800/70 px-3 py-1.5 flex items-center justify-between">
                  <span className="text-xs text-gray-400 truncate mr-2">{img.filename}</span>
                  <a href={mediaUrl(img.url)} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline shrink-0">Open ↗</a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* External link. break-all + min-w-0: a board permalink is one long unbroken token,
            so without them it refuses to wrap and pushes out past the card's right edge. */}
        {post.link && (
          <div className="mt-3 min-w-0">
            <a href={post.link} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 break-all inline-block max-w-full">
              View original → {post.link}
            </a>
          </div>
        )}
      </div>

      {/* News Correlation — "future proves past": on-demand web research + local honesty layer */}
      {(() => {
        const articles = [...(post.correlatedNews ?? [])].sort((a, b) => {
          const order = { before: 0, same: 1, after: 2 }
          return order[a.timing] - order[b.timing] || b.relevance - a.relevance
        })
        const TIMING_BADGE: Record<string, string> = {
          before: 'bg-sky-900/50 text-sky-300 border-sky-700/60',
          same: 'bg-gray-800 text-gray-300 border-gray-600',
          after: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/60',
        }
        const TIMING_LABEL: Record<string, string> = { before: '↑ before drop', same: '≈ same time', after: '↓ after drop' }
        const CRED: { key: CorrelatedArticle['credibility']; label: string; cls: string }[] = [
          { key: 'credible', label: 'Credible', cls: 'bg-green-900/50 text-green-300 border-green-700/60' },
          { key: 'questionable', label: 'Questionable', cls: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/60' },
          { key: 'fake', label: 'Fake', cls: 'bg-red-900/50 text-red-300 border-red-700/60' },
          { key: 'unverified', label: 'Unverified', cls: 'bg-gray-800 text-gray-400 border-gray-600' },
        ]
        return (
          <div className="bg-q-panel border border-emerald-800/40 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <div>
                <h2 className="font-semibold text-white">🔎 News Correlation <span className="text-gray-500 font-normal text-sm">— future proves past</span></h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {CAN_EDIT
                    ? 'AI searches the web for real articles dated around this drop. Rate each one to keep the proof honest.'
                    : 'Real news articles dated around this drop, rated for credibility.'}
                </p>
              </div>
              {CAN_EDIT && (
              <button
                onClick={requestResearch}
                disabled={researchingNews}
                className="text-xs bg-emerald-800 hover:bg-emerald-700 text-emerald-100 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                title={aiUnlocked ? '' : 'PIN required (paid AI feature)'}
              >
                {researchingNews ? '🌐 Researching…' : !aiUnlocked ? '🔒 Research news' : articles.length > 0 ? '🔄 Find more' : '🌐 Research news'}
              </button>
              )}
            </div>

            {/* PIN gate for the paid AI feature */}
            {CAN_EDIT && pinPromptOpen && !aiUnlocked && (
              <form onSubmit={submitPin} className="flex items-center gap-2 flex-wrap mt-2 bg-black/30 border border-emerald-800/40 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-400">🔒 Enter PIN to use AI research:</span>
                <input
                  autoFocus
                  type="password"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={e => { setPinInput(e.target.value); setPinError('') }}
                  placeholder="••••••"
                  className="w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white tracking-widest text-center focus:outline-none focus:border-emerald-600"
                />
                <button type="submit" className="text-xs bg-emerald-800 hover:bg-emerald-700 text-emerald-100 px-2 py-1 rounded transition-colors">Unlock</button>
                <button type="button" onClick={() => { setPinPromptOpen(false); setPinInput(''); setPinError('') }} className="text-xs text-gray-500 hover:text-white px-1">Cancel</button>
                {pinError && <span className="text-xs text-red-400">{pinError}</span>}
              </form>
            )}

            {newsError && (
              <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/50 rounded-lg px-3 py-2 mt-2">{newsError}</p>
            )}
            {researchingNews && (
              <p className="text-xs text-gray-400 animate-pulse mt-2">Searching the web and cross-checking dates… this can take 20–60s.</p>
            )}

            {articles.length > 0 && (
              <div className="space-y-2 mt-3">
                {articles.map(a => (
                  <div key={a.id} className="bg-black/20 border border-q-border rounded-lg p-3">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TIMING_BADGE[a.timing]}`}>{TIMING_LABEL[a.timing]}</span>
                      <span className="text-[11px] text-gray-500">{a.source}{a.publishedDate ? ` · ${a.publishedDate}` : ''}</span>
                      <span className="text-[10px] text-emerald-400 ml-auto">{a.relevance}% match</span>
                      {CAN_EDIT && <button onClick={() => removeArticle(a.id)} className="text-[10px] text-gray-600 hover:text-red-400 transition-colors" title="Remove">✕</button>}
                    </div>
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-blue-300 hover:text-blue-200 hover:underline font-medium leading-snug block">
                      {a.title} ↗
                    </a>
                    {a.summary && <p className="text-xs text-gray-400 mt-1 leading-snug">{a.summary}</p>}

                    {/* Local honesty controls — editing only. Readers see the verdict below. */}
                    {CAN_EDIT && (
                    <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-q-border/60">
                      <button
                        onClick={() => updateArticle(a.id, { userRating: a.userRating === 'up' ? null : 'up' })}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${a.userRating === 'up' ? 'bg-green-800/60 text-green-200 border-green-600' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-green-300'}`}
                      >👍</button>
                      <button
                        onClick={() => updateArticle(a.id, { userRating: a.userRating === 'down' ? null : 'down' })}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${a.userRating === 'down' ? 'bg-red-800/60 text-red-200 border-red-600' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-red-300'}`}
                      >👎</button>
                      <span className="text-[10px] text-gray-600 ml-1">Is it fake news?</span>
                      {CRED.map(c => (
                        <button
                          key={c.key}
                          onClick={() => updateArticle(a.id, { credibility: c.key })}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${a.credibility === c.key ? c.cls : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'}`}
                        >{c.label}</button>
                      ))}
                    </div>
                    )}
                    {CAN_EDIT ? (
                      <input
                        value={a.notes ?? ''}
                        onChange={e => updateArticle(a.id, { notes: e.target.value })}
                        placeholder="Your notes / evidence…"
                        className="w-full mt-2 bg-gray-900/60 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-600"
                      />
                    ) : (
                      /* Read-only verdict: show the rating and notes if any were recorded. */
                      (a.userRating || a.credibility || a.notes) && (
                        <div className="flex items-start gap-2 flex-wrap mt-2 pt-2 border-t border-q-border/60">
                          {a.userRating && <span className="text-xs">{a.userRating === 'up' ? '👍' : '👎'}</span>}
                          {a.credibility && (() => {
                            const c = CRED.find(x => x.key === a.credibility)
                            return c ? <span className={`text-[10px] px-1.5 py-0.5 rounded border ${c.cls}`}>{c.label}</span> : null
                          })()}
                          {a.notes && <p className="text-xs text-gray-400 leading-snug flex-1 min-w-[8rem]">{a.notes}</p>}
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Post Analysis panel — always shown so user can add items even on unanalyzed posts */}
      {(() => {
        // Themes first, by owner request: the subject of a drop is the orienting fact, so it
        // belongs at the top of the analysis rather than six rows down.
        const CATS: { key: keyof PostAnalysis; label: string; color: string; chip: string }[] = [
          { key: 'namedEntities',      label: 'Named Entities',      color: 'text-cyan-400',   chip: 'bg-cyan-500/20 text-cyan-200 border-cyan-700/50' },
          { key: 'claims',             label: 'Claims',              color: 'text-amber-400',  chip: 'bg-amber-500/20 text-amber-200 border-amber-700/50' },
          { key: 'predictions',        label: 'Predictions',         color: 'text-violet-400', chip: 'bg-violet-500/20 text-violet-200 border-violet-700/50' },
          // Implied Conclusions row retired — see the note on the highlight layer above.
      // Checkable Claims merged into Claims by owner ruling 2026-08-15. All 1,926 were ALREADY
          { key: 'emphasis',           label: 'Emphasis',            color: 'text-slate-400',  chip: 'bg-slate-500/20 text-slate-200 border-slate-600/50' },
        ]
        // Every bracketed span Q wrote in this drop.
        //
        // This panel is a LITERAL STRUCTURE view — "what is in brackets here" — and it is a
        // different question from Codes & Brackets, which is the certified SEMANTIC layer. The
        // two are allowed to differ; what is not allowed is this panel quietly showing some of
        // the drop's brackets and not others.
        //
        // It used to build its list with /\[\[?[A-Za-z0-9][A-Za-z0-9 _\-]{0,30}\]?\]/g, whose
        // character class admits only letters, digits, space, underscore and hyphen. So #4742
        // showed [barrage] and [faith in Humanity] while silently dropping [+family (follow)]
        // (the "+" and the parentheses) and [safeguarding women & children] (the "&", which the
        // board stores as &amp;). Archive-wide that regex dropped 618 spans across 353 posts —
        // [13=M], [-30], [DEATH + MONEY], [visibility / reach], [foreign &amp; domestic].
        //
        // A reader cannot tell a deliberate exclusion from a regex that never matched, so the
        // rule is: match ANY bracketed run, and let the reader see what Q actually wrote.
        // ONE definition, shared with the red bracketCode highlight layer — see bracketSpansIn.
        const autoBrackets: string[] = bracketSpansIn(post?.text ?? '')
        const allBrackets = [...new Set([...autoBrackets.filter(b => !excludedBrackets.includes(b)), ...customBrackets])]

        function AddRow({ rowKey }: { rowKey: string }) {
          if (!adminUnlocked) return null   // editing requires admin PIN
          return addingToKey === rowKey ? (
            <form className="flex gap-1 mt-1" onSubmit={e => {
              e.preventDefault()
              if (rowKey === 'brackets') handleAddBracket(addInput)
              else if (rowKey === 'questions') handleAddQuestionText(addInput)
              else if (rowKey === 'request') handleAddRequest(addInput)
              else handleAddAnalysisItem(rowKey as keyof PostAnalysis, addInput)
              setAddInput(''); setAddingToKey(null); setSelectedText('')
            }}>
              <input autoFocus value={addInput} onChange={e => setAddInput(e.target.value)}
                placeholder="Highlight text above, or type here…"
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white min-w-0" />
              <button type="submit" className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded transition-colors">Add</button>
              <button type="button" onClick={() => { setAddingToKey(null); setAddInput(''); setSelectedText('') }} className="text-xs text-gray-500 hover:text-white px-1">✕</button>
            </form>
          ) : (
            <button
              onClick={() => { setAddingToKey(rowKey); setAddInput(selectedText) }}
              className={`text-xs transition-colors ml-1 shrink-0 ${selectedText ? 'text-blue-400 hover:text-blue-200 font-medium' : 'text-gray-600 hover:text-gray-300'}`}
            >
              {selectedText ? '📋 + add' : '+ add'}
            </button>
          )
        }

        return (
          <div className="bg-q-panel border border-violet-800/40 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-white">🔬 Post Analysis</h2>
                {selectedText && !addingToKey && (
                  <p className="text-xs text-blue-400 mt-0.5">
                    📋 "<span className="text-blue-200">{selectedText.length > 60 ? selectedText.slice(0, 60) + '…' : selectedText}</span>" — click <span className="font-semibold">+ add</span> to use
                  </p>
                )}
                {postAnalysis?.emotionalTone && !selectedText && (
                  <span className="text-xs text-gray-400 mt-0.5">
                    Tone: <span className="text-violet-300 font-medium">{postAnalysis.emotionalTone}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {CAN_EDIT && !adminUnlocked && (
                  <button onClick={() => requireAdmin("edit this post's analysis", () => setAnalysisOpen(true))}
                    className="text-xs text-violet-300 hover:text-white bg-violet-900/30 border border-violet-700/50 px-2 py-1 rounded transition-colors">
                    🔒 Unlock to edit
                  </button>
                )}
                <button onClick={() => setAnalysisOpen(v => !v)}
                  className="text-xs text-gray-500 hover:text-white bg-gray-800 border border-gray-700 px-2 py-1 rounded transition-colors">
                  {analysisOpen ? '▲ Collapse' : '▼ Expand'}
                </button>
              </div>
            </div>

            {bulkBusy && <div className="mb-3 text-xs text-violet-300 animate-pulse">Applying across all posts…</div>}
            {bulkMsg && (
              <div className="mb-3 text-xs text-green-300 bg-green-900/20 border border-green-800/40 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <span>{bulkMsg}</span>
                <button onClick={() => setBulkMsg(null)} className="text-gray-500 hover:text-white">✕</button>
              </div>
            )}

            {analysisOpen && (
              <div className="space-y-3">
                {/* What this drop contains across all eight certified sections, and where those
                    layers touch. Counts come from relationships.json, never recomputed here. */}
                {/* THEMES FIRST — above the Analysis map, Questions and Requests.
                    Owner request: the subject of a drop is the orienting fact, so it sits
                    directly under the Tone line rather than several rows down. Rendered here
                    explicitly and excluded from the CATS loop below, because that loop runs
                    after the map and after Questions/Requests. */}
                {(postAnalysis?.themes?.length ?? 0) > 0 && (
                  <div data-analysis-section="themes" className="mb-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium w-32 shrink-0 text-indigo-400">Themes</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-0">
                      {(postAnalysis?.themes ?? []).map((item, i) => (
                        <span key={i} className="text-xs border px-2 py-0.5 rounded flex items-center gap-1 group bg-indigo-500/20 text-indigo-200 border-indigo-700/50">
                          {/* A THEME IS NOT A TEXT SEARCH.
                              "Media & Information" is a taxonomy label inferred from a drop, not
                              wording Q ever wrote, so /posts?q=<label> searched the corpus for a
                              string that does not exist and returned "No posts found" — while the
                              facet above it correctly reported 301. Themes route to the analysis
                              page, which lists the posts the theme was actually assigned to.
                              Same reason the count comes from the frequency map rather than from
                              corpusCounts: counting text occurrences of a label gives zero. */}
                          <Link to={`/analysis?tab=themes&q=${encodeURIComponent(item)}`}
                            title={`Show every post carrying the theme "${item}"`}
                            className="hover:underline decoration-dotted underline-offset-2">{item}</Link>
                          {(analysisFreqMap.get(`themes::${normalizeItemKey(item)}`)?.count ?? 0) > 1 && (
                            <Link to={`/analysis?tab=themes&q=${encodeURIComponent(item)}`}
                              title={`${analysisFreqMap.get(`themes::${normalizeItemKey(item)}`)?.count} posts carry this theme`}
                              className="font-bold opacity-60 hover:opacity-100">×{analysisFreqMap.get(`themes::${normalizeItemKey(item)}`)?.count}</Link>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <AnalysisMap
                  postNum={post.postNum}
                  /* OWNER RULE: anything in brackets is a bracket item and must be counted, so the
                     map's total agrees with the [ Brackets ] list below it. Passed in rather than
                     re-derived inside AnalysisMap — that component deliberately counts nothing
                     itself, and a component that re-derived a category is the mistake this whole
                     pipeline exists to prevent. */
                  extraCounts={{ brackets: bracketSpansIn(post.text ?? '').length }}
                  onJump={section => {
                    const el = document.querySelector(`[data-analysis-section="${section}"]`)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                />

                {/* Questions row — manage the post's questions like any other category.
                    Same empty-row rule as the categories below: hidden when there are none and
                    nothing can be added. */}
                {(questions.length > 0 || CAN_EDIT) && (
                <div data-analysis-section="questions">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium w-32 shrink-0 text-blue-400">Questions</span>
                    <AddRow rowKey="questions" />
                  </div>
                  {questions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {questions.map(q => (
                        <span key={q.id} className="text-xs border px-2 py-0.5 rounded flex items-center gap-1 group bg-blue-500/20 text-blue-200 border-blue-700/50">
                          {/* Clickable, like every other analysis chip — the Questions row was the
                              last one left as dead text, so a reader could not ask where else Q
                              asked the same thing. */}
                          <Link to={`/posts?q=${encodeURIComponent(q.text)}`}
                            title={`Show all posts asking "${q.text}"`}
                            className="hover:underline decoration-dotted underline-offset-2">{q.text}</Link>
                          {(corpusCounts.get(q.text) ?? 0) > 1 && (
                            <Link to={`/posts?q=${encodeURIComponent(q.text)}`}
                              title={`${corpusCounts.get(q.text)} posts in the archive ask this`}
                              className="font-bold opacity-60 hover:opacity-100">×{corpusCounts.get(q.text)}</Link>
                          )}
                          {CAN_EDIT && <button
                            onClick={() => requestBulkAddQuestion(q.text)}
                            disabled={bulkBusy}
                            title={`Admin: add this question to every post containing "${q.text}"`}
                            className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-white transition-all leading-none disabled:opacity-40">
                            {adminUnlocked ? '⇉ add all' : '🔒 all'}
                          </button>}
                          {adminUnlocked && (
                            <button onClick={() => handleRemoveQuestion(q.id)}
                              className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-red-300 transition-all leading-none">✕</button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Requests row — same empty-row rule. */}
                {((post.actionRequests?.length ?? 0) > 0 || CAN_EDIT) && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium w-32 shrink-0 text-green-400">Requests</span>
                    <AddRow rowKey="request" />
                  </div>
                  {actionRequests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {actionRequests.map((req, i) => (
                        <span key={i} className="text-xs border px-2 py-0.5 rounded flex items-center gap-1 group bg-green-900/30 text-green-200 border-green-700/50">
                          <Link to={`/posts?q=${encodeURIComponent(req)}`}
                            title={`Show all posts containing "${req}"`}
                            className="hover:underline decoration-dotted underline-offset-2">{req}</Link>
                          {(corpusCounts.get(req) ?? 0) > 1 && (
                            <Link to={`/posts?q=${encodeURIComponent(req)}`}
                              title={`${corpusCounts.get(req)} posts in the archive contain this`}
                              className="font-bold opacity-60 hover:opacity-100">×{corpusCounts.get(req)}</Link>
                          )}
                          {CAN_EDIT && <button onClick={() => requestBulkAddRequest(req)} disabled={bulkBusy}
                            title={`Admin: add this request to every post containing "${req}"`}
                            className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-white transition-all leading-none disabled:opacity-40">
                            {adminUnlocked ? '⇉ add all' : '🔒 all'}
                          </button>}
                          {adminUnlocked && (
                            <button onClick={() => handleRemoveRequest(req)}
                              className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-red-300 transition-all leading-none">✕</button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Analysis categories */}
                {CATS.map(({ key, label, color, chip }) => {
                  const items = (postAnalysis?.[key] as string[] | undefined) ?? []
                  // An empty category is a row of dead space on the reading view — most drops
                  // carry three or four of the nine. Hidden where nothing can be added anyway;
                  // kept in the editing build, because the empty row IS how the first item gets
                  // added to a category and hiding it would make that unreachable.
                  if (!items.length && !CAN_EDIT) return null
                  return (
                    <div key={key} data-analysis-section={key}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium w-32 shrink-0 ${color}`}>{label}</span>
                        <AddRow rowKey={key} />
                      </div>
                      {items.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-0">
                          {items.map((item, i) => {
                            const freqData = analysisFreqMap.get(`${key}::${normalizeItemKey(item)}`)
                            const corpusN = corpusCounts.get(item) ?? 0
                            const aliases = getAliasesFor(item)
                            const aliasId = `${key}::${item}`
                            return (
                              <React.Fragment key={i}>
                              <span className={`text-xs border px-2 py-0.5 rounded flex items-center gap-1 group ${chip}`}>
                                {/* Click the phrase to open every post containing it. */}
                                <Link
                                  to={`/posts?q=${encodeURIComponent(item)}`}
                                  title={`Show all posts containing "${item}"`}
                                  className="hover:underline decoration-dotted underline-offset-2"
                                >
                                  {item}
                                </Link>
                                {corpusN > 1 && (
                                  <Link
                                    to={`/posts?q=${encodeURIComponent(item)}`}
                                    title={`${corpusN} posts in the archive contain "${item}"${freqData && freqData.count > 1 ? ` — ${freqData.count} of them classify it here` : ''} — click to see them`}
                                    className="font-bold opacity-60 hover:opacity-100"
                                  >×{corpusN}</Link>
                                )}
                                {aliases.length > 0 && (
                                  <span className="opacity-75 text-[10px] italic">
                                    also: {aliases.map((al, j) => (
                                      <span key={al} className="not-italic">
                                        {j > 0 && ', '}{al}
                                        {adminUnlocked && (
                                          <button onClick={() => removeAlias(item, al)} title={`Remove alias "${al}"`}
                                            className="ml-0.5 hover:text-red-300">×</button>
                                        )}
                                      </span>
                                    ))}
                                  </span>
                                )}
                                {adminUnlocked && (
                                  <button onClick={() => { const open = aliasFor === aliasId; setAliasFor(open ? null : aliasId); setAliasInput(open ? '' : selectedText) }}
                                    title="Highlight a word in the post, then click to drop it in — adds an alternate spelling that also highlights under this name"
                                    className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-white transition-all leading-none">{selectedText ? '📋 🔤 alias' : '🔤 alias'}</button>
                                )}
                                {CAN_EDIT && <button
                                  onClick={() => requestBulkClassify(key, item)}
                                  disabled={bulkBusy}
                                  title={`Admin: classify every post containing "${item}" as ${label}`}
                                  className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-white transition-all leading-none disabled:opacity-40">
                                  {adminUnlocked ? '⇉ apply all' : '🔒 all'}
                                </button>}
                                {adminUnlocked && (
                                  <button onClick={() => handleRemoveAnalysisItem(key, item)}
                                    className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-red-300 transition-all leading-none">✕</button>
                                )}
                              </span>
                              {aliasFor === aliasId && (
                                <form className="inline-flex items-center gap-1"
                                  onSubmit={e => { e.preventDefault(); const v = aliasInput.trim(); if (v) { addAlias(item, v); } setAliasInput(''); setAliasFor(null) }}>
                                  <input autoFocus value={aliasInput} onChange={e => setAliasInput(e.target.value)}
                                    list="known-entities"
                                    placeholder={`alt spelling / known name (e.g. HRC)`}
                                    className="bg-gray-800 border border-cyan-700 rounded px-2 py-0.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 w-52" />
                                  <datalist id="known-entities">
                                    {knownEntities.map(e => <option key={e} value={e} />)}
                                  </datalist>
                                  <button type="submit" className="text-xs bg-cyan-800 hover:bg-cyan-700 text-white px-2 py-0.5 rounded">Add</button>
                                  <button type="button" onClick={() => { setAliasFor(null); setAliasInput('') }} className="text-xs text-gray-500 hover:text-white px-1">✕</button>
                                </form>
                              )}
                              </React.Fragment>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Brackets — same rule as every other category: an empty row is dead space on
                    the reading view. Kept in the editing build, where the empty row is how a
                    missed bracket gets added. */}
                {(allBrackets.length > 0 || CAN_EDIT) && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium w-32 shrink-0 text-red-500">[ Brackets ]</span>
                      <AddRow rowKey="brackets" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {allBrackets.map((code, i) => (
                        <span key={i} className="text-xs border border-red-700/50 bg-red-900/20 text-red-300 px-2 py-0.5 rounded flex items-center gap-1 group font-mono">
                          {/* Clickable, like every other analysis chip: searching the archive for
                              the span shows every other drop it appears in — or none, which is an
                              answer too. Brackets were the only section whose chips were dead
                              text, so a reader could see [+family (follow)] and had no way to ask
                              whether Q ever wrote it again. */}
                          <Link to={`/posts?q=${encodeURIComponent(code)}`}
                            title={`Show all posts containing "${code}"`}
                            className="hover:underline decoration-dotted underline-offset-2">{code}</Link>
                          {(corpusCounts.get(code) ?? 0) > 1 && (
                            <Link to={`/posts?q=${encodeURIComponent(code)}`}
                              title={`${corpusCounts.get(code)} posts in the archive contain "${code}"`}
                              className="font-bold opacity-60 hover:opacity-100">×{corpusCounts.get(code)}</Link>
                          )}
                          {CAN_EDIT && <button onClick={() => requestBulkAddBracket(code)} disabled={bulkBusy}
                            title={`Admin: add this bracket to every post containing "${code}"`}
                            className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-white transition-all leading-none disabled:opacity-40">
                            {adminUnlocked ? '⇉ add all' : '🔒 all'}
                          </button>}
                          {CAN_EDIT && <button onClick={() => handleExcludeBracket(code)}
                            className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-red-100 transition-all leading-none">✕</button>}
                        </span>
                      ))}
                      {excludedBrackets.length > 0 && (
                        <details className="w-full mt-1">
                          <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 list-none">
                            {excludedBrackets.length} excluded — click to restore
                          </summary>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {excludedBrackets.map((code, i) => (
                              <span key={i} className="text-xs border border-gray-700 bg-gray-800 text-gray-500 px-2 py-0.5 rounded flex items-center gap-1 font-mono line-through">
                                {code}
                                {CAN_EDIT && <button onClick={() => handleRestoreBracket(code)}
                                  className="text-[10px] text-gray-500 hover:text-lime-400 transition-colors no-underline leading-none">↩</button>}
                              </span>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Detected questions — the classification workbench (statuses, add/remove). Readers
          get the same questions in Post Analysis below, so this is editing-build only. */}
      {CAN_EDIT && (
      <div className="bg-q-panel border border-q-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Detected</h2>
          {CAN_EDIT && (
          <div className="flex gap-2">
            {!selectMode && (
              <button
                onClick={enterSelectMode}
                className="text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-blue-500 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                + Add Question Found
              </button>
            )}
            {questions.length > 0 && questions.some(q => q.status === 'unprocessed') && (
              <button
                onClick={handleClassify}
                disabled={classifying}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {classifying ? 'Classifying…' : '🟢 Classify Status'}
              </button>
            )}
            <button
              onClick={handleDetectRequests}
              disabled={detectingRequests}
              className="text-xs bg-green-800 hover:bg-green-700 text-green-100 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {detectingRequests ? 'Detecting…' : '🟢 Detect Requests'}
            </button>
            <button
              onClick={handleDetectQuestions}
              disabled={processing}
              className="text-xs bg-gray-600 hover:bg-gray-500 text-white font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {processing ? 'Detecting…' : '🔍 Detect Questions'}
            </button>
            <button
              onClick={() => requireAdmin('analyze this post with AI', handleAnalyzePost)}
              disabled={analyzingPost}
              title={adminUnlocked ? '' : 'Admin PIN required'}
              className="text-xs bg-violet-800 hover:bg-violet-700 text-violet-100 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {analyzingPost ? 'Analyzing…' : adminUnlocked ? '🔬 Analyze Post' : '🔒 Analyze Post'}
            </button>
          </div>
          )}
        </div>

        {detectError && (
          <p className="text-red-400 text-sm mb-3 bg-red-900/20 border border-red-800 rounded-lg p-3">{detectError}</p>
        )}

        {questions.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {CAN_EDIT
              ? 'No questions extracted yet. Click "Detect Questions" to run AI analysis.'
              : 'No questions have been extracted from this post yet.'}
          </p>
        ) : (
          <div className="space-y-2">
            {questions.map(q => {
              const normQ = (t: string) => t.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')
              const isActive = !!activeHL && normQ(q.text) === normQ(activeHL)
              const isAlsoRequest = (actionRequests ?? []).some(r => r.toLowerCase().trim() === q.text.toLowerCase().trim())
              const highlightClass = isAlsoRequest && q.text.trim().endsWith('?')
                ? 'animate-req-question'
                : isAlsoRequest
                ? 'bg-green-500/35 text-green-200'
                : 'bg-blue-500/30 text-blue-200'
              return (
                <div
                  key={q.id}
                  ref={isActive && !!highlight ? highlightRef : null}
                  onClick={() => { setLocalHighlight(q.text); setNewQuestionIds(new Set()) }}
                  title="Click to locate in post"
                  className={`group/row flex items-start gap-2 rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-green-900/30 border border-green-600 p-2 -mx-2 shadow-[0_0_12px_rgba(34,197,94,0.25)]'
                      : 'hover:bg-white/5 p-2 -mx-2'
                  }`}
                >
                  <QuestionBadge status={q.status} text={q.text} highlightClass={highlightClass} />
                  {(() => {
                    const freqData = freqMap.get(normQ(q.text))
                    if (!freqData || freqData.count < 2) return null
                    const isOpen = activeFreqQ === q.id
                    return (
                      <div className="relative shrink-0 mt-2">
                        <button
                          onClick={e => { e.stopPropagation(); setActiveFreqQ(isOpen ? null : q.id) }}
                          title={`Asked in ${freqData.count} posts — click to view all`}
                          className="text-xs bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 px-1.5 py-0.5 rounded font-medium hover:bg-indigo-800/70 hover:border-indigo-500 hover:text-indigo-200 transition-colors"
                        >
                          ×{freqData.count}
                        </button>
                        {isOpen && (
                          <div className="absolute left-0 top-full mt-1.5 z-20 bg-gray-900 border border-indigo-700/60 rounded-lg p-3 shadow-2xl min-w-[180px] max-w-[280px]">
                            <p className="text-xs text-indigo-300 font-semibold mb-2">Asked in {freqData.count} posts:</p>
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                              {[...freqData.postNums].sort((a, b) => a - b).map(num => (
                                <Link
                                  key={num}
                                  to={`/post/${num}`}
                                  onClick={e => e.stopPropagation()}
                                  className="text-xs px-2 py-1 bg-gray-800 hover:bg-indigo-900/60 text-gray-300 hover:text-indigo-300 border border-gray-700 hover:border-indigo-600 rounded transition-colors font-mono"
                                >
                                  #{num}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {CAN_EDIT && <button
                    onClick={e => { e.stopPropagation(); handleRemoveQuestion(q.id) }}
                    title="Delete — not a question"
                    className="ml-auto shrink-0 mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 hover:bg-red-900/30 border border-transparent hover:border-red-800/60 px-2 py-1 rounded transition-all"
                  >
                    🗑 Delete
                  </button>}
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}

      {/* Thread Replies panel (4chan / 8chan / 8kun) */}
      {post.threadScanned && (
        <div className="bg-q-panel border border-orange-800/40 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔗</span>
            <h2 className="font-semibold text-white text-sm">Thread Replies</h2>
            {post.threadReplyCount !== undefined && (
              <span className="text-xs text-gray-500 ml-1">
                {post.threadReplyCount} anon {post.threadReplyCount === 1 ? 'reply' : 'replies'}
              </span>
            )}
            {(post.qThreadReplies?.length ?? 0) > 0 && (
              <span className="text-xs text-yellow-400 font-medium ml-1">
                · 🔐 {post.qThreadReplies!.length} Q {post.qThreadReplies!.length === 1 ? 'reply' : 'replies'} in thread
              </span>
            )}
            {post.link && (
              <a href={post.link} target="_blank" rel="noreferrer"
                className="ml-auto text-xs text-orange-400 hover:text-orange-200 underline">
                View thread ↗
              </a>
            )}
          </div>

          {/* Q's own follow-up posts in the thread */}
          {(post.qThreadReplies?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-yellow-400 font-medium">🔐 Q posted again in this thread:</p>
              {post.qThreadReplies!.map((r, i) => (
                <div key={i} className="bg-yellow-900/10 border border-yellow-700/30 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-yellow-300 text-xs bg-yellow-900/20 border border-yellow-700/30 px-1.5 py-0.5 rounded">{r.trip}</span>
                    <span className="text-xs text-gray-600">Reply #{r.no}</span>
                  </div>
                  <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap">{r.text.slice(0, 400)}{r.text.length > 400 ? '…' : ''}</p>
                </div>
              ))}
            </div>
          )}

          {/* Anon answers to Q's questions */}
          {!post.threadAnswers || post.threadAnswers.length === 0 ? (
            <p className="text-gray-500 text-xs">
              {post.threadReplyCount === 0
                ? 'No replies were found in this thread.'
                : 'No anon replies directly answered Q\'s questions in this thread.'}
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-green-400 font-medium">
                {post.threadAnswers.length} question{post.threadAnswers.length !== 1 ? 's' : ''} answered by anons ↓
              </p>
              {post.threadAnswers.map((a, i) => (
                <div key={i} className="bg-gray-900/60 border border-gray-700/50 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs text-blue-300 font-medium">Q asked: "{a.question}"</p>
                  <p className="text-xs text-gray-300">"{a.excerpt}"</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      a.confidence === 'high' ? 'bg-green-900/50 text-green-400 border border-green-700/50' :
                      a.confidence === 'medium' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50' :
                      'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}>
                      {a.confidence} confidence
                    </span>
                    <span className="text-xs text-gray-600">Reply #{a.replyNo}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom of the post — where a reader actually notices something is wrong.
          Feeds the same feedback inbox as the Comments & Ideas page, tagged with this
          post number. Shown in the public build too; reporting is the point. */}
      <FlagIssue postNum={post.postNum} />
    </div>
  )
}
