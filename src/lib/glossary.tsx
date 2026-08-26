// THE READER'S INFO BOX. "Who or what am I looking at?"
//
// Owner ask: "all the acronyms and initialed names to have an info box if you hover over it or
// press it so the reader knows who he or she is looking at app wide on any post."
//
// POST-AWARE, because that is the only version that tells the truth. BO is Barack Obama in #36,
// Bruce Ohr in #1828 and the Board Owner in #1296. RT is Rex Tillerson in #947 and "real time" in
// #220. A corpus-wide token->meaning map would confidently mislabel most of those drops — the
// same global-alias mistake the entity audit spent three passes avoiding, one layer up.
//
// Two populations, one box:
//   entity     a certified entity — shows canonical name, type and total mentions
//   notation   owner-glossed shorthand that is NOT an entity ("real time"), so it is styled as a
//              dotted underline and never as a certified category colour
//
// READ-ONLY. Nothing here mutates certified data; the box has no controls.
import { cloneElement, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { HoverCard } from '../components/HoverCard'
import { entityHoversSync, loadEntityHovers, postHoverFor, globalHoverFor, GRADE_LABEL, GRADE_STYLE, type SupportGrade } from './entityHovers'
import { segmentGloss, multiWordTokens } from './glossSegments'
import { occurrenceId, planSplitOccurrences } from './glossOccurrence'

export interface GlossEntry {
  meaning: string
  /** The permanent qe- id. Present on entity readings; this is what the post-specific synopsis
   *  is keyed by, so the box never looks anything up by display name. */
  entityId?: string
  kind: 'entity' | 'notation'
  type?: string
  detail?: string
  /** Note that applies only in specific drops, keyed by post number. */
  detailByPost?: Record<string, string>
  mentions?: number
  scoped?: boolean
  posts: number[]
}

let _cache: Record<string, GlossEntry[]> | null = null
let _inflight: Promise<Record<string, GlossEntry[]>> | null = null

export async function loadGlossary(): Promise<Record<string, GlossEntry[]>> {
  if (_cache) return _cache
  // The post-specific synopses ride along with the glossary. ONE insertion point: every surface
  // that shows an info box already loads the glossary, so pairing them here is what keeps the two
  // halves of the box from arriving separately — and a card that renders its general half while
  // the specific half is still in flight reads as though the drop had nothing to say.
  void loadEntityHovers()
  _inflight ??= (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/glossary.json`)
      _cache = res.ok ? (await res.json()).tokens ?? {} : {}
    } catch { _cache = {} }
    return _cache!
  })().finally(() => { _inflight = null })
  return _inflight
}

/** Synchronous view, for renderers that cannot await. Empty until loadGlossary resolves. */
export function glossarySync(): Record<string, GlossEntry[]> { return _cache ?? {} }

/** Loads once per app, and re-renders the caller when it lands. */
export function useGlossary(): Record<string, GlossEntry[]> {
  const [g, setG] = useState<Record<string, GlossEntry[]>>(() => glossarySync())
  useEffect(() => { let live = true; loadGlossary().then(x => { if (live) setG(x) }); return () => { live = false } }, [])
  return g
}

// CASE-INSENSITIVE FALLBACK FOR THE EXACT-KEY LOOKUP BELOW.
//
// The token map is keyed by whichever single spelling case-folding kept — "HUSSEIN" (65
// occurrences) folds into "Hussein" (95) because the renderer's own matching is case-insensitive,
// so having both as separate tokens would leave one of them permanently unmatched anyway (see
// build-glossary.mjs). But the LITERAL text a reader hovers is whatever Q actually wrote at that
// spot, which is "HUSSEIN" on plenty of drops — and a bare `gloss[token]` object lookup is
// case-SENSITIVE, so every all-caps occurrence of a mixed-case-keyed token silently matched
// nothing. Surfaced by the 2026-08-26 broadening: full names fold by case far more than the
// original ~400 acronym tokens ever did (158 folds against 1), so this had to actually be fixed
// rather than continuing to work by accident.
//
// Memoized per `gloss` object (a new object only arrives when the glossary reloads), so this is
// one pass over the keys per session rather than one per hover.
const lowerIndexCache = new WeakMap<object, Map<string, string>>()
function lowerIndex(gloss: Record<string, GlossEntry[]>): Map<string, string> {
  let idx = lowerIndexCache.get(gloss)
  if (idx) return idx
  idx = new Map()
  for (const key of Object.keys(gloss)) {
    const k = key.toLowerCase()
    // First (i.e. any) mapping wins — this is a fallback for when the exact key misses, not a
    // second source of truth, so a collision here just means the exact-case path already had it.
    if (!idx.has(k)) idx.set(k, key)
  }
  lowerIndexCache.set(gloss, idx)
  return idx
}

/**
 * The reading that applies IN THIS DROP.
 *
 * A token with one reading resolves everywhere it appears. A token with competing readings
 * resolves only where a scope claims this post — never by guessing the most common one, because
 * "most common" is exactly how Bruce Ohr becomes Barack Obama.
 */
export function glossFor(token: string, postNum: number, gloss = glossarySync()): GlossEntry | null {
  const entries = gloss[token] ?? gloss[lowerIndex(gloss).get(token.toLowerCase()) ?? '']
  if (!entries?.length) return null
  // A per-post note outranks the ruling-wide one: DAG is always the Deputy Attorney General, but
  // WHICH officeholder is meant changes drop by drop, and that is the part a reader needs here.
  const resolve = (e: GlossEntry): GlossEntry => {
    const specific = e.detailByPost?.[String(postNum)]
    return specific ? { ...e, detail: specific } : e
  }
  const here = entries.filter(e => e.posts.includes(postNum))
  if (here.length === 1) return resolve(here[0])
  // TWO READINGS IN ONE DROP. #1828 writes JB five times: four are John Brennan, and the one in
  // the FBI personnel list is James Baker. Saying nothing was the safe answer while the ruling
  // was post-level, but the owner ruled these per OCCURRENCE, so silence now hides a distinction
  // that was deliberately drawn. Name both, and carry each one's note — the box cannot tell which
  // occurrence is under the cursor, but the reader can.
  if (here.length > 1) {
    const parts = here.map(e => resolve(e))
    return {
      meaning: parts.map(p => p.meaning).join('  ·  '),
      kind: 'entity',
      type: `${parts.length} readings in this drop`,
      detail: parts.map(p => p.detail).filter(Boolean).join(' '),
      posts: [postNum],
    }
  }
  if (entries.length === 1 && !entries[0].scoped) return resolve(entries[0])
  return null
}

/**
 * The card body. TWO LAYERS, VISIBLY SEPARATE.
 *
 * The top half is what this entity is, anywhere in the archive. The bottom half is what THIS drop
 * does with the label and how much the drop actually establishes. Merging them would quietly drop
 * the second half — and the second half is the honest one: "NYC is New York City" is true
 * everywhere, while "this drop uses the abbreviated form, which needs the surrounding passage to
 * confirm it" is true only here, and is the part a researcher needs.
 */
function InfoCard({ entry, token, postNum }: { entry: GlossEntry; token: string; postNum: number }) {
  const post = postHoverFor(entityHoversSync(), entry.entityId, postNum)
  const grade = post?.g as SupportGrade | undefined
  // WHAT THIS ENTITY IS, ARCHIVE-WIDE — owner ruling, 2026-08-26.
  //
  // "i would like all our entity hover info synopsises to be uniform... if you hover over hussein
  // it doesn't have one listed... get the best synopsis like we have for ES that gives some
  // detail and context for that entity." entity-hovers.json's `global` layer was already built to
  // answer exactly this ("what this entity is, wherever it appears" — see entityHovers.ts) and
  // was already generated for every certified entity, but nothing in the app ever rendered it —
  // globalHoverFor() had no caller. What a reader actually saw here was the amber note below,
  // which only exists for the narrow case of an ambiguous token that needs a disambiguation
  // reason (ES has one because "ES" also reads as Edward Snowden elsewhere; Hussein has none
  // because it was never ambiguous, not because it lacks a synopsis) — so most entities showed
  // nothing at all. Every entity now gets this line; the amber note still follows for the
  // narrower case where THIS specific reading needs its own explanation.
  const synopsis = entry.kind === 'entity' ? globalHoverFor(entityHoversSync(), entry.entityId) : null
  return (
    <>
      <span className="block text-[11px] uppercase tracking-wide text-gray-500">
        {token} {entry.kind === 'entity' ? '·  entity' : '·  not an entity'}
      </span>
      <span className="mt-0.5 block text-sm font-medium text-gray-100">{entry.meaning}</span>
      {entry.kind === 'entity' && (
        <span className="mt-0.5 block text-[11px] text-gray-400">
          {entry.type}{typeof entry.mentions === 'number' ? ` · ${entry.mentions.toLocaleString()} mentions in the archive` : ''}
        </span>
      )}
      {synopsis && <span className="mt-1 block text-[11px] leading-snug text-gray-300">{synopsis}</span>}
      {/* Owner note for readers — e.g. SS in #1151 is written SS but read as SC. Shown for
          entities too: a typo reading needs explaining precisely because the canonical name
          alone would look like a mistake. */}
      {entry.detail && <span className="mt-1 block text-[11px] leading-snug text-amber-200/70">{entry.detail}</span>}

      {post && (
        <>
          <span className="mt-2 block border-t border-q-border/60 pt-1.5 text-[10px] uppercase tracking-wide text-gray-500">
            in this drop
          </span>
          <span className="mt-1 block text-[11px] leading-relaxed text-gray-300">{post.s}</span>
          {grade && (
            <span className={`mt-1 block text-[10px] ${GRADE_STYLE[grade] ?? 'text-gray-400'}`}>
              {GRADE_LABEL[grade] ?? grade}
            </span>
          )}
        </>
      )}
    </>
  )
}

/**
 * The reader's handle on a glossed token.
 *
 * Every interaction mode lives in HoverCard — hover, keyboard focus, tap, Escape, outside click,
 * and the ARIA wiring — so this file describes only WHAT to show. Brackets will reuse the same
 * primitive rather than growing a second implementation with a different set of gaps.
 */
export function TermInfo({ token, entry, postNum, children }: {
  token: string; entry: GlossEntry; postNum: number; children: ReactNode
}) {
  const post = postHoverFor(entityHoversSync(), entry.entityId, postNum)
  return (
    <HoverCard
      label={`${token} — ${entry.meaning}${post ? `, and how post #${postNum} uses it` : ''}`}
      card={<InfoCard entry={entry} token={token} postNum={postNum} />}
    >
      {children}
    </HoverCard>
  )
}

/**
 * The control for a term the annotation layer has cut into pieces.
 *
 * TWO READINGS CAN MEET ON ONE OCCURRENCE, AND ONE MUST NOT EAT THE OTHER. #2770 writes
 * "ABC NEWS". The entity layer certifies "ABC" and gives it a box; the glossary certifies the whole
 * phrase and gives it another. Those are different claims — "ABC" alone is scoped to three
 * different entities across the archive and reads as the CIA in two drops — so showing only the
 * inner one would silently answer a question the reader did not ask. Showing only the outer one
 * would delete a certified entity reading. The card carries both, in separately headed sections,
 * and the trigger names both.
 *
 * ONE control, whichever way the pieces fall: when a piece already carries a box (ABC, FOX, SCHIFF)
 * that box is extended rather than joined by a second, and when none does (SUPREME COURT,
 * CLINTON FOUNDATION, ROD ROSENSTEIN) exactly one is promoted. Never a button inside a button, and
 * never two tab stops for one phrase.
 */
function GlossOccurrenceAnchor({ occId, token, entry, inner, postNum, children }: {
  occId: string
  /** The multi-word glossary key — what this control stands for, whatever word it sits on. */
  token: string
  entry: GlossEntry
  /** The reading the segment already carried, when it carried one. */
  inner: { token: string; entry: GlossEntry } | null
  postNum: number
  children: ReactNode
}) {
  const post = postHoverFor(entityHoversSync(), entry.entityId, postNum)
  const tail = post ? `, and how post #${postNum} uses it` : ''
  // The accessible name is the whole point of the ruling made audible: a screen-reader user on the
  // word "ABC" must hear that the archive also reads the pair as ABC News, and on the word "SUPREME"
  // must hear the term is "SUPREME COURT" and not the single word under the cursor.
  const label = inner
    ? `${inner.token} — ${inner.entry.meaning}. Glossary reading in this post: ${token} — ${entry.meaning}${tail}`
    : `${token} — ${entry.meaning}${tail}`
  return (
    <HoverCard
      occurrenceId={occId}
      label={label}
      card={
        inner ? (
          <>
            <InfoCard entry={inner.entry} token={inner.token} postNum={postNum} />
            <span className="mt-2.5 block border-t-2 border-amber-400/40 pt-2 text-[10px] uppercase tracking-wide text-amber-300">
              Glossary reading in this post
            </span>
            <span className="mt-1.5 block">
              <InfoCard entry={entry} token={token} postNum={postNum} />
            </span>
          </>
        ) : (
          <InfoCard entry={entry} token={token} postNum={postNum} />
        )
      }
    >
      {children}
    </HoverCard>
  )
}

/**
 * The rendered text of a node, exactly as the reader will see it.
 *
 * The whole occurrence plan is character arithmetic over this, so it has to agree with the DOM
 * character for character — the project's standing lesson about asking questions of the text the
 * reader sees rather than the text we stored, one layer further in.
 */
function nodeText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return nodeText((node as ReactElement<{ children?: ReactNode }>).props?.children)
  }
  return ''
}

