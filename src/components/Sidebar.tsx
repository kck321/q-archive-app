import { NavLink, Link, useLocation } from 'react-router-dom'
import { useState, useCallback, Fragment } from 'react'
import { CAN_EDIT } from '../lib/appMode'
import HighlightToggle from './HighlightToggle'

const links = [
  { to: '/posts',     label: 'Post Archive', icon: '📜' },
  // Search crosses every certified section, so it belongs beside the archive rather than inside
  // any one layer's list.
  // Search removed from the sidebar by owner ruling 2026-08-14. The ROUTE stays live —
  // every 'also found in' chip and section cross-link points at /search — it just no longer
  // occupies a permanent slot above Q Questions.

]


// Colors here mirror src/lib/categoryColors.ts (tailwind -500 == those hex values) so the
// sidebar matches the chart tabs/bars exactly.
// Overlaps shows items the extractor filed under two categories at once — a data-quality
// view for fixing them, not research. It is appended for the editing build only.
const OVERLAPS_LINK = { tab: 'overlaps', label: '⚠ Overlaps', dot: 'bg-gray-500', color: 'text-yellow-500 hover:text-yellow-400' }

const analysisLinks = [
  { tab: 'claims',            label: 'Q Claims',       dot: 'bg-gray-500',  color: 'text-amber-500 hover:text-amber-400' },
  { tab: 'predictions',       label: 'Q Predictions',  dot: 'bg-gray-500', color: 'text-violet-500 hover:text-violet-400' },
  { tab: 'namedEntities',     label: 'Q Entities',     dot: 'bg-gray-500',   color: 'text-cyan-500 hover:text-cyan-400' },
  { tab: 'themes',            label: 'Q Themes',       dot: 'bg-gray-500', color: 'text-indigo-500 hover:text-indigo-400' },
  // Q Conclusions retired as a section by owner ruling 2026-08-14: "implied conclusions ...
  // is basically the same thing" as a Claim. All 966 were ALREADY certified Claims carrying
  // isConclusion — the section was a second view of the same rows, so it is the view that goes,
  // not the data. The attribute survives on claimMeta for provenance.

  // Checkable Claims merged into Claims by owner ruling 2026-08-15. All 1,926 were ALREADY
  // certified Claims — 0 needed adding, so nothing moved and nothing was double-counted. The
  // `checkable` attribute survives on claimMeta for provenance; only the separate section goes.
  // Q Emphasis retired by owner ruling 2026-08-21, and this time the DATA went with the view:
  // "get rid of the emphasis category ... everything associated with it". A sentence carrying only
  // an emphasis span used to read as highlighted to a coverage scan while the reader saw nothing.
  ...(CAN_EDIT ? [OVERLAPS_LINK] : []),
]

// EXTRAS — collapsed by owner ruling 2026-08-23. Everything here is a reference tool or a
// page about the site rather than one of the certified analysis sections, so the sidebar
// keeps the archive and the sections at top level and folds these behind one row. The routes
// are untouched; only their permanent slots go.
const extrasLinks = [
  { to: '/tripcodes', label: 'Q Tripcodes',     icon: '🔐' },
  { to: '/topics',    label: 'Q Clusters',      icon: '📖' },
  { to: '/links',     label: 'All Q Links',     icon: '🌐' },
  { to: '/sources',   label: 'Sources',         icon: '📰' },
  { to: '/resources', label: 'Resources',       icon: '🔗' },
  { to: '/resolve',   label: 'Resolution Center', icon: '🔎' },
  { to: '/method',    label: 'How This Works',  icon: 'ⓘ' },
  { to: '/feedback',  label: 'Comments & Ideas', icon: '💬' },
  { to: '/download',  label: 'Get the App',     icon: '⬇️' },
]

const bottomLinks = [
  // Support stays at top level: a donation link inside a collapsed menu is a donation link
  // nobody finds.
  { to: '/donate',    label: 'Support',         icon: '❤️' },
  // The Dashboard is the editorial workbench, not a reader feature. CAN_EDIT folds to a
  // literal false in the public build, so this entry (and its route in App.tsx) never
  // reaches qdrops.app. Owner ruling 2026-08-23.
  ...(CAN_EDIT ? [{ to: '/dashboard', label: 'Dashboard', icon: '⬡' }] : []),
]

