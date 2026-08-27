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
