// The entity hover synopses — Stage 2 of the hover audit.
//
// TWO LAYERS, DELIBERATELY SEPARATE.
//   global    what this entity is, wherever it appears
//   byPost    how THIS drop uses the label, and what in the drop supports that reading
//
// They answer different questions, so they are stored apart and shown apart. A reader looking at
// #534 needs to know that NYC is New York City AND that this particular drop uses the abbreviated
// form, which needs the surrounding passage to confirm it. Collapsing the two would lose the
// second half — which is the half that is honest about how much the drop actually establishes.
//
// KEYED BY PERMANENT ID + POST NUMBER. Never by display name, alias, slug or the audit's ENT
// number: a name changes when it is corrected, a slug follows the name, and the ENT numbers are
// positional. The id is the only handle that survives a rename, a merge or a recount.
import { useEffect, useState } from 'react'

/** Support grade for a post-specific reading. Shown to the reader — a Partial identification
 *  must never look like a settled one. */
export type SupportGrade = 'Strong' | 'Partial' | 'Insufficient'

export interface PostHover {
  /** The post-specific synopsis. */
  s: string
  /** The alias as Q wrote it in this drop. */
  a: string
  /** What the label is doing here: question, claim, prediction, directive, source or link… */
  r: string
  /** Support grade. */
  g: SupportGrade
  /** Evidence confidence. */
  c: string
}

export interface EntityHovers {
  global: Record<string, string>
  byPost: Record<string, Record<string, PostHover>>
  totals?: Record<string, number>
}

const EMPTY: EntityHovers = { global: {}, byPost: {} }

let _cache: EntityHovers | null = null
let _inflight: Promise<EntityHovers> | null = null

export async function loadEntityHovers(): Promise<EntityHovers> {
  if (_cache) return _cache
  _inflight ??= (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/entity-hovers.json`)
      _cache = res.ok ? await res.json() : EMPTY
    } catch { _cache = EMPTY }
    return _cache!
  })().finally(() => { _inflight = null })
  return _inflight
}

/** Synchronous view for renderers that cannot await. Empty until the load resolves. */
export function entityHoversSync(): EntityHovers { return _cache ?? EMPTY }

export function useEntityHovers(): EntityHovers {
  const [h, setH] = useState<EntityHovers>(() => entityHoversSync())
  useEffect(() => { let live = true; loadEntityHovers().then(x => { if (live) setH(x) }); return () => { live = false } }, [])
  return h
}

/** The post-specific reading, or null. Both arguments are required — there is no "this entity,
 *  generally" answer at this layer, and defaulting to one would be the collapse this avoids. */
export function postHoverFor(hovers: EntityHovers, entityId: string | undefined, postNum: number): PostHover | null {
  if (!entityId) return null
  return hovers.byPost?.[entityId]?.[String(postNum)] ?? null
}

export function globalHoverFor(hovers: EntityHovers, entityId: string | undefined): string | null {
  if (!entityId) return null
  return hovers.global?.[entityId] ?? null
}

/** How the grade reads to someone who has not been told what the grades are. */
export const GRADE_LABEL: Record<SupportGrade, string> = {
  Strong: 'Strongly supported by this drop',
  Partial: 'Partly supported — the abbreviated form needs the surrounding passage',
  Insufficient: 'Not established by this drop',
}

export const GRADE_STYLE: Record<SupportGrade, string> = {
  Strong: 'text-emerald-300/80',
  Partial: 'text-amber-300/80',
  Insufficient: 'text-gray-400',
}
