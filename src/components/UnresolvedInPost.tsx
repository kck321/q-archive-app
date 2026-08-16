import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadQueue, resolveLinkFor, type QueueItem } from '../lib/resolution'

/**
 * "Help resolve this" — the unresolved references inside one drop.
 *
 * This used to render the bare token and a link away to the Resolution Center, which meant a
 * reader looking at #1866 saw "TT" and had no way to tell WHICH "TT", on which line, or why it
 * was left alone — the one question the panel exists to answer. The queue row already carries
 * the exact span, the character offset and the reason; none of it was shown.
 *
 * Now the span is shown in place with the token marked, so the drop in front of the reader is
 * enough to judge it. The link is still there for saying so, and it still points at the EXACT
 * occurrence: resolving "BO" here says nothing about the other 60 drops that use it.
 *
 * Renders nothing when a drop has no unresolved references, which is most of them.
 */

const KIND_LABEL: Record<string, string> = {
  entity: 'Reference',
  code: 'Notation',
  theme: 'Subject',
  classification: 'Device',
  source_reference: 'Source',
  other: 'Other',
}

const KIND_ASKS: Record<string, string> = {
  entity: 'Which specific person, place or organisation does this mean here?',
  code: 'What does this notation mean, and what in the corpus establishes it?',
  theme: 'Do these words make the drop about that subject?',
  classification: 'Is this a deliberate rhetorical device, or ordinary sentence structure?',
}

/** The span with the unresolved token marked, so the reader can see it without leaving. */
function SpanWithToken({ span, token, charIndex }: { span: string; token: string; charIndex: number }) {
  // Prefer the recorded offset — the token can appear more than once on the line, and the queue
  // is occurrence-specific, so "the first match" would sometimes mark the wrong one.
  const at = span.slice(charIndex, charIndex + token.length) === token
    ? charIndex
    : span.indexOf(token)
  if (at < 0) return <>{span}</>
  return (
    <>
      {span.slice(0, at)}
      <mark className="bg-amber-500/30 text-amber-100 rounded px-0.5 not-italic font-semibold">{token}</mark>
      {span.slice(at + token.length)}
    </>
  )
}

export default function UnresolvedInPost({ postNum }: { postNum: number }) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [openId, setOpenId] = useState<string | null>(null)

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
        <span className="text-xs font-semibold text-amber-300">
          Unresolved in this drop
        </span>
        <span className="text-[11px] text-gray-500">{items.length}</span>
      </div>
      <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
        These could not be identified with confidence from the surrounding text, so they were left
        unresolved rather than guessed. If this drop makes one of them clear, you can say so.
      </p>

      <div className="mt-2 space-y-2">
        {items.map(i => {
          const open = openId === i.id
          return (
            <div key={i.id} className="rounded border border-amber-600/30 bg-black/20">
              <button
                onClick={() => setOpenId(open ? null : i.id)}
                className="w-full text-left px-2.5 py-1.5 flex items-baseline gap-2 flex-wrap hover:bg-amber-500/5"
              >
                <span className="text-xs font-mono font-semibold text-amber-200">{i.token}</span>
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  {KIND_LABEL[i.kind] ?? i.kind}
                </span>
                <span className="ml-auto text-[11px] text-gray-500">{open ? '▾' : '▸'}</span>
              </button>

              {/* The exact span, always visible — this is the thing the reader came to see. */}
              <div className="px-2.5 pb-2">
                <div className="font-mono text-[11px] text-gray-300 leading-relaxed">
                  <SpanWithToken span={i.sourceSpan} token={i.token} charIndex={i.charIndex} />
                </div>

                {open && (
                  <div className="mt-2 space-y-1.5">
                    {KIND_ASKS[i.kind] && (
                      <p className="text-[11px] text-gray-400">
                        <span className="text-gray-500">Asked here: </span>{KIND_ASKS[i.kind]}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500 leading-relaxed">{i.whyUnresolved}</p>

                    {i.candidates.length > 0 && (
                      <p className="text-[11px] text-gray-400">
                        <span className="text-gray-500">Readings already considered, none proven here: </span>
                        {i.candidates.join(' · ')}
                      </p>
                    )}

                    {i.context.length > 1 && (
                      <div className="rounded bg-black/30 p-2 font-mono text-[11px] text-gray-500 leading-relaxed">
                        {i.context.map((l, n) => (
                          <div key={n} className={l === i.sourceSpan ? 'text-gray-200' : ''}>{l}</div>
                        ))}
                      </div>
                    )}

                    <Link
                      to={resolveLinkFor(i.id)}
                      className="inline-block text-[11px] px-2 py-0.5 rounded border border-amber-600/40 text-amber-200 hover:bg-amber-500/10"
                    >
                      Suggest a resolution →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
