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
import { entityHoversSync, loadEntityHovers, postHoverFor, GRADE_LABEL, GRADE_STYLE, type SupportGrade } from './entityHovers'

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

/**
 * The reading that applies IN THIS DROP.
 *
 * A token with one reading resolves everywhere it appears. A token with competing readings
 * resolves only where a scope claims this post — never by guessing the most common one, because
 * "most common" is exactly how Bruce Ohr becomes Barack Obama.
 */
export function glossFor(token: string, postNum: number, gloss = glossarySync()): GlossEntry | null {
  const entries = gloss[token]
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
  const wrapInside = (text: string, keyPrefix: string, underline: boolean): ReactNode => {
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
   * RECURSE. A question in PostDetail is not a mark wrapping a string — it carries nested
   * structure (its own controls), so a one-level check saw a non-string child and gave up, and
   * "How often does POTUS RT weekly address?" got no box while the Claim one line above did.
   * Depth-limited because these trees are shallow by construction and a cycle would hang render.
   */
  const walk = (node: ReactNode, keyPrefix: string, inHighlight: boolean, depth: number): ReactNode => {
    if (typeof node === 'string') return wrapInside(node, keyPrefix, !inHighlight)
    if (Array.isArray(node)) return node.map((c, j) => walk(c, `${keyPrefix}-${j}`, inHighlight, depth))
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

  return nodes.map((node, i) => walk(node, `g${i}`, false, 6))
}
