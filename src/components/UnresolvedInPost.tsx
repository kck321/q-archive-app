import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadQueue, resolveLinkFor, type QueueItem } from '../lib/resolution'

/**
 * "Help resolve this" — the unresolved references inside one drop.
 *
 * Each link goes to the EXACT occurrence in the Resolution Center, not the top of the queue.
 * A reader who notices that "BO" plainly means the Board Owner in the drop in front of them
 * should be one click from saying so about that occurrence, and only that occurrence.
 *
 * Renders nothing when a drop has no unresolved references, which is most of them.
 */
export default function UnresolvedInPost({ postNum }: { postNum: number }) {
  const [items, setItems] = useState<QueueItem[]>([])

  useEffect(() => {
    let alive = true
    loadQueue()
      .then(q => { if (alive) setItems(q.rows.filter(r => r.postNum === postNum)) })
      .catch(() => { /* the queue is optional context; never block the post on it */ })
    return () => { alive = false }
  }, [postNum])

  if (!items.length) return null

  return (
    <div className="mt-4 rounded-lg border border-amber-700/30 bg-amber-500/5 p-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xs font-semibold text-amber-300">Unresolved references in this drop</span>
        <span className="text-[11px] text-gray-500">{items.length}</span>
      </div>
      <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
        These could not be identified with confidence from the surrounding text, so they were left
        unresolved rather than guessed. If this drop makes one of them clear, you can say so.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map(i => (
          <Link
            key={i.id}
            to={resolveLinkFor(i.id)}
            title={i.whyUnresolved}
            className="text-xs px-2 py-1 rounded border border-amber-600/40 text-amber-200 hover:bg-amber-500/10 font-mono"
          >
            {i.token} <span className="opacity-60 font-sans">— help resolve</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
