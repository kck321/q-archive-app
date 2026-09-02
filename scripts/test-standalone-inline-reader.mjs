// QUESTIONS, DIRECTIVES AND BRACKETS READ LIKE CLAIMS AND NAMED ENTITIES DO.
//
// Clicking the phrase itself opens every drop containing it, underneath the row, oldest first,
// paged. Analysis has had this since the inline reader was built; the three standalone sections
// showed the same phrase as inert text, so the only way to find out what those drops said was to
// click a chip, read one post, come back and lose your place.
//
// The machinery is EXTRACTED, not copied — one lib/inlineDropReader.ts and one
// components/InlineDropReader.tsx serve all four pages. That is exactly why this gate matters:
// with one implementation, a regression is a regression on every section at once, and the
// existing Analysis gate only watches Analysis.
//
// Run at both widths. The reader opens inside a row, and a row is laid out differently at 390px
// (stacked) than at 1280px (two columns) — "it opened" on a desktop is not evidence about a phone.
//
//   node scripts/test-standalone-inline-reader.mjs [base] [--fresh]
import { launch, ROWS_READY } from './lib/browser.mjs'

const BASE = process.argv.find(a => a.startsWith('http')) ?? process.env.QDROPS_BASE ?? 'http://localhost:5173'
const FRESH = process.argv.includes('--fresh')

const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false, touch: false }

// Each page, and the search term used to prove the filter survives the reader.
const PAGES = [
  { route: '/questions', name: 'Questions', search: 'coincidence' },
  { route: '/requests', name: 'Directives', search: 'expand' },
  { route: '/brackets', name: 'Brackets', search: 'RR' },
]

const results = []
let pass = 0, fail = 0
const check = (label, ok, detail = '') => { results.push([label, ok, detail]); ok ? pass++ : fail++ }

// data-read-phrase, not "a button with aria-expanded". The first version of this selector also
// matched the sidebar's Q Extras disclosure — which carries aria-expanded and no aria-controls —
// so the gate clicked the sidebar, saw no drops, and reported all three sections broken. The
// control says what it is.
const PHRASE = `[...document.querySelectorAll('[data-read-phrase]')]`

const PROBE = `(() => {
  const panel = document.querySelector('[data-drop-reader]')
  const cards = panel ? [...panel.querySelectorAll('div.bg-q-panel')] : []
  const nums = cards.map(c => {
    const m = (c.textContent || '').match(/#(\\d{1,5})/)
    return m ? Number(m[1]) : null
  }).filter(n => n !== null)
  const readBtn = [...document.querySelectorAll('button')]
    .find(b => /read \\d[\\d,]* drop/.test(b.textContent || ''))
  const closeBtn = [...document.querySelectorAll('button')]
    .find(b => /close drops/.test(b.textContent || ''))
  const more = [...document.querySelectorAll('button')]
    .find(b => /^\\+ \\d+ more/.test((b.textContent || '').trim()))
  return {
    panelOpen: !!panel,
    cardCount: cards.length,
    nums: nums.slice(0, 40),
    hasReadButton: !!readBtn,
    readLabel: readBtn ? readBtn.textContent.trim() : null,
    hasCloseButton: !!closeBtn,
    moreLabel: more ? more.textContent.trim() : null,
    searchValue: (document.querySelector('input[placeholder*="earch"]') || {}).value ?? null,
    expandedPhrases: ${PHRASE}.filter(b => b.getAttribute('aria-expanded') === 'true').length,
  }
})()`

const b = await launch({ mode: FRESH ? 'fresh' : 'warm' })

