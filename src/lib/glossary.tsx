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
import { cloneElement, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'

export interface GlossEntry {
  meaning: string
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

function InfoBox({ entry, token, anchor }: { entry: GlossEntry; token: string; anchor: HTMLElement | null }) {
  const boxRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // POSITION AGAINST THE VIEWPORT, NOT THE PARAGRAPH.
  //
  // Centred-above-the-token is correct only in the middle of the screen. An acronym near the right
  // edge — and Q's drops are full of them — pushed half the box past the window, and one at the
  // top of the viewport opened upward into nothing. The owner's report: "it is mostly off screen
  // so i cant read what it is."
  //
  // `fixed` rather than absolute, because the post body is inside a <pre> with its own overflow;
  // an absolutely-positioned box is clipped by that ancestor no matter how it is offset.
  useLayoutEffect(() => {
    const a = anchor?.getBoundingClientRect()
    const b = boxRef.current?.getBoundingClientRect()
    if (!a || !b) return
    const M = 8
    const left = Math.max(M, Math.min(a.left + a.width / 2 - b.width / 2, window.innerWidth - b.width - M))
    // Above by preference; below when there is no room, which is the whole top of the page.
    const wanted = a.top - b.height - 6 >= M ? a.top - b.height - 6 : a.bottom + 6
    // CLAMP UNCONDITIONALLY. Preferring "above" still overflowed when the anchor itself sits
    // below the fold — the branch was chosen from the anchor's position and then trusted. Six of
    // twenty-one cases failed this way. Neither branch is allowed to leave the viewport.
    const top = Math.max(M, Math.min(wanted, window.innerHeight - b.height - M))
    setPos({ left, top })
  }, [anchor, entry])

  return (
    <span ref={boxRef}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
      className="pointer-events-none fixed z-50 w-max max-w-[min(20rem,calc(100vw-1rem))]
                 rounded border border-q-border bg-[#11151c] px-2.5 py-2 text-left shadow-xl">
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
          entities as well as glosses: a typo reading needs explaining precisely because the
          canonical name alone would look like a mistake. */}
      {entry.detail && <span className="mt-1 block text-[11px] leading-snug text-amber-200/70">{entry.detail}</span>}
    </span>
  )
}

/**
 * Hover on a pointer, tap on touch. `title` is deliberately NOT used: it never appears on touch,
 * and the owner asked for press as well as hover.
 */
export function TermInfo({ token, entry, children }: { token: string; entry: GlossEntry; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // A tapped box has to be dismissible without a second precise tap on the same two letters, and
  // a fixed box has to close when the page moves under it.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Escape') close() })
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>
      {children}
      {open && <InfoBox entry={entry} token={token} anchor={ref.current} />}
    </span>
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
        <TermInfo key={`${keyPrefix}-${j}`} token={head} entry={entry}>
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
      if (whole) return <TermInfo key={keyPrefix} token={kids.trim()} entry={whole}>{node}</TermInfo>
    }
    if (kids === undefined || kids === null) return node
    const inner = walk(kids, `${keyPrefix}k`, true, depth - 1)
    return inner === kids ? node : cloneElement(el, {}, inner)
  }

  return nodes.map((node, i) => walk(node, `g${i}`, false, 6))
}
