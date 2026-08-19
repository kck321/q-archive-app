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

// EVERY link in the drop appears here, but they do not all say the same thing.
//
// The certified rows come from the URL cleanup: addresses adjudicated as named sources, 99
// hostnames across 288 drops. That artifact was never a complete list of links and must not be
// widened by guessing — so the rest of a drop's URLs are listed BESIDE it, plainly marked as
// links the archive has not identified. #2166 carried two links and showed one, because only
// theverge.com had been adjudicated; cnet.com was in the drop the whole time.
const URL_RX = /https?:\/\/[^\s<>"')\]]+/g
const decodeEntities = (u: string): string => u
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
// Compare loosely: the artifact and the drop text can differ by a trailing slash or by case in
// the host, and listing the same address twice under two headings would read as two sources.
const canon = (u: string): string => decodeEntities(String(u)).replace(/[.,;:!?)]+$/, '').replace(/\/+$/, '').toLowerCase()
const hostOf = (u: string): string => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }

export default function LinkedSources({ postNum, text }: { postNum: number; text?: string | null }) {
  const all = useLinkedSources()
  const rows = sourcesForPost(all, postNum)
  const covered = new Set(rows.map(r => canon(r.url)))
  const extras = [...new Set(((text ?? '').match(URL_RX) ?? []).map(decodeEntities))]
    .filter(u => !covered.has(canon(u)))
    .filter((u, i, a) => a.findIndex(x => canon(x) === canon(u)) === i)
  if (!rows.length && !extras.length) return null

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
        {extras.map(u => (
          <li key={u} className="text-sm">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-xs text-gray-400">{hostOf(u)}</span>
              <span className="text-[11px] text-gray-500">linked, not a named source</span>
            </div>
            <a
              href={u}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-xs text-blue-300 hover:text-blue-100 break-all leading-snug"
            >
              {u}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
