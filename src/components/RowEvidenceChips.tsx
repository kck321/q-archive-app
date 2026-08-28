import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadRowEvidence, evidenceForRow, type EvidenceChip } from '../lib/rowEvidence'

// Supporting evidence for an analysis row: the pictures and links tied to its subject, merged
// into the same chip row as the certified post numbers rather than shown as separate blocks
// underneath — owner ruling, 2026-08-27: three stacked groups per row took up too much space.
//
// `#1254` is a drop in which Q wrote the term; `Pic #1254` is a photograph in that drop showing
// the subject. They still read as different KINDS of evidence — distinct icon, color and
// dimming for an associated (not direct) match — they are just interleaved by post number
// instead of stacked in their own rows. Nothing here touches the certified count above the row:
// merging the chips visually does not merge what they assert.

export interface RowChip {
  num: number
  node: ReactNode
}

/**
 * Evidence chips (pictures + links) for one row, as `{ num, node }` pairs ready to merge with a
 * caller's own certified-post chips and sort together by post number. Returns `[]` until the
 * picture/link indexes finish loading, same as the old component did while `!ready`.
 */
export function useEvidenceChips(term: string, certifiedPosts: number[] | Set<number>, linkParams = ''): RowChip[] {
  const [ready, setReady] = useState(false)
  useEffect(() => { let live = true; loadRowEvidence().then(() => { if (live) setReady(true) }); return () => { live = false } }, [])
  if (!ready || !term) return []
  const { pics, urls } = evidenceForRow(term, certifiedPosts)
  const toChip = (c: EvidenceChip, focus: 'pic' | 'url', icon: string, tone: string): RowChip => ({
    num: c.postNum,
    node: (
      <Link
        key={`${focus}-${c.postNum}`}
        to={`/post/${c.postNum}?flash=1&highlight=${encodeURIComponent(term)}${linkParams}&focus=${focus}`}
        title={c.reason}
        className={`text-xs px-1.5 py-0.5 rounded border font-mono transition-colors ${tone} ${c.direct ? '' : 'opacity-60'}`}
      >
        {icon}{focus === 'pic' ? 'Pic' : 'URL'} #{c.postNum}{c.count > 1 ? ` ×${c.count}` : ''}
      </Link>
    ),
  })
  return [
    ...pics.map(c => toChip(c, 'pic', '📷', 'bg-teal-900/40 border-teal-700/50 text-teal-200 hover:border-teal-400')),
    ...urls.map(c => toChip(c, 'url', '🔗', 'bg-blue-900/40 border-blue-700/50 text-blue-200 hover:border-blue-400')),
  ]
}

/**
 * Merge a caller's own certified-post chips with this row's evidence chips and sort the whole
 * thing oldest → newest by post number. `Array.prototype.sort` is stable, so chips that share a
 * post number keep the order they were given in — post chip, then picture, then link — rather
 * than shuffling on every render.
 */
export function mergeRowChips(certifiedChips: RowChip[], evidenceChips: RowChip[]): RowChip[] {
  return [...certifiedChips, ...evidenceChips].sort((a, b) => a.num - b.num)
}

/**
 * The chips a row actually renders, with the collapsed cap applied SELECTIVELY.
 *
 * A plain `merged.slice(0, cap)` let a large evidence set crowd the certified chips out of the
 * collapsed view entirely — found 2026-08-28 by the entity-reconciliation gate: a rank-132 entity
 * with 14 mentions rendered forty 📷/🔗 chips and not one `#N` post chip, because every one of
 * its evidence chips carried a lower post number than its first certified mention. The certified
 * chips are what the row is ABOUT — the posts where Q actually wrote the term — so they are
 * guaranteed the cap first and evidence fills whatever room remains (earliest first). Display
 * order is untouched: the survivors still render merged, oldest → newest; only WHICH chips make
 * the collapsed cut changes. Expanding shows everything, exactly as before.
 */
// How many collapsed slots evidence keeps when certified chips alone could fill the cap. Small
// on purpose: the certified chips are the row's subject, the reserve just keeps the 📷/🔗 kind
// DISCOVERABLE — without it a 66-mention theme hid its evidence entirely and the row-evidence
// gate failed, the mirror image of the crowd-out this function exists to prevent.
const EVIDENCE_RESERVE = 6

export function visibleRowChips(
  certifiedChips: RowChip[], evidenceChips: RowChip[], cap: number, expanded: boolean,
): { shown: RowChip[]; merged: RowChip[] } {
  const merged = mergeRowChips(certifiedChips, evidenceChips)
  if (expanded || merged.length <= cap) return { shown: merged, merged }
  const evByNum = [...evidenceChips].sort((a, b) => a.num - b.num)
  const evQuota = Math.min(evByNum.length, EVIDENCE_RESERVE)
  const chosen = new Set<RowChip>(certifiedChips.slice(0, Math.max(0, cap - evQuota)))
  for (const c of evByNum) { if (chosen.size >= cap) break; chosen.add(c) }
  // Evidence ran out before the cap? The leftover slots go back to certified chips.
  if (chosen.size < cap) for (const c of certifiedChips) { if (chosen.size >= cap) break; chosen.add(c) }
  return { shown: merged.filter(c => chosen.has(c)), merged }
}