for (const spec of PAGES) {
  for (const [widthName, vp] of [['desktop', DESKTOP], ['phone', PHONE]]) {
    const tag = `${spec.name} ${widthName}`
    const p = await b.page(`${BASE}${spec.route}`, vp)
    const ready = await p.waitFor(ROWS_READY, { timeout: 90000 })
    check(`${tag} — rows render`, !!ready)
    if (!ready) { await p.close(); continue }

    // ── The search/filter state that must survive the reader ────────────────────────────────
    const typed = await p.evaluate(`(() => {
      const i = document.querySelector('input[placeholder*="earch"]')
      if (!i) return null
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(i, ${JSON.stringify(spec.search)})
      i.dispatchEvent(new Event('input', { bubbles: true }))
      return i.value
    })()`)
    check(`${tag} — the search box accepts a term`, typed === spec.search, String(typed))
    await p.waitForStable(`document.querySelectorAll('div.bg-q-panel').length`, { stableFor: 2, timeout: 30000 })

    // ── The phrase itself is the control ────────────────────────────────────────────────────
    const phrase = await p.evaluate(`(() => {
      const b = ${PHRASE}[0]
      return b ? { text: b.textContent.trim().slice(0, 60), expanded: b.getAttribute('aria-expanded') } : null
    })()`)
    check(`${tag} — the phrase is a real button with aria-expanded`,
      !!phrase && phrase.expanded === 'false', phrase ? phrase.text : 'MISSING')

    const before = await p.evaluate(PROBE)
    check(`${tag} — a "read N drops" control is offered too`, before.hasReadButton, before.readLabel ?? '')
    check(`${tag} — nothing is open yet`, before.panelOpen === false)

    // ── Clicking the phrase opens the drops ─────────────────────────────────────────────────
    const promised = before.readLabel ? Number((before.readLabel.match(/read ([\d,]+) drop/) ?? [])[1]?.replace(/,/g, '')) : null
    await p.evaluate(`(() => { ${PHRASE}[0].click(); return true })()`)
    const opened = await p.waitFor(`document.querySelector('[data-drop-reader] div.bg-q-panel') ? true : null`, { timeout: 60000 })
    check(`${tag} — clicking the phrase opens the drops inline`, opened === true)

    const open = await p.waitForStable(PROBE, { stableFor: 2, timeout: 45000 })
    check(`${tag} — the phrase reports itself expanded`, open.expandedPhrases === 1, String(open.expandedPhrases))
    check(`${tag} — drop bodies are rendered`, open.cardCount > 0, `${open.cardCount} cards`)
    check(`${tag} — the control flips to "close drops"`, open.hasCloseButton === true)

    // ── Oldest first ────────────────────────────────────────────────────────────────────────
    const ascending = open.nums.every((n, i) => i === 0 || n >= open.nums[i - 1])
    check(`${tag} — the drops are oldest first`, open.nums.length > 0 && ascending,
      open.nums.slice(0, 8).join(', '))

    // ── The right drops ─────────────────────────────────────────────────────────────────────
    // The row promised N; the panel must be showing that row's drops, not some other row's.
    check(`${tag} — the panel holds the row's own drops`,
      promised !== null && open.cardCount > 0 && open.cardCount <= promised,
      `${open.cardCount} of ${promised} promised`)

    // ── Large result sets page rather than mount everything ─────────────────────────────────
    if (promised !== null && promised > 25) {
      check(`${tag} — a large row does NOT render every drop at once`,
        open.cardCount <= 25, `${open.cardCount} rendered of ${promised}`)
      check(`${tag} — the remainder is offered a page at a time`,
        /^\+ \d+ more/.test(open.moreLabel ?? ''), open.moreLabel ?? 'no "+ more" control')
    } else {
      check(`${tag} — row is small (${promised}), paging not exercised`, true)
    }

    // ── The search state survived ───────────────────────────────────────────────────────────
    check(`${tag} — the search term is still in the box`, open.searchValue === spec.search, String(open.searchValue))

    // ── Close restores the compact row ──────────────────────────────────────────────────────
    await p.evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => /close drops/.test(x.textContent || ''))
      if (b) { b.click(); return true }
      ${PHRASE}.find(x => x.getAttribute('aria-expanded') === 'true')?.click()
      return true
    })()`)
    const closed = await p.waitForStable(PROBE, { stableFor: 2, timeout: 20000 })
    check(`${tag} — closing removes the drops`, closed.panelOpen === false && closed.cardCount === 0)
    check(`${tag} — the compact row is back`, closed.hasReadButton === true && closed.hasCloseButton === false)
    check(`${tag} — the phrase reports itself collapsed`, closed.expandedPhrases === 0)
    check(`${tag} — the search term survived the close too`, closed.searchValue === spec.search, String(closed.searchValue))

    await p.close()
  }
}

await b.close()

console.log(`\nSTANDALONE INLINE READER — ${BASE}\n`)
for (const [label, ok, detail] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(66)}${detail ? `  — ${detail}` : ''}`)
console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) {
  console.error('\n[X] the inline drop reader is not behaving the same way on all three standalone sections.\n')
  process.exit(1)
}
console.log('')
// EXIT EXPLICITLY, EVEN ON SUCCESS.
//
// The browser harness keeps a warm Chrome and its debugging sockets alive on purpose, so a
// gate that merely falls off the end never drains its event loop and never exits. Inside
// validate.mjs that is indistinguishable from a hung test: this gate printed '108 passed, 0
// failed' and then held the whole 38-step suite for an hour. Every other browser gate in
// scripts/ ends this way for the same reason.
process.exit(0)