/**
 * Wrap already-rendered highlight nodes with info boxes.
 *
 * ONE insertion point per renderer instead of ten. Both PostDetail and postHighlight build the
 * same shape — an array of strings and single-string-child elements — so both get identical
 * behaviour from the same function, which is the only way these two surfaces have ever stayed in
 * agreement about anything.
 */
export function applyGlossary(nodes: ReactNode[], postNum: number, gloss: Record<string, GlossEntry[]>): ReactNode[] {
  if (!Object.keys(gloss).length) return nodes

  /**
   * Wrap every glossed token INSIDE a run of text.
   *
   * The first version only matched when a node's whole text was the token. That worked on
   * "DNI DIR>" — where DNI happens to be its own highlight span — and silently did nothing on
   * the other nine test drops, because an acronym normally sits inside a larger certified span:
   * "Monitored and analyzed in RT." is one Claim, painted as a single mark whose text is the
   * whole sentence. Matching the container's text can never find the token inside it.
   *
   * `underline` is off inside an existing highlight: the span already has a category colour, and
   * adding a second treatment would suggest a second classification. On plain text the dotted
   * underline is the only thing telling a reader there is anything to press.
   */
  const wrapSingles = (text: string, keyPrefix: string, underline: boolean): ReactNode => {
    const parts = text.split(/([A-Za-z0-9][A-Za-z0-9._+/-]*)/g)
    let touched = false
    const rebuilt = parts.flatMap((part, j) => {
      if (!/^[A-Za-z0-9]/.test(part)) return [part]
      // "U.S." is a real alias, so the token pattern has to allow interior and trailing periods —
      // which means it also swallows ordinary sentence punctuation: "RT." in "analyzed in RT."
      // came through as one token and matched nothing. Try the whole run first (U.S. wins), then
      // peel trailing punctuation off and gloss the head, leaving the tail as text.
      let head = part
      let entry = glossFor(head, postNum, gloss)
      while (!entry && head.length > 1 && !/[A-Za-z0-9]$/.test(head)) {
        head = head.slice(0, -1)
        entry = glossFor(head, postNum, gloss)
      }
      if (!entry) return [part]
      touched = true
      const tail = part.slice(head.length)
      return [
        <TermInfo key={`${keyPrefix}-${j}`} token={head} entry={entry} postNum={postNum}>
          {underline
            ? <span className="cursor-help underline decoration-dotted decoration-gray-500 underline-offset-2">{head}</span>
            : <span className="cursor-help">{head}</span>}
        </TermInfo>,
        tail,
      ]
    })
    return touched ? <span key={keyPrefix}>{rebuilt}</span> : text
  }

  /**
   * MULTI-WORD TERMS FIRST, then the single-word splitter on what is left.
   *
   * 19 glossed tokens contain a space, and the splitter above walks one word at a time — so a
   * two-word name could only ever be glossed where it happened to be its own certified highlight
   * span and the whole-node branch below caught it. In #2401 all three "WASH POST"s sit inside
   * larger Question marks, so neither path fired and the reader got no box on the one drop the box
   * was written for.
   *
   * The matching itself is NOT done here. It is a pure function over strings in glossSegments.ts,
   * proved by scripts/test-gloss-segments.mjs across all 19 tokens and all 4,966 drops — including
   * the property that concatenating the segments reproduces the input exactly, so no character can
   * be lost or moved by a matching bug. The first attempt at this fix lived in the JSX, fixed
   * #2401 and broke BO and CM in #1828, and each guess cost a 90-second browser run.
   *
   * The gaps between matches go through `wrapSingles` UNCHANGED. That is the whole safety argument:
   * a term that was glossed before is glossed by exactly the same code now, and the new path can
   * only ever add a box where there was none.
   */
  const multiTokens = multiWordTokens(gloss)
  const wrapInside = (text: string, keyPrefix: string, underline: boolean): ReactNode => {
    const segs = segmentGloss(text, multiTokens)
    if (segs.length === 1 && !segs[0].token) return wrapSingles(text, keyPrefix, underline)
    let touched = false
    const rebuilt = segs.map((seg, j) => {
      const entry = seg.token ? glossFor(seg.token, postNum, gloss) : null
      // No entry means this drop has no reading for the term — it is ordinary text, and the
      // single-word pass still gets its chance at whatever is inside it.
      if (!entry) return wrapSingles(seg.text, `${keyPrefix}-s${j}`, underline)
      touched = true
      return (
        <TermInfo key={`${keyPrefix}-s${j}`} token={seg.token!} entry={entry} postNum={postNum}>
          {underline
            ? <span className="cursor-help underline decoration-dotted decoration-gray-500 underline-offset-2">{seg.text}</span>
            : <span className="cursor-help">{seg.text}</span>}
        </TermInfo>
      )
    })
    return touched ? <span key={keyPrefix}>{rebuilt}</span> : wrapSingles(text, keyPrefix, underline)
  }

  /**
   * The reading a segment would have carried on its own — the "existing interactive control".
   *
   * Asked BEFORE anything is rendered, because the control does not exist yet: the box on "ABC" is
   * something this same function is about to create. Deciding afterwards would mean building a
   * button and then unbuilding it, and the two code paths would disagree the first time one of them
   * changed. The rules mirror the two that actually produce a control below — a whole node that is
   * itself a token, and a token found inside a run of text — so the answer here and the behaviour
   * there cannot drift apart.
   *
   * Single-word keys only. A multi-word key inside a multi-word occurrence cannot arise (the
   * matcher never overlaps two terms), and treating one as an "existing control" would nest the
   * very thing the ruling forbids.
   */
  const controlTokenIn = (text: string): { token: string; entry: GlossEntry } | null => {
    const whole = text.trim()
    if (whole && !/\s/.test(whole)) {
      const e = glossFor(whole, postNum, gloss)
      if (e) return { token: whole, entry: e }
    }
    for (const part of text.split(/([A-Za-z0-9][A-Za-z0-9._+/-]*)/g)) {
      if (!/^[A-Za-z0-9]/.test(part)) continue
      let head = part
      let entry = glossFor(head, postNum, gloss)
      while (!entry && head.length > 1 && !/[A-Za-z0-9]$/.test(head)) {
        head = head.slice(0, -1)
        entry = glossFor(head, postNum, gloss)
      }
      if (entry) return { token: head, entry }
    }
    return null
  }

  /** A segment of a split term that is NOT the control: marked, addressable, and not focusable. */
  const marker = (occId: string, content: ReactNode, key: string, underline: boolean): ReactNode => (
    <span key={key} data-gloss-occ={occId}
      className={underline
        ? 'cursor-help underline decoration-dotted decoration-gray-500 underline-offset-2'
        : 'cursor-help'}>
      {content}
    </span>
  )

  /**
   * Replace one character range inside a node, leaving everything else exactly as it was.
   *
   * The range is a half-open span of the node's RENDERED text, so this descends through whatever
   * structure is in the way and rebuilds only the elements on the path — every annotation keeps its
   * own tag, class and title, and no character moves. A fully covered node is handed to `primary`
   * whole, which is what keeps the box anchored to the certified `<mark>` instead of to a bare copy
   * of its text.
   *
   * `primary` is used at most once per node. When a range happens to straddle two children of the
   * same element, the remainder is marked but not made interactive — one occurrence, one control,
   * however deep the split goes.
   */
  const replaceRange = (
    node: ReactNode, from: number, to: number, occId: string,
    primary: (content: ReactNode, underline: boolean) => ReactNode,
    keyPrefix: string, inHighlight: boolean, depth: number,
  ): ReactNode => {
    let used = false
    const place = (content: ReactNode, key: string, underline: boolean): ReactNode => {
      if (used) return marker(occId, content, key, underline)
      used = true
      return primary(content, underline)
    }
    const cut = (n: ReactNode, f: number, t: number, key: string, inHl: boolean, d: number): ReactNode => {
      const len = nodeText(n).length
      if (f <= 0 && t >= len) return place(n, key, !inHl && typeof n === 'string')
      if (typeof n === 'string') {
        const head = n.slice(0, f)
        const tail = n.slice(t)
        return (
          <span key={key}>
            {head ? wrapInside(head, `${key}a`, !inHl) : null}
            {place(n.slice(f, t), `${key}m`, !inHl)}
            {tail ? wrapInside(tail, `${key}b`, !inHl) : null}
          </span>
        )
      }
      if (!n || typeof n !== 'object' || !('props' in n) || d <= 0) return n
      const el = n as ReactElement<{ children?: ReactNode }>
      const kids = el.props?.children
      if (kids === undefined || kids === null) return n
      const arr = Array.isArray(kids) ? kids : [kids]
      let acc = 0
      const next = arr.map((c, i) => {
        const l = nodeText(c).length
        const s = acc
        acc += l
        // Outside the range: ordinary glossing, unchanged. Inside it: no glossing, because the one
        // control for this occurrence has already been decided.
        if (t - s <= 0 || f - s >= l) return walk(c, `${key}c${i}`, true, d - 1)
        return cut(c, Math.max(0, f - s), Math.min(l, t - s), `${key}c${i}`, true, d - 1)
      })
      return cloneElement(el, {}, next)
    }
    return cut(node, from, to, keyPrefix, inHighlight, depth)
  }

  /**
   * A LIST OF SIBLINGS IS THE ONLY PLACE A SPLIT TERM IS VISIBLE.
   *
   * Every other layer here works on one node at a time, which is exactly why six terms had no box:
   * "SUPREME COURT" is three sibling `<mark>`s and no single node contains the phrase. The plan is
   * computed across the concatenation of the siblings and mapped back onto them — see
   * glossOccurrence.ts, which is pure and proved separately.
   *
   * The fallback is total. No plan, or no reading for the term in this drop, and every node goes
   * through the untouched path — so this can only ever add a box where there was none, which is the
   * same safety argument the multi-word text matcher was built on.
   */
  const walkList = (list: ReactNode[], keyPrefix: string, inHighlight: boolean, depth: number): ReactNode[] => {
    const plain = () => list.map((c, j) => walk(c, `${keyPrefix}-${j}`, inHighlight, depth))
    if (list.length < 2 || !multiTokens.length) return plain()

    const texts = list.map(nodeText)
    type Assigned = {
      occId: string; token: string; entry: GlossEntry
      start: number; end: number
      anchor: boolean; inner: { token: string; entry: GlossEntry } | null
    }
    const assign = new Map<number, Assigned>()

    for (const plan of planSplitOccurrences(texts, multiTokens)) {
      const entry = glossFor(plan.token, postNum, gloss)
      if (!entry) continue
      // Two occurrences sharing a node would need two identifiers on one segment. It cannot happen
      // with a non-overlapping matcher, and if it ever did, the honest outcome is the old
      // behaviour for that term rather than a segment that belongs to both.
      if (plan.parts.some(p => assign.has(p.index))) continue

      const occId = occurrenceId(postNum, plan.token, plan.ordinal)
      let anchorAt = 0
      let inner: { token: string; entry: GlossEntry } | null = null
      for (let k = 0; k < plan.parts.length; k++) {
        const p = plan.parts[k]
        const found = controlTokenIn(texts[p.index].slice(p.start, p.end))
        if (found) { anchorAt = k; inner = found; break }
      }
      plan.parts.forEach((p, k) => assign.set(p.index, {
        occId, token: plan.token, entry, start: p.start, end: p.end,
        anchor: k === anchorAt, inner: k === anchorAt ? inner : null,
      }))
    }
    if (!assign.size) return plain()

    return list.map((node, j) => {
      const a = assign.get(j)
      if (!a) return walk(node, `${keyPrefix}-${j}`, inHighlight, depth)
      const key = `${keyPrefix}-${j}`
      const primary = (content: ReactNode, underline: boolean): ReactNode => a.anchor
        ? (
          <GlossOccurrenceAnchor key={`${key}o`} occId={a.occId} token={a.token} entry={a.entry}
            inner={a.inner} postNum={postNum}>
            {typeof content === 'string'
              ? <span className={underline
                  ? 'cursor-help underline decoration-dotted decoration-gray-500 underline-offset-2'
                  : 'cursor-help'}>{content}</span>
              : content}
          </GlossOccurrenceAnchor>
        )
        : marker(a.occId, content, `${key}o`, underline)
      return replaceRange(node, a.start, a.end, a.occId, primary, key, inHighlight, depth)
    })
  }

  /**
   * RECURSE. A question in PostDetail is not a mark wrapping a string — it carries nested
   * structure (its own controls), so a one-level check saw a non-string child and gave up, and
   * "How often does POTUS RT weekly address?" got no box while the Claim one line above did.
   * Depth-limited because these trees are shallow by construction and a cycle would hang render.
   */
  const walk = (node: ReactNode, keyPrefix: string, inHighlight: boolean, depth: number): ReactNode => {
    if (typeof node === 'string') return wrapInside(node, keyPrefix, !inHighlight)
    if (Array.isArray(node)) return walkList(node, keyPrefix, inHighlight, depth)
    if (!node || typeof node !== 'object' || !('props' in node) || depth <= 0) return node

    const el = node as ReactElement<{ children?: ReactNode }>
    const kids = el.props?.children
    // Whole-node match: keep the painted element intact and wrap it, so the box anchors to the
    // highlight rather than to a nested copy of its text.
    if (typeof kids === 'string') {
      const whole = glossFor(kids.trim(), postNum, gloss)
      if (whole) return <TermInfo key={keyPrefix} token={kids.trim()} entry={whole} postNum={postNum}>{node}</TermInfo>
    }
    if (kids === undefined || kids === null) return node
    const inner = walk(kids, `${keyPrefix}k`, true, depth - 1)
    return inner === kids ? node : cloneElement(el, {}, inner)
  }

  return walkList(nodes, 'g', false, 6)
}
