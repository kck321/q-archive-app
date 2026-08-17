// Category ordering: the number on the badge is the number that sorts the row.
//
//   node scripts/test-category-order.mjs [baseUrl] [--fresh]
//
// THE DEFECT THIS EXISTS TO PREVENT. The badge unioned an entity's alias spellings; the sort key
// used the row's own post list; nothing reconciled them. Rod Rosenstein printed "×96 posts" and sat
// between a 5-post row and a 4-post row. Australia's 20 sat below rows with 6. The column was
// ordered by a quantity the reader could not see, so it looked broken while every count on it was
// individually defensible.
//
// Owner ruling, 2026-08-17: sort by distinct posts descending, ties to the oldest drop ascending,
// then the label for determinism — and the sorting value must be the badge value.
//
// Read from the RENDERED page, never from the artifacts. The artifacts were never wrong; the
// disagreement was between two things the component computed, and only the DOM shows both at once.
import { launch } from './lib/browser.mjs'

const args = process.argv.slice(2)
const mode = args.includes('--fresh') ? 'fresh' : 'warm'
const BASE = args.find(a => a.startsWith('http')) ?? 'http://localhost:5173'

// Every category the archive lists, so a rule proved on Entities cannot quietly fail on Claims.
const TABS = ['namedEntities', 'claims', 'predictions', 'themes', 'emphasis', 'verificationHooks']

let failed = 0
const check = (ok, label, got) => { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} ${got}`) }

console.log(`\nCATEGORY ORDERING  (${mode})\n`)
const browser = await launch({ mode })

/**
 * Every rendered row, in screen order, with the three things that must agree:
 * the rank, the badge count, and the post chips actually under it.
 */
const READ_ROWS = `(() => {
  // NO BACKSLASH ESCAPES IN HERE. This is a template literal, so \d arrives as d and the chip
  // regex silently matched nothing. Plain string tests instead of regexes, for the same reason the
  // multi-word gate forbids backticks in its page expressions.
  const HASH = String.fromCharCode(35)
  const TIMES = String.fromCharCode(215)
  const digits = t => { const n = Number(t); return Number.isFinite(n) ? n : null }
  const rows = []
  for (const c of document.querySelectorAll('div.bg-q-panel')) {
    const labelEl = c.querySelector('p button')
    if (!labelEl) continue
    const badgeEl = [...c.querySelectorAll('span')].find(s => {
      const t = s.textContent.trim()
      return t.charAt(0) === TIMES && t.slice(-5) === 'posts'
    })
    // The badge is suppressed at one post, so its absence means exactly one.
    //
    // A SOURCE-ONLY ROW COUNTS LINKS: its badge reads "x9 source posts", because those drops linked
    // the material rather than naming it. Stripping only the word "posts" left "9 source" and
    // Number() returned NaN, so the nine source-only rows with more than one chip read as a badge of
    // null and every ordering assertion downstream failed on them.
    const badge = badgeEl
      ? digits(badgeEl.textContent.replace(TIMES, '').replace('source', '').replace('posts', '').trim())
      : 1
    const chips = []
    for (const a of c.querySelectorAll('a[href*="/post/"]')) {
      // A chip that repeats inside its drop renders an inline badge, so the text is #780x2 rather
      // than #780. Take the leading run of digits; Number('780x2') is NaN and silently dropped two
      // chips per row, which read as the badge over-claiming.
      const t = a.textContent.trim()
      if (t.charAt(0) !== HASH) continue
      let d = ''
      for (const ch of t.slice(1)) { if (ch >= '0' && ch <= '9') d += ch; else break }
      const n = digits(d)
      if (n !== null) chips.push(n)
    }
    const rankEl = c.querySelector('[title*="Rank across"]')
    const readBtn = [...c.querySelectorAll('button')].find(b => b.textContent.indexOf('read ') > -1 && b.textContent.indexOf(' drops') > -1)
    const readN = readBtn ? digits(readBtn.textContent.split('read ')[1].split(' drops')[0]) : null
    // Chips are capped on screen; a "+N more" control means the row shows a prefix of its set.
    const capped = c.innerText.indexOf(' more') > -1
    rows.push({ badge, chips, capped, rank: rankEl ? digits(rankEl.textContent.trim()) : null,
      label: labelEl.textContent.trim(), readN })
  }
  return JSON.stringify(rows)
})()`

for (const tab of TABS) {
  const page = await browser.page(`${BASE}/analysis?tab=${tab}`)
  const ready = await page.waitFor(`document.querySelectorAll('div.bg-q-panel').length > 3`, { timeout: 120000 })
  if (!ready) { check(false, `${tab} — the list renders`, 'no rows'); await page.close(); continue }
  // The list virtualises its first page in; give the frequency index time to land.
  await new Promise(r => setTimeout(r, 3500))
  const rows = JSON.parse(await page.evaluate(READ_ROWS)).filter(r => r.chips.length || r.badge > 1)
  await page.close()

  if (rows.length < 5) { check(false, `${tab} — enough rows to prove an order`, `${rows.length}`); continue }

  console.log(`  ${tab}  (${rows.length} rows read)`)

  // 1. THE BADGE IS THE CHIP COUNT. Where a row shows all of its chips, the two must be equal —
  //    a row capped by the "show fewer" control shows a prefix, never more than it claims.
  const overClaimed = rows.filter(r => r.chips.length > r.badge)
  check(overClaimed.length === 0, 'no row shows more chips than its badge claims',
    overClaimed.length ? `${overClaimed.length}: ${overClaimed.slice(0, 3).map(r => `${r.label}=${r.badge}/${r.chips.length}`).join(' ')}` : `${rows.length} rows`)
  // Where the row is NOT capped, the badge and the chips must be exactly equal — that is the
  // ruling's core promise, that the number shown is the set shown.
  const uncapped = rows.filter(r => !r.capped)
  const unequal = uncapped.filter(r => r.chips.length !== r.badge)
  check(unequal.length === 0, 'an uncapped row shows exactly as many chips as it claims',
    unequal.length ? unequal.slice(0, 3).map(r => `${r.label} ${r.badge}!=${r.chips.length}`).join(' ') : `${uncapped.length} uncapped rows`)

  // 2. NO POST COUNTED TWICE. An alias union that double-counts inflates the badge and the rank
  //    together, so it cannot be caught by comparing them to each other.
  const dupes = rows.filter(r => new Set(r.chips).size !== r.chips.length)
  check(dupes.length === 0, 'no row lists the same post twice',
    dupes.length ? dupes.slice(0, 3).map(r => r.label).join(', ') : 'all distinct')

  // 3. "read N drops" PROMISES THE SAME N.
  const mismatchRead = rows.filter(r => r.readN !== null && r.readN !== r.badge)
  check(mismatchRead.length === 0, 'the reader opens exactly the badge count',
    mismatchRead.length ? mismatchRead.slice(0, 3).map(r => `${r.label} ${r.badge}!=${r.readN}`).join(' ') : 'agreed')

  // 4. MONOTONIC. The whole point: every row's count is >= the row below it.
  const inversions = rows.filter((r, i) => i > 0 && r.badge > rows[i - 1].badge)
  check(inversions.length === 0, 'counts never increase going down the list',
    inversions.length ? `${inversions.length}, first: ${inversions[0].label} (${inversions[0].badge}) below ${rows[rows.indexOf(inversions[0]) - 1].badge}` : 'monotonic')

  // 5. TIES GO TO THE OLDEST DROP.
  const tieBreaks = []
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i]
    if (a.badge !== b.badge || !a.chips.length || !b.chips.length) continue
    if (Math.min(...a.chips) > Math.min(...b.chips)) tieBreaks.push(`${a.label}(#${Math.min(...a.chips)}) before ${b.label}(#${Math.min(...b.chips)})`)
  }
  check(tieBreaks.length === 0, 'equal counts are ordered oldest drop first',
    tieBreaks.length ? tieBreaks.slice(0, 2).join(' · ') : 'oldest first')

  // 6. THE RANK MATCHES THE ORDER IT IS PRINTED IN.
  const ranked = rows.filter(r => r.rank !== null)
  const outOfStep = ranked.filter((r, i) => i > 0 && r.rank <= ranked[i - 1].rank)
  check(outOfStep.length === 0, 'printed ranks ascend with the rendered order',
    outOfStep.length ? `${outOfStep.length} out of step` : `${ranked.length} ranked`)
}

