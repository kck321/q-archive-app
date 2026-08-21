// Where a ">>NNNNNNN" pointer actually goes.
//
// Q cites the board post he is answering, 1,643 times across 1,591 drops, and every one of them
// rendered as inert grey text. The reader could see that a drop was a reply and had no way to get
// to what it replied to — even when the target is another drop in this very archive, or a quoted
// post already displayed a few hundred pixels further down the same page.
//
// Two kinds of target, and they deserve different links:
//
//   410 pointers name a Q DROP WE HOLD. The board id is the fragment on the drop's own board
//       link, so it resolves to a post number and the pointer becomes internal navigation.
//   the rest name an ANON POST, recovered by scrape-references.mjs and rendered underneath the
//       drop by QuotedPosts. Those get an in-page anchor to that block rather than a link to
//       8kun, which 302s every one of these old thread ids to its index.
//
// Anything in neither set stays plain text. A dead link is worse than no link: it tells the
// reader something is reachable and then wastes the click proving otherwise.

interface RefTarget { postNum?: number; quoted?: boolean }

let ownDrop = new Map<string, number>()
let quotedIds = new Set<string>()

interface IndexablePost {
  postNum: number
  link?: string
  quotedPosts?: { boardId?: string }[]
}

/**
 * Build the index once, from the loaded store.
 *
 * Called after the collections land rather than lazily per render: resolving a pointer is on the
 * render path of every drop body, and rebuilding a 5,000-entry map there would be paid thousands
 * of times a page.
 */
export function buildRefIndex(posts: IndexablePost[]): void {
  const drops = new Map<string, number>()
  const quoted = new Set<string>()
  for (const p of posts) {
    const m = (p.link ?? '').match(/#(\d+)\s*$/)
    if (m && !drops.has(m[1])) drops.set(m[1], p.postNum)
    for (const q of p.quotedPosts ?? []) if (q.boardId) quoted.add(String(q.boardId))
  }
  ownDrop = drops
  quotedIds = quoted
}

/** The target for a board id, or null when we have nothing honest to point at. */
export function resolveRef(boardId: string): RefTarget | null {
  const postNum = ownDrop.get(boardId)
  if (postNum !== undefined) return { postNum }
  if (quotedIds.has(boardId)) return { quoted: true }
  return null
}

/** Test seam — the browser gates assert against the same numbers the app resolves. */
export function refIndexSize(): { drops: number; quoted: number } {
  return { drops: ownDrop.size, quoted: quotedIds.size }
}
