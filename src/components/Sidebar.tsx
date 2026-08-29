import { NavLink, Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { CAN_EDIT } from '../lib/appMode'
import HighlightToggle from './HighlightToggle'
import { countPostPics } from '../lib/postPics'
// Owner ruling 2026-08-28: every category row carries its count, underneath the label. The
// figures are READ from sectionInfo's certified constants, never recounted here — the same
// NEVER_RECOUNT_RULE the section headers follow, and the same numbers each destination page
// headlines, so the sidebar can never disagree with the page it opens.
import { CERTIFIED, SECTION_TOTALS, CODES_INFO } from '../lib/sectionInfo'

const links = [
  { to: '/posts',     label: 'Post Archive', icon: '📜', count: CERTIFIED.totalPosts },
  // Search crosses every certified section, so it belongs beside the archive rather than inside
  // any one layer's list.
  // Search removed from the sidebar by owner ruling 2026-08-14. The ROUTE stays live —
  // every 'also found in' chip and section cross-link points at /search — it just no longer
  // occupies a permanent slot above Q Questions.

]

/** The label with its certified count underneath — the shape every category row shares.
    Owner ruling 2026-08-28: the count wears the CATEGORY'S OWN COLOR (inherited from the row,
    so it also brightens on hover exactly as the label does) and sits centered under the label,
    not grey and left-flushed. */
const CountedLabel = ({ label, count }: { label: string; count?: number }) => (
  <span className="flex flex-col leading-tight">
    <span>{label}</span>
    {count !== undefined && (
      <span className="self-center text-[10px] font-normal tabular-nums opacity-90">{count.toLocaleString()}</span>
    )}
  </span>
)


// Colors here mirror src/lib/categoryColors.ts (tailwind -500 == those hex values) so the
// sidebar matches the chart tabs/bars exactly.
// Overlaps shows items the extractor filed under two categories at once — a data-quality
// view for fixing them, not research. It is appended for the editing build only.
const OVERLAPS_LINK = { tab: 'overlaps', label: '⚠ Overlaps', dot: 'bg-gray-500', color: 'text-yellow-500 hover:text-yellow-400', count: undefined as number | undefined }

// EVERY Q section in ONE list, ordered MOST → LEAST by certified count (owner ruling
// 2026-08-28: "organize the categories on the left ... in order from most to least top
// bottom"). The sort runs over the same constants the counts display, so a future
// recertification reorders the sidebar by itself — the order can never contradict the
// numbers printed under the labels. Questions/Directives/Brackets used to be hardcoded
// rows outside this array, which is why the list mixes plain paths and /analysis tabs.
//
// Q Conclusions retired 2026-08-14 (a second view of certified Claims), Checkable Claims
// merged into Claims 2026-08-15, Q Emphasis retired with its data 2026-08-21 — see git
// history for the full rulings.
const categoryLinks = [
  { key: 'questions',     label: 'Q Questions',    color: 'text-blue-500 hover:text-blue-400',     count: CERTIFIED.questions.occurrences,       to: '/questions',                    tab: null },
  { key: 'requests',      label: 'Q Directives',   color: 'text-green-500 hover:text-green-400',   count: CERTIFIED.directives.occurrences,      to: '/requests',                     tab: null },
  { key: 'claims',        label: 'Q Claims',       color: 'text-amber-500 hover:text-amber-400',   count: SECTION_TOTALS.claims.occurrences,     to: '/analysis?tab=claims',          tab: 'claims' },
  { key: 'predictions',   label: 'Q Predictions',  color: 'text-violet-500 hover:text-violet-400', count: SECTION_TOTALS.predictions.occurrences, to: '/analysis?tab=predictions',    tab: 'predictions' },
  { key: 'namedEntities', label: 'Q Entities',     color: 'text-cyan-500 hover:text-cyan-400',     count: SECTION_TOTALS.namedEntities.occurrences, to: '/analysis?tab=namedEntities', tab: 'namedEntities' },
  { key: 'themes',        label: 'Q Themes',       color: 'text-indigo-500 hover:text-indigo-400', count: SECTION_TOTALS.themes.occurrences,     to: '/analysis?tab=themes',          tab: 'themes' },
  { key: 'brackets',      label: 'Q [ Brackets ]', color: 'text-red-500 hover:text-red-400',       count: CODES_INFO.occurrences,                to: '/brackets',                     tab: null },
].sort((a, b) => b.count - a.count)

// EXTRAS — collapsed by owner ruling 2026-08-23. Everything here is a reference tool or a
// page about the site rather than one of the certified analysis sections, so the sidebar
// keeps the archive and the sections at top level and folds these behind one row. The routes
// are untouched; only their permanent slots go.
//
// Resolution Center / Comments & Ideas moved OUT to their own rows below Support on
// 2026-08-26, then back in the same day: "i don't like the resolutionn center and the coments
// and ideas outside of the extras. lets put them back in the extras but have them at the top
// of the list." First two rows in the fold, not their old middle slots.
const extrasLinks = [
  { to: '/resolve',   label: 'Resolution Center', icon: '🔎' },
  { to: '/feedback',  label: 'Comments & Ideas', icon: '💬' },
  { to: '/tripcodes', label: 'Q Tripcodes',     icon: '🔐' },
  { to: '/topics',    label: 'Q Clusters',      icon: '📖' },
  { to: '/links',     label: 'All Q Links',     icon: '🌐' },
  { to: '/sources',   label: 'Sources',         icon: '📰' },
  { to: '/resources', label: 'Resources',       icon: '🔗' },
  { to: '/method',    label: 'How This Works',  icon: 'ⓘ' },
  { to: '/download',  label: 'Get the App',     icon: '⬇️' },
]

const bottomLinks = [
  // Support stays at top level: a donation link inside a collapsed menu is a donation link
  // nobody finds. No icon — owner ruling 2026-08-28 replaced the ❤️ with the same grey dot
  // every Q section row carries, so it reads as one of the archive's own rows.
  { to: '/donate',    label: 'Support',         icon: null as string | null },
  // The Dashboard is the editorial workbench, not a reader feature. CAN_EDIT folds to a
  // literal false in the public build, so this entry (and its route in App.tsx) never
  // reaches qdrops.app. Owner ruling 2026-08-23.
  ...(CAN_EDIT ? [{ to: '/dashboard', label: 'Dashboard', icon: '⬡' as string | null }] : []),
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

  // The Q Pictures count. Loaded async because it is derived from the posts themselves —
  // there is no certified constant for pictures — and cached in lib/postPics after the
  // first computation, so this costs one pass per app load, not one per navigation.
  const [picCount, setPicCount] = useState<number | undefined>(undefined)
  useEffect(() => { countPostPics().then(setPicCount).catch(() => {}) }, [])

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
      {/* Logo — the app icon itself (the popcorn bucket and DROPS inside the Q), centered in
          the column by owner ruling 2026-08-28, replacing the old left-aligned "Q Drops" text.
          The icon already carries the wordmark, so no text sits beside it. */}
      <div className="px-5 py-5 border-b border-q-border flex flex-col items-center text-center">
        <Link to="/" onClick={onClose} className="group" aria-label="Q Drops — home">
          <img
            src={`${import.meta.env.BASE_URL}icon-192-v2.png`}
            alt="Q Drops"
            width={96}
            height={96}
            className="w-24 h-24 rounded-xl group-hover:brightness-110 transition-[filter]"
          />
        </Link>
        <p className="text-xs text-gray-500 mt-2">4,966 Intelligence Drops</p>
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
            <CountedLabel label={l.label} count={l.count} />
          </NavLink>
        ))}

        {/* Every Q section, most → least. One map over the pre-sorted list — the three
            hardcoded blocks this replaces are what made the old order arbitrary. */}
        {categoryLinks.map(c => {
          const isActive = c.tab
            ? location.pathname === '/analysis' && activeTab === c.tab
            // The Questions row keeps its old quirk: a ?status= view of /questions is a
            // different screen, so the row does not read as active there.
            : location.pathname === c.to && (c.key !== 'questions' || !activeStatus)
          const fkey = c.tab ? `an-${c.tab}` : c.to
          return (
            <NavLink
              key={c.key}
              to={c.to}
              onClick={() => flash(fkey)}
              className={itemCls(isActive, c.color, flashKey, fkey)}
            >
              <span className="w-2 h-2 rounded-full shrink-0 bg-gray-500" />
              <CountedLabel label={c.label} count={c.count} />
            </NavLink>
          )
        })}

        {/* Q Pictures — owner ruling 2026-08-28: its own row directly below Q Predictions,
            grey dot like the section rows, the number of pictures underneath. It is not a
            certified section so it sits AFTER the ranked sort, not inside it, and its count
            is the /pics headline's own computation (lib/postPics) — the same definition, so
            the row and the page cannot disagree. */}
        <NavLink
          to="/pics"
          onClick={() => flash('/pics')}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${flashKey === '/pics' ? 'animate-nav-flash' : ''} ${
              isActive
                ? 'bg-q-accent/20 text-q-accent'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`
          }
        >
          <span className="w-2 h-2 rounded-full shrink-0 bg-gray-500" />
          <CountedLabel label="Q Pictures" count={picCount} />
        </NavLink>

        {/* Overlaps — a data-quality view, editing build only, below the ranked sections. */}
        {CAN_EDIT && (() => {
          const isActive = location.pathname === '/analysis' && activeTab === OVERLAPS_LINK.tab
          const fkey = `an-${OVERLAPS_LINK.tab}`
          return (
            <NavLink
              to={`/analysis?tab=${OVERLAPS_LINK.tab}`}
              onClick={() => flash(fkey)}
              className={itemCls(isActive, OVERLAPS_LINK.color, flashKey, fkey)}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${OVERLAPS_LINK.dot}`} />
              <CountedLabel label={OVERLAPS_LINK.label} count={OVERLAPS_LINK.count} />
            </NavLink>
          )
        })()}

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
          {/* The grey dot, same as every Q section row above it — this reads as one of the
              archive's own rows rather than a utility menu bolted to the bottom. */}
          <span className="w-2 h-2 rounded-full shrink-0 bg-gray-500" />
          Q Extras
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
            {l.icon
              ? <span className="text-base">{l.icon}</span>
              : <span className="w-2 h-2 rounded-full shrink-0 bg-gray-500" />}
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