// ── the reported regression, by name ────────────────────────────────────────
//
// The rows from the owner's screenshot. Australia was below rows with 6 posts; these assert the
// relationship rather than the exact figures, because a certified recount may move a count and
// must not be able to quietly satisfy this test by moving two of them together.
console.log('')
{
  const page = await browser.page(`${BASE}/analysis?tab=namedEntities`)
  await page.waitFor(`document.querySelectorAll('div.bg-q-panel').length > 3`, { timeout: 120000 })
  await new Promise(r => setTimeout(r, 3500))
  // The list pages at 150; Scaramucci's 7 posts sit past the first page. Show everything, or the
  // check would report a paging boundary as an ordering failure.
  await page.evaluate(`(() => { const a = [...document.querySelectorAll('button,a')]
    .find(e => e.textContent.trim().toLowerCase() === 'show all'); if (a) a.click(); return 'clicked' })()`)
  await new Promise(r => setTimeout(r, 6000))
  const rows = JSON.parse(await page.evaluate(READ_ROWS))
  await page.close()
  const at = name => rows.findIndex(r => r.label.toLowerCase() === name.toLowerCase())
  const of = name => { const i = at(name); return i < 0 ? null : rows[i] }

  const order = ['Australia', 'Military Intelligence', 'MI6', 'Scaramucci']
  const idx = order.map(at)
  check(idx.every(i => i >= 0), 'the reported rows are all on the first page', idx.join(','))
  check(idx.every((v, i) => i === 0 || v > idx[i - 1]),
    'Australia > Military Intelligence > MI6 > Scaramucci', order.map(n => `${n}=${of(n)?.badge}`).join(' '))

  for (const [big, small] of [['Australia', 'Scaramucci'], ['MI6', 'Constitution']]) {
    const a = of(big), b = of(small)
    if (a && b) check(a.badge > b.badge && at(big) < at(small), `${big} outranks ${small} and sits above it`, `${a.badge} vs ${b.badge}`)
  }
}

// ── determinism ─────────────────────────────────────────────────────────────
//
// The comparator ends in a label sort for exactly this reason: two rows with the same count and the
// same oldest drop must not swap places between loads. A list that reorders on refresh cannot be
// cited, and a reader has no way to tell it from a data change.
console.log('')
{
  const readOnce = async () => {
    const page = await browser.page(`${BASE}/analysis?tab=namedEntities`)
    await page.waitFor(`document.querySelectorAll('div.bg-q-panel').length > 3`, { timeout: 120000 })
    await new Promise(r => setTimeout(r, 3500))
    const rows = JSON.parse(await page.evaluate(READ_ROWS))
    await page.close()
    return rows.map(r => `${r.label}:${r.badge}`).join('|')
  }
  const a = await readOnce()
  const b = await readOnce()
  check(a === b && a.length > 0, 'the same order is produced on a second load', a === b ? 'identical' : 'REORDERED')
}

console.log(`\n  ${failed ? `❌ ${failed} failed` : '✅ every category is ordered by the number it displays'}\n`)
process.exit(failed ? 1 : 0)
