import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { QPost, QuotedPost } from '../types'
import { mediaUrl, dedupeMedia } from '../lib/mediaUrl'
import { linkify } from '../lib/linkify'
import { highlightText } from '../lib/postHighlight'
import { getQuotedContext, type QuotedContext } from '../lib/references'

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
  searchKeyword = '',
}: {
  quoted: QuotedPost[]
  /** Maps a board post id to a Q drop, when the quoted post is itself one of ours. */
  qDropFor?: (boardId: string) => QPost | null
  /** Highlighted inside the quoted text, so a match here is visible in search results. */
  searchKeyword?: string
}) {
  const [showChain, setShowChain] = useState(false)

  // A quoted post that is itself a drop we hold carries its own questions, requests and
  // analysis, so it can be marked up exactly as it is on its own page. Without this the
  // quote renders flat while the drop's own words are fully highlighted, and the reply looks
  // unanalysed — #1102 quotes #1100, which has 5 stored claims and a request.
  const [ctx, setCtx] = useState<QuotedContext | null>(null)
  const hasQuotes = !!quoted?.length
  useEffect(() => {
    if (!hasQuotes) return
    let cancelled = false
    getQuotedContext().then(c => { if (!cancelled) setCtx(c) })
    return () => { cancelled = true }
  }, [hasQuotes])

  if (!quoted?.length) return null

  const direct = quoted.filter(q => (q.depth ?? 0) === 0)
  const upstream = quoted.filter(q => (q.depth ?? 0) > 0)
  const shown = showChain ? [...direct, ...upstream] : direct

  return (
    <div className="mt-3 space-y-2">
      {shown.map((q, i) => {
        const depth = q.depth ?? 0
        const drop = ctx?.byBoardId.get(q.boardId) ?? qDropFor?.(q.boardId) ?? null
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

            {/* No height cap: a quoted post is shown in full, like the drop's own text. A
                scroll box hid the top of the quote — including, for a search, the very line
                that matched. */}
            {q.text && (
              <pre className="px-3 pb-2 text-[13px] sm:text-xs leading-relaxed text-gray-400 whitespace-pre-wrap break-words font-mono">
                {linkify(
                  drop
                    ? highlightText(
                        q.text,
                        ctx?.questionsByPostId.get(drop.id) ?? [],
                        searchKeyword,
                        drop.actionRequests ?? [],
                        drop.postAnalysis,
                      )
                    // No stored analysis for an anon quote — highlightText still marks
                    // entities, [brackets], mil-intel terms and the search term.
                    : highlightText(q.text, [], searchKeyword)
                )}
              </pre>
            )}

            {dedupeMedia(q.media).length > 0 && (
              <div className="space-y-2 px-3 pb-3">
                {dedupeMedia(q.media).map((m, j) => (
                  <a key={j} href={mediaUrl(m.url)} target="_blank" rel="noopener noreferrer">
                    <img
                      src={mediaUrl(m.url)}
                      alt={m.filename ?? 'quoted attachment'}
                      loading="lazy"
                      className="max-w-full h-auto block rounded border border-gray-700 hover:border-gray-500"
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
