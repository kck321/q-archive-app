import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { isTauri, openExternal } from './lib/openExternal'
import { initLocalMedia } from './lib/localMedia'
import { getAnalysisFrequency, getQuestionFrequency } from './lib/posts'
import HighlightToggle from './components/HighlightToggle'
import { loadAliasesFromCloud, loadCertifiedEntityAliases } from './lib/aliases'
import Sidebar from './components/Sidebar'
import UpdateBanner from './components/UpdateBanner'
// EDITOR-ONLY PAGES LOAD LAZILY — and that is a bundle-size decision, not a UX one.
//
// A static `import Dashboard` kept the whole editorial subtree (ingest, bulkScan, the Claude AI
// client, their static Firestore imports) in the MAIN chunk of every build, including the public
// one — CAN_EDIT folding to false removes the <Route>, but rollup still bundles a statically
// imported module. React.lazy turns the reference into a dynamic import: the editor pages become
// their own chunk, fetched the first time the owner opens them, and in the public build that
// chunk is never requested at all.
const Dashboard = lazy(() => import('./pages/Dashboard'))
import PostArchive from './pages/PostArchive'
import Search from './pages/Search'
import PostDetail from './pages/PostDetail'
import QuestionsArchive from './pages/QuestionsArchive'
import Topics from './pages/Topics'
import Resources from './pages/Resources'
import QPostPics from './pages/QPostPics'
import QLinks from './pages/QLinks'
import Sources from './pages/Sources'
import QRequests from './pages/QRequests'
import AnalysisArchive from './pages/AnalysisArchive'
import QBrackets from './pages/QBrackets'
import QTripcodes from './pages/QTripcodes'
import Feedback from './pages/Feedback'
import Donate from './pages/Donate'
import Download from './pages/Download'
import Method from './pages/Method'
import { CAN_EDIT } from './lib/appMode'
import ResolutionCenter from './pages/ResolutionCenter'
const HoverReview = lazy(() => import('./pages/HoverReview'))
import { AdminProvider } from './components/AdminContext'
import ScrollRestoration from './components/ScrollRestoration'

export default function App() {
  const [navOpen, setNavOpen] = useState(false)
  // The app scrolls inside <main>, so Back needs to restore THAT element, not the window.
  const mainRef = useRef<HTMLElement | null>(null)

  // Pull entity aliases from the cloud once at startup.
  // BOTH alias registries: the owner-editable groups AND the certified entity aliases from
  // entities.json. Loading only the first is what made searching "COVID-19" miss the rows
  // stored as "COVID" and "C19" while POTUS worked.
  useEffect(() => { loadAliasesFromCloud(); loadCertifiedEntityAliases() }, [])

  // Warm the analysis index in the background once the app is up.
  //
  // It costs ~700ms on a desktop and 2-3.5s on a phone, and every section needs it. Built
  // lazily it was paid on the first section click, which is exactly when someone is waiting
  // and watching. Started here it is usually finished before they navigate — and the result
  // is cached in IndexedDB, so it is only ever paid once per data version.
  useEffect(() => {
    const warm = () => {
      // Both indexes, since every section needs one or the other.
      getAnalysisFrequency().catch(() => { /* section will retry */ })
      getQuestionFrequency(1).catch(() => { /* section will retry */ })
    }
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(warm, { timeout: 3000 })
    else setTimeout(warm, 1200)
  }, [])

  // Desktop app: switch images to the copies bundled in the installer, so the archive
  // works offline and stops streaming attachments off qalerts on users' behalf.
  // No-op on the web, and fails soft back to the mirror.
  useEffect(() => { initLocalMedia() }, [])

  // In the desktop app, route external links through the system browser (the webview
  // won't open http(s) links on its own). Catches every <a href="http…"> app-wide.
  useEffect(() => {
    if (!isTauri()) return
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null
      const href = a?.getAttribute('href') ?? ''
      if (a && /^https?:\/\//i.test(href)) {
        e.preventDefault()
        openExternal(href)
      }
    }
    // Capture phase so it fires before any link's own stopPropagation.
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return (
    <AdminProvider>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <div className="flex min-h-screen lg:h-screen lg:overflow-hidden bg-q-dark overflow-x-clip">
        <UpdateBanner />

        {/* Mobile top bar with hamburger (hidden on lg+) */}
        <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-[calc(3rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-q-panel border-b border-q-border flex items-center gap-3 px-4">
          <button onClick={() => setNavOpen(true)} aria-label="Open menu" className="text-gray-300 hover:text-white p-1 -ml-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <Link to="/" className="text-base font-semibold text-gray-200 hover:text-white transition-colors shrink-0"><span className="font-black text-gray-400 mr-1">Q</span>Drops</Link>
          {/* Sits beside the brand so it is reachable from every page, not just the archive. */}
          <div className="ml-auto overflow-x-auto"><HighlightToggle /></div>
        </header>

        {/* Backdrop behind the mobile drawer */}
        {navOpen && (
          <div onClick={() => setNavOpen(false)} className="lg:hidden fixed inset-0 z-30 bg-black/60" />
        )}

        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <main ref={mainRef} className="flex-1 min-w-0 relative lg:overflow-y-auto pt-[calc(3rem+env(safe-area-inset-top))] lg:pt-0 pb-[env(safe-area-inset-bottom)]">
          <ScrollRestoration containerRef={mainRef} />
          <Routes>
            <Route path="/"              element={<Navigate to="/posts" replace />} />
            {/* PRIVATE. The Dashboard is the editorial workbench (ingest, bulk scans, AI
                analysis) and by owner ruling 2026-08-23 it is off qdrops.app entirely — not
                PIN-locked on it. CAN_EDIT folds to a literal false in the public build, so
                the route and the page behind it are dropped from that bundle. */}
            {CAN_EDIT && <Route path="/dashboard" element={<Suspense fallback={null}><Dashboard /></Suspense>} />}
            <Route path="/posts"         element={<PostArchive />} />
            <Route path="/search"        element={<Search />} />
            <Route path="/post/:id"      element={<PostDetail />} />
            <Route path="/questions"     element={<QuestionsArchive />} />
            <Route path="/topics"        element={<Topics />} />
            <Route path="/resources"     element={<Resources />} />
            <Route path="/pics"          element={<QPostPics />} />
            <Route path="/links"         element={<QLinks />} />
            <Route path="/sources"       element={<Sources />} />
            <Route path="/requests"      element={<QRequests />} />
            <Route path="/analysis"      element={<AnalysisArchive />} />
            <Route path="/brackets"      element={<QBrackets />} />
            <Route path="/tripcodes"     element={<QTripcodes />} />
            <Route path="/feedback"      element={<Feedback />} />
            <Route path="/donate"        element={<Donate />} />
            <Route path="/resolve"      element={<ResolutionCenter />} />
            {/* PRIVATE. CAN_EDIT folds to a literal false in the public build, so this route and
                the page behind it are dropped from that bundle rather than hidden in it. The data
                it reads is not in public/ either — see the editorialQueues plugin in vite.config. */}
            {CAN_EDIT && <Route path="/editorial/hover-review" element={<Suspense fallback={null}><HoverReview /></Suspense>} />}
            <Route path="/method"       element={<Method />} />
            <Route path="/download"      element={<Download />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
    </AdminProvider>
  )
}