const itemCls = (isActive: boolean, color: string, flashKey: string | null, fkey: string) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${flashKey === fkey ? 'animate-nav-flash' : ''} ${
    isActive ? `${color} bg-white/5` : `${color} hover:bg-white/5`
  }`

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const activeTab = searchParams.get('tab')
  const activeStatus = searchParams.get('status')
  const [flashKey, setFlashKey] = useState<string | null>(null)

  // The Extras group starts closed, and opens by itself when the route is inside it — so a
  // reader who arrives on one of these pages from a cross-link can see where they are. Once
  // the reader clicks the row, their choice wins for the rest of the session; the row keeps
  // the accent colour while a page inside it is active but folded away. Derived rather than
  // synced in an effect, so there is no state to keep in step with the route.
  const inExtras = extrasLinks.some(l => location.pathname === l.to)
  const [extrasChoice, setExtrasChoice] = useState<boolean | null>(null)
  const extrasOpen = extrasChoice ?? inExtras

  const flash = useCallback((key: string) => {
    setFlashKey(null)
    requestAnimationFrame(() => requestAnimationFrame(() => setFlashKey(key)))
    setTimeout(() => setFlashKey(null), 1800)
  }, [])

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 w-56 bg-q-panel border-r border-q-border flex flex-col overflow-y-auto transform transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-q-border">
        <Link to="/" onClick={onClose} className="flex items-center gap-2 group">
          <span className="text-2xl font-black text-gray-400 group-hover:text-gray-300 tracking-wider transition-colors">Q</span>
          <span className="text-lg font-semibold text-gray-200 group-hover:text-white transition-colors">Drops</span>
        </Link>
        <p className="text-xs text-gray-500 mt-1">4,966 Intelligence Drops</p>
        <div className="mt-2"><HighlightToggle /></div>
      </div>

      {/* Nav — clicking any link closes the mobile drawer */}
      <nav className="flex-1 px-3 py-4 space-y-1" onClick={() => onClose?.()}>
        {/* Top-level static links */}
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            onClick={() => flash(l.to)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${flashKey === l.to ? 'animate-nav-flash' : ''} ${
                isActive
                  ? 'bg-q-accent/20 text-q-accent'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`
            }
          >
            <span className="text-base">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}

        {/* Q Questions — above Q Claims */}
        <NavLink
          to="/questions"
          end
          onClick={() => flash('questions')}
          className={({ isActive }) =>
            itemCls(isActive && !activeStatus, 'text-blue-500 hover:text-blue-400', flashKey, 'questions')
          }
        >
          <span className="w-2 h-2 rounded-full shrink-0 bg-gray-500" />
          Q Questions
        </NavLink>

        {/* Q Directives — same level as Q Questions */}
        <NavLink
          to="/requests"
          onClick={() => flash('requests')}
          className={({ isActive }) =>
            itemCls(isActive, 'text-green-500 hover:text-green-400', flashKey, 'requests')
          }
        >
          <span className="w-2 h-2 rounded-full shrink-0 bg-gray-500" />
          Q Directives
        </NavLink>

        {/* Analysis category links */}
        {analysisLinks.map(a => {
          const isActive = location.pathname === '/analysis' && activeTab === a.tab
          const fkey = `an-${a.tab}`
          return (
            <Fragment key={a.tab}>
              <NavLink
                to={`/analysis?tab=${a.tab}`}
                onClick={() => flash(fkey)}
                className={itemCls(isActive, a.color, flashKey, fkey)}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${a.dot}`} />
                {a.label}
              </NavLink>
              {a.tab === 'emphasis' && (
                <NavLink
                  to="/pics"
                  onClick={() => flash('/pics')}
                  className={({ isActive: pa }) =>
                    itemCls(pa, 'text-teal-400 hover:text-teal-300', flashKey, '/pics')
                  }
                >
                  <span className="w-2 h-2 rounded-full shrink-0 bg-gray-500" />
                  Q Post Pics
                </NavLink>
              )}
              {a.tab === 'namedEntities' && (
                <NavLink
                  to="/brackets"
                  onClick={() => flash('/brackets')}
                  className={({ isActive: ba }) =>
                    itemCls(ba, 'text-red-500 hover:text-red-400', flashKey, '/brackets')
                  }
                >
                  <span className="w-2 h-2 rounded-full shrink-0 bg-gray-500" />
                  Q [ Brackets ]
                </NavLink>
              )}
            </Fragment>
          )
        })}

        {/* Extras — one row that folds the reference tools and the about-the-site pages away.
            stopPropagation because <nav> closes the mobile drawer on any click, and toggling
            the group is not navigating. */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setExtrasChoice(!extrasOpen) }}
          aria-expanded={extrasOpen}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5 ${
            inExtras && !extrasOpen ? 'text-q-accent' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="text-base">🧰</span>
          Extras
          <span className={`ml-auto text-[10px] text-gray-500 transition-transform ${extrasOpen ? 'rotate-90' : ''}`}>▶</span>
        </button>

        {extrasOpen && (
          <div className="ml-2 pl-2 border-l border-q-border space-y-1">
            {extrasLinks.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => flash(l.to)}
                className={({ isActive }) =>
                  // Tighter than a top-level row on purpose: the indent costs ~20px, which is
                  // enough to wrap "Resolution Center" onto two lines at w-56.
                  `flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${flashKey === l.to ? 'animate-nav-flash' : ''} ${
                    isActive
                      ? 'bg-q-accent/20 text-q-accent'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`
                }
              >
                <span className="text-base">{l.icon}</span>
                {l.label}
              </NavLink>
            ))}
          </div>
        )}

        {/* Bottom links */}
        {bottomLinks.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            onClick={() => flash(l.to)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${flashKey === l.to ? 'animate-nav-flash' : ''} ${
                isActive
                  ? 'bg-q-accent/20 text-q-accent'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`
            }
          >
            <span className="text-base">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {/* Every board the 4,966 drops were actually posted on, in chronological order of
          use. Counts come from the `source` field on the posts themselves. */}
      <div className="px-4 py-3 border-t border-q-border text-[11px] text-gray-600 leading-relaxed space-y-1">
        <p className="text-gray-500 font-medium">Sources — original boards</p>
        <p><span className="text-gray-500">4chan</span> /pol/</p>
        <p>
          <span className="text-gray-500">8chan</span> /pol/ · /cbts/ · /thestorm/ ·
          /greatawakening/ · /patriotsfight/ · /qresearch/
        </p>
        <p><span className="text-gray-500">8kun</span> /qresearch/ · /projectdcomms/</p>
      </div>
    </aside>
  )
}
