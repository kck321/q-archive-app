import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTermPresence, makeTermMatcher, type TermPresence } from '../lib/posts'
import { catColor } from '../lib/categoryColors'

// "Also found in" — every other section carrying the search term, above the chart.
//
// Searching in one section used to hide the fact that the same term sits in five others.
// Each chip links to that section with the search pre-filled (?q=), so a term can be
// followed across the whole archive instead of being investigated one tab at a time.
//
// Alias-aware: searching "hrc" counts the posts that only ever say "Hillary", because the
// alias group is what makes them the same subject.

const CHIP_COLOR: Record<string, string> = {
  questions: '#3b82f6',
  requests: '#22c55e',
  brackets: catColor('brackets'),
  claims: catColor('claims'),
  predictions: catColor('predictions'),
  namedEntities: catColor('namedEntities'),
  themes: catColor('themes'),
  impliedConclusions: catColor('impliedConclusions'),
  verificationHooks: catColor('verificationHooks'),
}

// FIXED display order, matching the sidebar. Never sort these by count and never hoist the
// active one to the front: the chips are a navigation strip, and a strip that reshuffles
// every time you click it makes you re-find your place on each move.
const SECTION_ORDER = [
  'questions',
  'requests',
  'claims',
  'predictions',
  'namedEntities',
  'brackets',
  'themes',
  'impliedConclusions',
  'verificationHooks',
]

function orderIndex(key: string): number {
  const i = SECTION_ORDER.indexOf(key)
  return i === -1 ? SECTION_ORDER.length : i
}

export default function TermPresenceBar({ term, activeKey }: { term: string; activeKey: string }) {
  const [presence, setPresence] = useState<TermPresence[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = term.trim()
    if (!t) { setPresence(null); return }
    let cancelled = false
    setLoading(true)
    getTermPresence(t)
      .then(p => { if (!cancelled) setPresence(p) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [term])

  if (!term.trim()) return null

  const aliases = makeTermMatcher(term).spellings.slice(1)
  // One list in a FIXED order — the active section is highlighted where it already sits
  // rather than jumping to the front, so the strip never moves under the cursor.
  const sections = [...(presence ?? [])].sort((a, b) => orderIndex(a.key) - orderIndex(b.key))

  // Nothing anywhere → render nothing. An "not found" strip is furniture, not information.
  if (!loading && sections.length === 0) return null
  // Called from a page that is not itself one of these sections (e.g. Post Archive): if the
  // term only exists there, there is nothing to cross-link to.
  const others = sections.filter(p => p.key !== activeKey)
  if (!loading && others.length === 0) return null

  return (
    <div className="bg-q-panel border border-q-border rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-300">
          “{term}” across the archive
        </span>
        {loading && <span className="text-[11px] text-gray-600 animate-pulse">counting…</span>}
        {aliases.length > 0 && (
          <span className="text-[11px] text-gray-500">
            incl. aliases:{' '}
            <span className="text-cyan-400">{aliases.join(', ')}</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sections.map(p => {
          const color = CHIP_COLOR[p.key] ?? '#9ca3af'
          const isActive = p.key === activeKey
          if (isActive) {
            return (
              <span
                key={p.key}
                className="text-xs px-2.5 py-1 rounded-lg border font-medium"
                style={{ color, borderColor: `${color}aa`, background: `${color}1f` }}
                title="You are here"
              >
                {p.label} · {p.posts.toLocaleString()} posts
              </span>
            )
          }
          return (
            <Link
              key={p.key}
              to={p.to}
              title={`${p.items.toLocaleString()} matching ${p.items === 1 ? 'item' : 'items'} across ${p.posts.toLocaleString()} posts — open ${p.label}`}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-700 bg-gray-800/60 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              <span style={{ color }}>●</span>{' '}
              {p.label} · {p.posts.toLocaleString()}
            </Link>
          )
        })}

      </div>
    </div>
  )
}
