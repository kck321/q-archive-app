// What a navigation should do to the scroll position — the decision only, no DOM.
//
// This is a pure function so the rule can be proved directly instead of through a browser gate
// that has to win a race to observe it. The rule it encodes was learned the expensive way:
//
// PostArchive syncs its search state into the query string with
// `setUrlParams({}, { replace: true })`. With no search active that REPLACE lands on the SAME
// scroll key — /posts to /posts — yet React Router still reports navType 'REPLACE'. A Back
// restoration is typically still in flight at that moment, because the archive is re-rendering
// thousands of rows and the restore loop needs many frames to reach the target. The layout effect
// re-ran, its cleanup cancelled the in-flight restore, and the new body treated the replacement as
// "opening something new" and wrote scrollTop = 0. The scroll listener then recorded that forced
// zero over the position the reader actually had.
//
// So a REPLACE that keeps the same scroll key may not restart the page at the top, and may not
// lose a restoration that is already running. Everything else is unchanged: a same-key PUSH still
// starts at the top, a genuinely different key starts at the top by PUSH or REPLACE, and a same-key
// REPLACE with nothing pending keeps the behaviour this component always had. The narrowness is the
// point — this is not "replacements preserve scroll".

/**
 * @param {{ navType: string, key: string, previousKey: string|null,
 *           pending: {key: string, target: number}|null, saved: number|null|undefined }} input
 * @returns {{ action: 'restore'|'top', target: number, pending: {key: string, target: number}|null }}
 */
export function decideScrollAction({ navType, key, previousKey, pending, saved }) {
  const sameKey = previousKey === key
  const sameKeyReplace = navType === 'REPLACE' && sameKey

  if (navType === 'POP') {
    const target = saved ?? 0
    // A zero or missing saved position is not a restoration — it is simply the top.
    if (target > 0) return { action: 'restore', target, pending: { key, target } }
    return { action: 'top', target: 0, pending: null }
  }

  // The page replaced its own URL while we were still restoring. Same key, same reader, same
  // place: pick the target back up. `pending` is the authority here precisely because the
  // positions map may already have been written back to 0 by the forced reset.
  if (sameKeyReplace && pending && pending.key === key) {
    return { action: 'restore', target: pending.target, pending }
  }

  // Everything else starts at the top, including a same-key REPLACE with nothing pending —
  // which is exactly what this component did before, and stays that way on purpose.
  return { action: 'top', target: 0, pending: null }
}

/**
 * A restoration is finished — it settled, or it ran out of patience. Either way its target is
 * spent and must not be resumed by a later replacement.
 * @param {{key: string, target: number}|null} pending
 * @param {string} key
 * @returns {{key: string, target: number}|null}
 */
export function pendingAfterRestoreEnds(pending, key) {
  return pending && pending.key === key ? null : pending
}

// ── WHAT COUNTS AS A POSITION THE READER CHOSE ─────────────────────────────────────────────────
//
// A restoration on /pics is a CLIMB, not a jump. The saved target sits inside 1,870 tiles that
// mount 100 at a time, so the restorer writes scrollTop = target, the browser clamps it to the
// bottom of the ~9,800px that exist so far, that clamp brings the grid's sentinel into view, the
// window grows by a batch, and it writes again. Measured: ~19 cycles and 7-8 seconds to reach a
// position 150,000px down.
//
// Every one of those writes fires a scroll event, and the passive listener recorded each one as
// the reader's position. So the whole climb was being written over the target it was climbing to.
// Leave the page mid-climb and the last clamped intermediate is what persists:
//
//     reader sits at            150000
//     saved on leaving          150000   (faithful)
//     mid-climb, interrupting    55665   (600 of 1,870 tiles rendered)
//     saved after interruption   65185
//     second Back lands at       65185   — 85,000px lost
//
// And it RATCHETS. Each interrupted Back saves a smaller number, so the next one starts lower and
// has less climbing to do before the reader gives up on it — walking the saved position down
// towards the top of the grid. That is the "/pics occasionally lands at the top" report: not a
// timeout that needs to be longer, but a restoration that destroys its own target.
//
// The contract these two functions state:
//
//   1. A scroll position produced BY a restoration is not a position the reader chose. While a
//      restoration for this key is in flight, nothing is recorded.
//   2. A restoration that is interrupted before it arrives must not teach the app a smaller
//      number. The target is still the best record of where the reader was, so it is what gets
//      saved — and the next Back tries again from the truth rather than from the failure.
//
// Neither of these makes the app wait longer for anything. They say which numbers are evidence.

/**
 * Should this scroll event be recorded as the reader's position?
 * @param {{ restoringKey: string|null, key: string }} input
 * @returns {boolean}
 */
export function shouldRecordScroll({ restoringKey, key }) {
  return restoringKey !== key
}

/**
 * The position to persist for a page being left.
 *
 * @param {{ atUnmount: number, tracked: number|null|undefined, restoringTarget: number|null }} input
 *   atUnmount        scrollTop read in the layout cleanup. The incoming route's markup is already
 *                    committed, so a shorter next page has clamped this to something the reader
 *                    never chose.
 *   tracked          what the scroll listener recorded while the page was live.
 *   restoringTarget  the target of a restoration still in flight, or null.
 * @returns {number}
 */
export function positionToRecord({ atUnmount, tracked, restoringTarget }) {
  // Still climbing. The reader asked to be at `restoringTarget` and we never got them there;
  // recording where we happened to have reached would be recording our own failure as their
  // intent, and that is the ratchet.
  if (restoringTarget != null) return restoringTarget
  // Otherwise the existing rule: prefer the live reading, fall back to what was tracked when the
  // swap to a shorter page has clamped it to zero.
  if (atUnmount > 0) return atUnmount
  return tracked ?? 0
}
