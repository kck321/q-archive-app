// The abbreviation/sentence-boundary repair, shared by every materialiser that owns a span.
//
// One defect, one record, one applier. A sentence splitter that ends a sentence at "." cuts every
// "Mr. President", "Army Lt. Gen.", "U.S. Senate", "Harris v. McRae" and "GOOD vs. EVIL." in half,
// so the certified span stops mid-name and paints only that far. It hit Claims, Context, Directives
// and Questions alike, which is why this lives in lib/ rather than inside whichever materialiser
// noticed it first.
//
// Two operations, and BOTH are required wherever one is:
//
//   repair    the truncated span is replaced by the full one, taken from the drop
//   withdraw  the tail the same splitter certified separately is absorbed into the repaired span
//
// Repairing without withdrawing leaves one sentence certified twice — once whole, once as a
// fragment — which is the same-category overlap the owner ruled against on 2026-08-21. A caller
// that repairs and forgets to withdraw is the failure this module exists to make impossible, so
// `applyTo` does both in one pass and reports what it did.
import fs from 'node:fs'
import path from 'node:path'

const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Load the canonical record. Returns null when the artifact is absent, so a fresh clone still runs. */
export function loadAbbrevRepairs(root) {
  const file = path.join(root, 'audit', 'abbreviation-span-repairs.json')
  if (!fs.existsSync(file)) return null
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  const repairs = new Map()
  for (const r of doc.repairs ?? []) repairs.set(`${r.category}|${r.postNum}|${norm(r.truncated)}`, r.full)
  const withdrawn = new Set((doc.withdrawn ?? []).map(w => `${w.category}|${w.postNum}|${norm(w.fragment)}`))
  const countFor = (list, cat) => (list ?? []).filter(x => x.category === cat).length
  return {
    doc,
    /** Every recorded key for a category, so a caller can tell "absent" from "skipped". */
    keysFor: cat => ({
      repairs: new Set((doc.repairs ?? []).filter(r => r.category === cat).map(r => `${r.postNum}|${norm(r.truncated)}`)),
      withdrawals: new Set((doc.withdrawn ?? []).filter(w => w.category === cat).map(w => `${w.postNum}|${norm(w.fragment)}`)),
    }),
    /** The full span for a truncated one, or null. */
    fullFor: (category, postNum, text) => repairs.get(`${category}|${postNum}|${norm(text)}`) ?? null,
    /** Is this span a tail that the repaired span now contains? */
    isWithdrawn: (category, postNum, text) => withdrawn.has(`${category}|${postNum}|${norm(text)}`),
    expected: cat => ({ repairs: countFor(doc.repairs, cat), withdrawals: countFor(doc.withdrawn, cat) }),
  }
}

/**
 * Repair and withdraw one category's spans, in place, over a list of {postNum, texts[]} holders.
 *
 * `read` returns the array to fix for a holder; the array is rewritten in place. Returns what
 * happened so the caller can assert it, because a half-applied correction is worse than none: the
 * truncated span stays certified and nothing says so.
 */
export function applyAbbrevRepairs(repairs, category, holders, read) {
  if (!repairs) return { repaired: 0, withdrawn: 0, absentRepairs: 0, absentWithdrawals: 0, ok: true }
  let repaired = 0, withdrawn = 0, merged = 0
  // A RECORDED SPAN THAT IS NOT HERE AT ALL IS NOT A SKIPPED REPAIR.
  //
  // The unhighlighted-queue rulings PROMOTE units out of Context - a ruled line is no longer
  // "reviewed, and in no semantic category" - so 12 of the 28 Context repairs describe spans this
  // section no longer holds. Counting those as unapplied made the guard refuse a bundle in which
  // nothing was left truncated: the guard crying wolf about its own success.
  //
  // So the two are separated. `repaired` is what was fixed; `absentRepairs` is what was not there
  // to fix. The caller states BOTH numbers, so a span that vanished for some other reason still
  // fails rather than being absorbed by a tolerance.
  const wantKeys = repairs.keysFor(category)
  const seenRepairs = new Set(), seenWithdrawals = new Set()
  for (const h of holders) {
    const arr = read(h)
    if (!Array.isArray(arr) || !arr.length) continue
    // IN-POST REPEATS ARE REAL AND MUST SURVIVE. Q writes "Fantasy land." four times in #111 and
    // all four are certified. A blanket dedupe here collapsed 48 of them and took the archive's
    // in-post repeat count from 50 to 2 — the arrays are occurrence lists, not sets.
    //
    // So only a duplicate the REPAIR ITSELF created is dropped: a truncated span that, once
    // extended, becomes a wording this post already carried correctly. Anything that was already
    // there twice stays there twice.
    const before = new Set(arr.map(norm))
    const out = []
    for (const t of arr) {
      if (repairs.isWithdrawn(category, h.postNum, t)) { withdrawn++; seenWithdrawals.add(`${h.postNum}|${norm(t)}`); continue }
      const full = repairs.fullFor(category, h.postNum, t)
      if (full && full !== t) {
        repaired++
        seenRepairs.add(`${h.postNum}|${norm(t)}`)
        if (before.has(norm(full))) { merged++; continue }
        out.push(full)
        continue
      }
      out.push(t)
    }
    arr.length = 0
    arr.push(...out)
  }
  let absentRepairs = 0, absentWithdrawals = 0
  for (const k of wantKeys.repairs) if (!seenRepairs.has(k)) absentRepairs++
  for (const k of wantKeys.withdrawals) if (!seenWithdrawals.has(k)) absentWithdrawals++
  return { repaired, withdrawn, merged, absentRepairs, absentWithdrawals }
}

/** Refuse rather than under-apply — see the module note. */
export function assertAbbrevApplied(repairs, category, got, label, absent = { repairs: 0, withdrawals: 0 }) {
  if (!repairs) return
  const want = repairs.expected(category)
  // `absent` is how many recorded spans this section no longer holds - a STATED number, not a
  // tolerance, so an unexpected disappearance still fails. See applyAbbrevRepairs.
  const okRepairs = got.repaired === want.repairs - absent.repairs && (got.absentRepairs ?? 0) === absent.repairs
  const okWithdrawals = got.withdrawn >= want.withdrawals - absent.withdrawals && (got.absentWithdrawals ?? 0) <= absent.withdrawals
  if (!okRepairs || !okWithdrawals) {
    console.error(`\n${label}: abbreviation repair is half-applied.`)
    console.error(`   repairs    recorded ${want.repairs}, applied ${got.repaired}, not present ${got.absentRepairs ?? 0} (expected ${absent.repairs})`)
    console.error(`   withdrawals recorded ${want.withdrawals}, applied ${got.withdrawn}, not present ${got.absentWithdrawals ?? 0} (expected ${absent.withdrawals})`)
    console.error('   A truncated span left certified says nothing is wrong. Refusing to write.\n')
    process.exit(1)
  }
}
