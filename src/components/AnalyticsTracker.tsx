import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initAnalyticsIfConsented, trackPageview } from '../lib/analytics'

// Resumes tracking on load if the visitor already consented on a previous visit, then sends
// one page_view per route change — a React Router navigation never reaches the browser's own
// history APIs the way a full page load does, so GA never sees anything past the first screen
// without this.
export default function AnalyticsTracker() {
  const location = useLocation()

  useEffect(() => { initAnalyticsIfConsented() }, [])

  useEffect(() => {
    trackPageview(location.pathname + location.search, document.title)
  }, [location.pathname, location.search])

  return null
}
