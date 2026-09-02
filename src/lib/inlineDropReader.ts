import { useEffect, useState } from 'react'
import { loadLocalData } from './localData'
import { getQuestionsForPosts } from './posts'
import type { QPost } from '../types'

// READ THE DROPS WITHOUT LEAVING THE ROW — the loading, ordering and paging half.
//
// The chips on a row answer "which posts". Finding out what those posts SAY meant clicking one,
// reading it, coming back, losing your place, and doing it again — one round trip per drop. The
// reader opens them underneath the row instead, oldest first, so a phrase with ninety mentions
// can be scanned in one pass.
//
// It was built for Claims and Named Entities on the Analysis page and is EXTRACTED here rather
// than copied, because Questions, Directives and Brackets need exactly the same behaviour and
// three parallel implementations is three places for the paging, the ordering and the
// highlighting to drift apart.
//
// WHAT THE CALLER OWNS, AND WHY
// ─────────────────────────────
// This hook owns loading, ordering and paging. The caller owns `readingKey` and the POST NUMBERS
// that key means — because that part is genuinely page-specific: Analysis intersects the row with
// the selected month, while the standalone pages take the row's own set. Passing the resolved
// numbers in keeps that difference where it belongs and keeps this file free of any page's rules.
//
// It lives beside the components rather than inside them so that
// ../components/InlineDropReader.tsx exports only components: a module mixing hooks and
// components breaks Fast Refresh, and the rule that says so is an error in this project.
export const READ_PAGE = 25

export interface InlineReader {
  readPosts: QPost[]
  readLoading: boolean
  readLimit: number
  readQuestions: Record<string, string[]>
  more: () => void
}

/**
 * @param readingKey  the row currently open, or null
 * @param postNums    the drops that row means. Memoise it in the caller — its identity is a dep.
 */
export function useInlineDropReader(readingKey: string | null, postNums: number[] | null): InlineReader {
  const [readPosts, setReadPosts] = useState<QPost[]>([])
  const [readLoading, setReadLoading] = useState(false)
  const [readQuestions, setReadQuestions] = useState<Record<string, string[]>>({})

  // PAGING IS KEYED TO THE ROW, NOT RESET BY AN EFFECT.
  //
  // Storing "how far into WHICH row" as one value means opening a different row is already back
  // at the first page — there is no window in which the new row renders with the old row's limit,
  // and no synchronous setState in an effect body to reset it.
  const [limitFor, setLimitFor] = useState<{ key: string | null; n: number }>({ key: null, n: READ_PAGE })
  const readLimit = limitFor.key === readingKey ? limitFor.n : READ_PAGE

  // A stable dep: the caller may hand back a fresh array with the same contents on every render.
  const numsKey = postNums ? postNums.join(',') : ''

  useEffect(() => {
    if (!readingKey || !postNums || postNums.length === 0) { setReadPosts([]); setReadQuestions({}); return }
    let cancelled = false
    setReadLoading(true)
    const wanted = new Set(postNums)
    // loadLocalData, not getPosts: getPosts pages at PAGE_SIZE, so a row whose drops sit past the
    // first page would open with most of them silently missing.
    loadLocalData()
      .then(({ posts: all }) => {
        if (cancelled) return
        // Oldest -> latest by the drop's own timestamp, with the post number breaking ties. Post
        // order and time order were checked against each other across all 4,966 drops and agree,
        // so this is the same sequence — it just says what it means rather than trusting the
        // numbering to hold.
        const list = all.filter(p => wanted.has(p.postNum))
          .sort((x, y) => (x.timestamp ?? 0) - (y.timestamp ?? 0) || x.postNum - y.postNum)
        setReadPosts(list)
        // Questions are NOT on the post record — they live in their own collection — so a card
        // rendered without them paints every layer except the blue ones. That is why drops opened
        // here once showed no questions while the same drop on /posts showed them all.
        getQuestionsForPosts(list.map(p => p.id)).then(qMap => { if (!cancelled) setReadQuestions(qMap) })
      })
      .finally(() => { if (!cancelled) setReadLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingKey, numsKey])

  return {
    readPosts,
    readLoading,
    readLimit,
    readQuestions,
    more: () => setLimitFor({ key: readingKey, n: readLimit + READ_PAGE }),
  }
}

