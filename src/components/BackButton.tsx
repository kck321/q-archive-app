import { useNavigate } from 'react-router-dom'

// Small "← Back" button — returns to the previous screen (e.g. the Post Archive search results or
// the Entities list you came from). When there's no history to go back to (direct link / page
// refresh), it falls back to `fallback` instead of dead-ending.
export default function BackButton({ className = '', fallback = '/' }: { className?: string; fallback?: string }) {
  const navigate = useNavigate()
  const goBack = () => {
    // react-router stamps a history index on window.history.state; idx 0 (or missing) means this is
    // the first entry, so navigate(-1) would leave the app — use the fallback route instead.
    const idx = (window.history.state?.idx as number | undefined) ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback)
  }
  return (
    <button
      onClick={goBack}
      title="Go back to the previous screen"
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-q-border rounded-md px-2.5 py-1 transition-colors ${className}`}
    >
      <span className="text-sm leading-none">←</span> Back
    </button>
  )
}
