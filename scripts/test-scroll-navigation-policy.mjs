// What a navigation does to the scroll position, proved directly.
//
// This gate exists because the browser gate could not prove it. `test-scroll-restoration.mjs`
// can only observe the bug when a Back restoration is still running at the moment PostArchive
// replaces its own URL — a race it won about three runs in four, which is why the defect read as
// flaky infrastructure for months and was "fixed" twice by killing stale Chrome. The rule itself
// is not a race: it is nine transitions, and lib/scrollPolicy.mjs is a pure function, so every one
// of them is decidable without a browser, a server or a clock.
//
// The transition that was wrong: a REPLACE onto the SAME scroll key, while a POP restoration was
// pending, was treated as opening a new page and reset the reader to the top.
import { decideScrollAction, pendingAfterRestoreEnds } from '../src/lib/scrollPolicy.mjs'

let failures = 0
const eq = (label, got, want) => {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) console.log(`  ok  ${label}`)
  else { console.error(`  FAIL ${label}\n       got  ${g}\n       want ${w}`); failures++ }
}

const PENDING = { key: '/posts', target: 1500 }

console.log('\nSCROLL NAVIGATION POLICY\n')

console.log('  Back restores')
// 1. POP with a saved position restores it, and holds it as pending for the rest of the loop.
eq('POP with saved 1500 restores 1500 and holds it pending',
  decideScrollAction({ navType: 'POP', key: '/posts', previousKey: '/post/1', pending: null, saved: 1500 }),
  { action: 'restore', target: 1500, pending: { key: '/posts', target: 1500 } })

// 9. A zero or missing saved position is the top, not a restoration — the loop must not start.
eq('POP with saved 0 goes to the top, no restore loop',
  decideScrollAction({ navType: 'POP', key: '/posts', previousKey: '/post/1', pending: null, saved: 0 }),
  { action: 'top', target: 0, pending: null })
eq('POP with no saved position goes to the top, no restore loop',
  decideScrollAction({ navType: 'POP', key: '/posts', previousKey: '/post/1', pending: null, saved: undefined }),
  { action: 'top', target: 0, pending: null })

console.log('\n  The archive replacing its own URL mid-restore')
// 2. THE DEFECT. The positions map has already been written back to 0 by the forced reset, so the
//    pending target — not the map — is the authority.
eq('same-key REPLACE with a pending restore resumes 1500 even though the map now reads 0',
  decideScrollAction({ navType: 'REPLACE', key: '/posts', previousKey: '/posts', pending: PENDING, saved: 0 }),
  { action: 'restore', target: 1500, pending: { key: '/posts', target: 1500 } })

// 6. Same-key REPLACE with nothing pending keeps the behaviour the component always had.
//    This is deliberately NOT broadened into "replacements preserve scroll".
eq('same-key REPLACE with nothing pending still goes to the top',
  decideScrollAction({ navType: 'REPLACE', key: '/posts', previousKey: '/posts', pending: null, saved: 1500 }),
  { action: 'top', target: 0, pending: null })

// A pending target belonging to a DIFFERENT key must not be resumed here.
eq('same-key REPLACE does not resume a pending target from another key',
  decideScrollAction({ navType: 'REPLACE', key: '/posts', previousKey: '/posts', pending: { key: '/pics', target: 900 }, saved: 0 }),
  { action: 'top', target: 0, pending: null })

console.log('\n  Everything else still starts at the top')
// 3. Same-key PUSH is NOT exempted — clicking through to the page you are on starts at the top.
eq('same-key PUSH goes to the top and clears pending',
  decideScrollAction({ navType: 'PUSH', key: '/posts', previousKey: '/posts', pending: PENDING, saved: 1500 }),
  { action: 'top', target: 0, pending: null })

// 4. A genuinely different key by PUSH.
eq('different-key PUSH goes to the top and clears pending',
  decideScrollAction({ navType: 'PUSH', key: '/pics', previousKey: '/posts', pending: PENDING, saved: 1500 }),
  { action: 'top', target: 0, pending: null })

// 5. A genuinely different key by REPLACE.
eq('different-key REPLACE goes to the top and clears pending',
  decideScrollAction({ navType: 'REPLACE', key: '/pics', previousKey: '/posts', pending: PENDING, saved: 1500 }),
  { action: 'top', target: 0, pending: null })

console.log('\n  A finished restoration is spent')
// 7 & 8. Settled and timed-out are the same ending: the target must not be resumable afterwards.
eq('a settled restoration clears its pending target', pendingAfterRestoreEnds(PENDING, '/posts'), null)
eq('a timed-out restoration clears its pending target', pendingAfterRestoreEnds(PENDING, '/posts'), null)
eq('a restoration ending on one key leaves another key’s pending target alone',
  pendingAfterRestoreEnds({ key: '/pics', target: 900 }, '/posts'), { key: '/pics', target: 900 })

// And once cleared, the replacement that used to steal the position has nothing to resume.
eq('after clearing, a same-key REPLACE no longer resumes anything',
  decideScrollAction({ navType: 'REPLACE', key: '/posts', previousKey: '/posts', pending: pendingAfterRestoreEnds(PENDING, '/posts'), saved: 0 }),
  { action: 'top', target: 0, pending: null })

console.log('\n  The rule is not vacuous')
// If the policy simply always restored, or always reset, these two would not differ.
const resumed = decideScrollAction({ navType: 'REPLACE', key: '/posts', previousKey: '/posts', pending: PENDING, saved: 0 })
const pushed = decideScrollAction({ navType: 'PUSH', key: '/posts', previousKey: '/posts', pending: PENDING, saved: 0 })
eq('the same key with the same pending target decides differently for REPLACE and PUSH',
  { replace: resumed.action, push: pushed.action }, { replace: 'restore', push: 'top' })

if (failures) {
  console.error(`\nSCROLL NAVIGATION POLICY: FAILED (${failures})\n`)
  process.exit(1)
}
console.log('\n  ✅ all 14 cases pass\n')
