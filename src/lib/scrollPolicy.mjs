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
