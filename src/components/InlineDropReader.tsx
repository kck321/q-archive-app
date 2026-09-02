import PostCard from './PostCard'
import ReaderSentinel from './ReaderSentinel'
import { READ_PAGE, type InlineReader } from '../lib/inlineDropReader'

/**
 * The open panel: the drops themselves, paged.
 *
 * `term` is the phrase that put these drops in the list, and it is handed to PostCard so the
 * phrase is highlighted inside each one — otherwise the reader has to find it by eye in a wall of
 * text, which is most of the work the row was supposed to save.
 */
export default function InlineDropReader({ reader, term }: { reader: InlineReader; term: string }) {
  const { readPosts, readLoading, readLimit, readQuestions, more } = reader
  return (
    // data-drop-reader is the stable hook the browser gate selects on. It used to select the
    // panel by its exact Tailwind margin classes, so changing mb-3 to mb-1 while extracting this
    // component made a working reader report as broken — the spacing is restored, and the gate no
    // longer depends on it.
    <div data-drop-reader="open" className="mt-2 mb-3 border-t border-q-border pt-3 space-y-3">
      {readLoading && <p className="text-xs text-gray-500 animate-pulse">opening drops…</p>}
      {!readLoading && readPosts.length === 0 && (
        <p className="text-xs text-gray-500">No drops loaded for this row.</p>
      )}
      {readPosts.slice(0, readLimit).map(rp => (
        <div key={rp.id ?? rp.postNum}>
          <PostCard post={rp} questionTexts={readQuestions[rp.id]} searchKeyword={term} />
        </div>
      ))}
      {/* Scrolling IS the request for more. The sentinel loads the next batch as it comes into
          view, so every drop opens as you scan without a click — while still mounting them in
          batches, because hundreds of PostCards rendered at once locks the tab. */}
      {readPosts.length > readLimit && <ReaderSentinel onEnter={more} />}
      {readPosts.length > readLimit && (
        <button
          onClick={more}
          className="text-xs px-3 py-1 rounded border border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-400 transition-colors font-mono"
        >
          + {Math.min(READ_PAGE, readPosts.length - readLimit)} more
          <span className="text-gray-500"> ({readLimit.toLocaleString()} of {readPosts.length.toLocaleString()})</span>
        </button>
      )}
    </div>
  )
}

/**
 * The button that opens and closes a row, worded and coloured identically everywhere.
 *
 * The phrase itself is also clickable on every page — this is the explicit control beside it, for
 * readers who do not discover that the phrase is a button.
 */
export function ReadDropsButton({ count, isReading, onToggle }: { count: number; isReading: boolean; onToggle: () => void }) {
  if (count <= 0) return null
  return (
    <button
      onClick={onToggle}
      className={`text-xs px-2 py-0.5 rounded border font-mono transition-colors ${
        isReading
          ? 'border-cyan-500 bg-cyan-900/50 text-cyan-200'
          : 'border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-400'
      }`}
      title={isReading ? 'Close the drops' : `Read all ${count} drops here, in post order`}
    >
      {isReading ? '− close drops' : `▼ read ${count.toLocaleString()} drop${count !== 1 ? 's' : ''}`}
    </button>
  )
}

/**
 * The phrase, as a control.
 *
 * Claims and Named Entities let a reader click the term itself to open its drops, and that is the
 * gesture people actually reach for — the phrase is the thing they are interested in. Questions,
 * Directives and Brackets showed the same phrase as inert text.
 *
 * It is a real <button> with aria-expanded, not a styled <span> with onClick: the row is a
 * disclosure, and a keyboard or screen-reader user has to be able to work it too. `className`
 * carries each section's own colour so nothing about the rows' appearance changes.
 */
export function ReadablePhrase({
  text, isReading, onToggle, className, children,
}: {
  text: string
  isReading: boolean
  onToggle: () => void
  className: string
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isReading}
      // A stable hook for the browser gate, for the same reason data-drop-reader exists: selecting
      // this control by "a button with aria-expanded and no aria-controls" also matched the
      // sidebar's Q Extras disclosure, so the gate clicked the sidebar and reported four sections
      // broken. A row's phrase says so about itself.
      data-read-phrase="1"
      title={isReading ? 'Close these drops' : `Read every drop containing "${text}", oldest first`}
      className={`${className} text-left hover:brightness-125 hover:underline underline-offset-2 cursor-pointer transition-all ${isReading ? 'ring-1 ring-white/40' : ''}`}
    >
      {children ?? text}
    </button>
  )
}
