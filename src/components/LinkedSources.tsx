// "Sources linked in this drop" — the reader-facing half of the URL policy.
//
// WHY THIS IS A LIST AND NOT A HOVER. A tooltip is an explanation of a word on screen; these are
// not words Q wrote, so there is nothing to hover. The reader gets a labelled region they can
// reach with a keyboard and a screen reader can announce — one heading, one list, one row per
// source — rather than information hidden behind a pointer that never lands anywhere.
//
// A BOUND ROW AND AN UNBOUND ROW SAY DIFFERENT THINGS, and the difference is stated rather than
// implied by styling. Bound means the domain plainly belongs to that organisation. Unbound means
// the archive can name the source but will not claim it identifies a certified entity — a platform
// that merely hosts the material, or a brand whose name is not in its own domain. Rendering both
// the same way would quietly assert the identification the data refused to make.
import { Link } from 'react-router-dom'
import { useLinkedSources, sourcesForPost } from '../lib/linkedSources'

export default function LinkedSources({ postNum }: { postNum: number }) {
  const all = useLinkedSources()
  const rows = sourcesForPost(all, postNum)
  if (!rows.length) return null

  const headingId = `linked-sources-${postNum}`
  return (
    <section aria-labelledby={headingId} className="mt-4 border border-q-border rounded-xl bg-q-panel/60 p-4">
      <h3 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
        Sources linked in this drop
      </h3>
      <p className="text-[11px] text-gray-500 mb-3">
        Where the linked material came from, and whose accounts Q pointed at. These are not words Q
        wrote, so they are not counted as entity mentions and nothing here is highlighted in the drop.
      </p>
      <ul className="space-y-2">
        {rows.map(r => (
          <li key={r.url} className="text-sm">
            <div className="flex items-baseline gap-2 flex-wrap">
              {/* An account is shown as @handle on its platform. Rendering it as a bare name would
                  claim Q named the person, which is exactly what he did not do. */}
              <span className="font-mono text-xs text-gray-400">
                {r.kind === 'social_account' ? `@${r.handle}` : r.hostname}
              </span>
              {r.entityId ? (
                <Link
                  to={`/analysis?cat=entities&q=${encodeURIComponent(r.displayName)}`}
                  className="text-emerald-300 hover:text-emerald-200 hover:underline"
                >
                  {r.displayName}
                </Link>
              ) : (
                <span className="text-gray-300">{r.displayName}</span>
              )}
              <span className="text-[11px] text-gray-500">
                {r.kind === 'social_account'
                  ? (r.entityId
                    ? `account on ${String(r.platform ?? r.hostname).replace(/\.(com|org|net|me|tv)$/, '')} — identified`
                    : `account on ${String(r.platform ?? r.hostname).replace(/\.(com|org|net|me|tv)$/, '')} — identity not established`)
                  : (r.entityId ? 'identified source' : 'named, not identified')}
              </span>
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-xs text-blue-300 hover:text-blue-100 break-all leading-snug"
            >
              {r.url}
            </a>
            {!r.entityId && (
              <p className="text-[11px] text-gray-500 mt-0.5">{r.confidence}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
