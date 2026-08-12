import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { QPost, QuotedPost } from '../types'
import { mediaUrl } from '../lib/mediaUrl'

/**
 * The reply chain behind a drop's ">>NNNNNNN" pointers.
 *
 * Without this a reply reads as a bare pointer: drop #2124's entire body is ">>2950820",
 * and #1 — the very first drop — quotes an anon whose text we never stored. 52% of these
 * quote an anon, so they are styled apart from Q's own words. Anything more than one hop
 * upstream is folded away by default; it is context, not what the drop is about.
 */
export default function QuotedPosts({
  quoted,
  qDropFor,
}: {
  quoted: QuotedPost[]
  /** Maps a board post id to a Q drop, when the quoted post is itself one of ours. */
  qDropFor?: (boardId: string) => QPost | null
}) {
  const [showChain, setShowChain] = useState(false)
  if (!quoted?.length) return null

  const direct = quoted.filter(q => (q.depth ?? 0) === 0)
  const upstream = quoted.filter(q => (q.depth ?? 0) > 0)
  const shown = showChain ? [...direct, ...upstream] : direct

  return (
    <div className="mt-3 space-y-2">
      {shown.map((q, i) => {
        const depth = q.depth ?? 0
        const drop = qDropFor?.(q.boardId) ?? null
        const isQ = q.name === 'Q' || !!drop
        return (
          <div
            key={`${q.boardId}-${i}`}
            style={{ marginLeft: Math.min(depth, 3) * 16 }}
            className={`border-l-2 rounded-r-lg bg-black/25 ${isQ ? 'border-amber-600/70' : 'border-gray-600'}`}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pt-2 pb-1 text-[11px]">
              <span className="text-gray-500">{depth === 0 ? 'quoting' : 'which quotes'}</span>
              <span className={isQ ? 'font-semibold text-amber-400' : 'font-semibold text-emerald-400'}>
                {q.name || 'Anonymous'}
              </span>
              {q.trip && <span className="font-mono text-gray-500">{q.trip}</span>}
              {q.userId && <span className="font-mono text-gray-600">ID: {q.userId}</span>}
              {drop && (
                <Link
                  to={`/post/${drop.postNum}?flash=1`}
                  className="font-mono text-blue-400 hover:text-blue-300 hover:underline"
                >
                  #{drop.postNum}
                </Link>
              )}
              {q.time && <span className="text-gray-600">{q.time}</span>}
              {q.link ? (
                <a
                  href={q.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto font-mono text-gray-500 hover:text-gray-300 hover:underline"
                  title="View on the original board"
                >
                  &gt;&gt;{q.boardId}
                </a>
              ) : (
                <span className="ml-auto font-mono text-gray-600">&gt;&gt;{q.boardId}</span>
              )}
            </div>

            {q.text && (
              <pre className="px-3 pb-2 text-xs leading-relaxed text-gray-400 whitespace-pre-wrap font-mono max-h-72 overflow-y-auto">
                {q.text}
              </pre>
            )}

            {q.media?.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 pb-3">
                {q.media.map((m, j) => (
                  <a key={j} href={mediaUrl(m.url)} target="_blank" rel="noopener noreferrer">
                    <img
                      src={mediaUrl(m.url)}
                      alt={m.filename ?? 'quoted attachment'}
                      loading="lazy"
                      className="max-h-40 rounded border border-gray-700 hover:border-gray-500"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {upstream.length > 0 && (
        <button
          onClick={() => setShowChain(v => !v)}
          className="text-[11px] text-gray-500 hover:text-gray-300 hover:underline"
        >
          {showChain
            ? 'hide earlier posts in this chain'
            : `show ${upstream.length} earlier post${upstream.length === 1 ? '' : 's'} in this chain`}
        </button>
      )}
    </div>
  )
}
