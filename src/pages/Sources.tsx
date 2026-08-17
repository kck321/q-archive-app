// Sources — navigation for the publishers behind the links, kept apart from Entities on purpose.
//
// Entities answers "what did Q name?". This answers "where did the material come from?". They were
// one list until the 2026-08-16 URL policy, and merging them is what let a CMS slug be counted as
// a word Q wrote. A reader who wants either question answered should not have to know that the
// archive once conflated them.
//
// SOURCE-ONLY IDENTITIES LIVE HERE AND NOWHERE ELSE. An organisation whose every prose mention
// turned out to be a URL fragment has nothing to show in Entities — a page reading "0 mentions"
// is not a smaller version of an entity page, it is a broken one. It has plenty to show here.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import SectionInfo from '../components/SectionInfo'
import { useLinkedSources, allSources, allAccounts, accountLabel, sourceOnlyDescription } from '../lib/linkedSources'

export default function Sources() {
  const all = useLinkedSources()
  const [search, setSearch] = useState('')
  const publishers = allSources(all)
  const accounts = allAccounts(all)
  const rows = [
    ...publishers.map(p => ({ key: p.hostname, kind: 'publisher' as const, label: p.hostname, ...p })),
    ...accounts.map(a => ({ key: `${a.platform}/${a.handle}`, kind: 'social_account' as const, label: accountLabel(a), ...a })),
  ]

  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter(r => r.key.toLowerCase().includes(q) || r.label.toLowerCase().includes(q) || r.displayName.toLowerCase().includes(q))
    : rows

  const bound = rows.filter(r => r.entityId).length
  const posts = new Set(rows.flatMap(r => r.posts)).size

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
        Sources<SectionInfo id="sources" />
      </h1>
      <p className="text-gray-500 text-sm mb-4">
        {rows.length === 0
          ? 'No linked-source records in this build.'
          : `${publishers.length.toLocaleString()} publishers · ${accounts.length.toLocaleString()} accounts · ${posts.toLocaleString()} drops · ${bound.toLocaleString()} identified as a certified entity`}
      </p>
      <p className="text-gray-500 text-xs mb-6 max-w-3xl">
        Where linked material came from, and whose accounts Q pointed at. Neither a domain nor a
        handle is a word Q wrote, so nothing here is counted as an entity mention or highlighted in
        a drop. <em>Identified</em> means the domain plainly belongs to that organisation, or the
        handle spells its name; <em>not identified</em> means the archive can name the source but
        will not claim it identifies a certified entity.
      </p>

      {rows.length === 0 ? (
        <div className="text-gray-500 text-sm">
          Linked sources appear once the URL cleanup is applied.
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search a domain or publisher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search sources"
            className="w-full bg-q-panel border border-q-border rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600 mb-6"
          />
          <ul className="space-y-2">
            {filtered.map(r => (
              <li key={r.key} className="bg-q-panel border border-q-border rounded-xl p-4">
                <div className="flex items-baseline gap-2 flex-wrap mb-1">
                  <span className="font-mono text-sm text-gray-300">{r.label}</span>
                  <span className="text-sm text-emerald-300">{r.displayName}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded border ${r.kind === 'social_account'
                    ? 'text-sky-300 border-sky-800' : 'text-gray-400 border-q-border'}`}>
                    {r.kind === 'social_account' ? 'account' : 'publisher'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {r.entityId ? 'identified source' : 'named, not identified'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{sourceOnlyDescription(r.posts.length)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.posts.slice(0, 40).map(n => (
                    <Link
                      key={n}
                      to={`/post/${n}?flash=1`}
                      className="text-xs font-mono text-blue-400 hover:underline"
                    >
                      #{n}
                    </Link>
                  ))}
                  {r.posts.length > 40 && (
                    <span className="text-xs text-gray-600">+{r.posts.length - 40} more</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
