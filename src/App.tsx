import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isTauri, openExternal } from './lib/openExternal'
import { loadAliasesFromCloud } from './lib/aliases'
import Sidebar from './components/Sidebar'
import UpdateBanner from './components/UpdateBanner'
import Dashboard from './pages/Dashboard'
import PostArchive from './pages/PostArchive'
import PostDetail from './pages/PostDetail'
import QuestionsArchive from './pages/QuestionsArchive'
import Topics from './pages/Topics'
import Resources from './pages/Resources'
import QPostPics from './pages/QPostPics'
import QLinks from './pages/QLinks'
import QRequests from './pages/QRequests'
import AnalysisArchive from './pages/AnalysisArchive'
import QBrackets from './pages/QBrackets'
import QTripcodes from './pages/QTripcodes'
import Feedback from './pages/Feedback'
import Donate from './pages/Donate'
import { AdminProvider } from './components/AdminContext'
import ScrollRestoration from './components/ScrollRestoration'

export default function App() {
  const [navOpen, setNavOpen] = useState(false)
  // The app scrolls inside <main>, so Back needs to restore THAT element, not the window.
  const mainRef = useRef<HTMLElement | null>(null)

  // Pull entity aliases from the cloud once at startup.
  useEffect(() => { loadAliasesFromCloud() }, [])

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
      <div className="flex h-screen overflow-hidden bg-q-dark">
        <UpdateBanner />

        {/* Mobile top bar with hamburger (hidden on lg+) */}
        <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-12 bg-q-panel border-b border-q-border flex items-center gap-3 px-4">
          <button onClick={() => setNavOpen(true)} aria-label="Open menu" className="text-gray-300 hover:text-white p-1 -ml-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span className="text-base font-semibold text-gray-200"><span className="font-black text-gray-400 mr-1">Q</span>Archive</span>
        </header>

        {/* Backdrop behind the mobile drawer */}
        {navOpen && (
          <div onClick={() => setNavOpen(false)} className="lg:hidden fixed inset-0 z-30 bg-black/60" />
        )}

        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto pt-12 lg:pt-0">
          <ScrollRestoration containerRef={mainRef} />
          <Routes>
            <Route path="/"              element={<Navigate to="/posts" replace />} />
            <Route path="/dashboard"     element={<Dashboard />} />
            <Route path="/posts"         element={<PostArchive />} />
            <Route path="/post/:id"      element={<PostDetail />} />
            <Route path="/questions"     element={<QuestionsArchive />} />
            <Route path="/topics"        element={<Topics />} />
            <Route path="/resources"     element={<Resources />} />
            <Route path="/pics"          element={<QPostPics />} />
            <Route path="/links"         element={<QLinks />} />
            <Route path="/requests"      element={<QRequests />} />
            <Route path="/analysis"      element={<AnalysisArchive />} />
            <Route path="/brackets"      element={<QBrackets />} />
            <Route path="/tripcodes"     element={<QTripcodes />} />
            <Route path="/feedback"      element={<Feedback />} />
            <Route path="/donate"        element={<Donate />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
    </AdminProvider>
  )
}
