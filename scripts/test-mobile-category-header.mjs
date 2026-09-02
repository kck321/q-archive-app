// ON A PHONE, THE SEARCH BOX IS THE FIRST CONTROL — NOT THE LAST THING UNDER THE TOTALS.
//
// Every category page opened with the same block: two 2xl figures, the heading, the
// repeated/asked-once line, the section ⓘ, and on Q Questions three status chips as well. On a
// 390px screen that is most of the viewport, and the search box — the one control a reader on a
// phone actually came for — sat below it. Reaching it meant scrolling past the numbers, on every
// visit, on every one of the four pages.
//
// So the detail block starts COLLAPSED at phone widths and the search sits directly under a
// one-line summary. Nothing is removed and nothing is desktop-only: a real <button> carrying
// aria-expanded opens the same block, and at md and above the block is always shown and the
// button is not rendered at all.
//
// This gate asserts BOTH halves at BOTH widths, because the failure that matters is asymmetric: a
// mobile-only change that quietly collapses the desktop header would be a regression nobody
// notices from a phone, and a desktop-safe change that never actually collapses on mobile fixes
// nothing while looking done.
//
//   node scripts/test-mobile-category-header.mjs [base]
import { launch } from './lib/browser.mjs'

const BASE = process.argv.find(a => a.startsWith('http')) ?? process.env.QDROPS_BASE ?? 'http://localhost:5173'
const FRESH = process.argv.includes('--fresh')

const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false, touch: false }

const PAGES = [
  { route: '/questions', section: 'Q Questions', heading: 'Q Questions' },
  { route: '/requests', section: 'Q Directives', heading: 'Q Directives' },
  { route: '/brackets', section: 'Q Brackets', heading: 'Q [ Brackets ]' },
  { route: '/analysis', section: 'Q ', heading: null },
]

const results = []
let pass = 0, fail = 0
const check = (label, ok, detail = '') => { results.push([label, ok, detail]); ok ? pass++ : fail++ }

// One expression, evaluated in the page, describing the header as the reader meets it.
const PROBE = `(() => {
  const vis = el => {
    if (!el) return false
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
  }
  const search = document.querySelector('input[placeholder*="earch"]')
  const toggle = [...document.querySelectorAll('button')]
    .find(b => b.hasAttribute('aria-expanded') && b.hasAttribute('aria-controls'))
  const region = toggle ? document.getElementById(toggle.getAttribute('aria-controls')) : null
  const h1 = document.querySelector('h1')
  const sr = search ? search.getBoundingClientRect() : null
  return {
    ready: !!search,
    searchVisible: vis(search),
    searchTop: sr ? Math.round(sr.top) : null,
    searchBottom: sr ? Math.round(sr.bottom) : null,
    viewportH: window.innerHeight,
    scrollY: Math.round(window.scrollY),
    toggleExists: !!toggle,
    toggleVisible: vis(toggle),
    expanded: toggle ? toggle.getAttribute('aria-expanded') : null,
    ariaLabel: toggle ? (toggle.getAttribute('aria-label') || '') : null,
    controlsResolves: !!region,
    isButton: toggle ? toggle.tagName === 'BUTTON' : null,
    regionVisible: vis(region),
    h1Visible: vis(h1),
    h1Text: h1 ? h1.textContent.trim().slice(0, 40) : null,
  }
})()`

const CLICK_TOGGLE = `(() => {
  const t = [...document.querySelectorAll('button')]
    .find(b => b.hasAttribute('aria-expanded') && b.hasAttribute('aria-controls'))
  if (!t) return false
  t.click()
  return true
})()`

const b = await launch({ mode: FRESH ? 'fresh' : 'warm' })

for (const spec of PAGES) {
  // ── PHONE ────────────────────────────────────────────────────────────────────────────────────
  {
    const p = await b.page(`${BASE}${spec.route}`, PHONE)
    const ready = await p.waitFor(`document.querySelector('input[placeholder*="earch"]') ? true : null`, { timeout: 60000 })
    check(`${spec.route} phone — page renders`, !!ready)
    const s = await p.waitForStable(PROBE, { stableFor: 2, timeout: 45000 })

    check(`${spec.route} phone — a real <button> carries aria-expanded and aria-controls`,
      s.toggleExists === true && s.isButton === true && s.controlsResolves === true)
    check(`${spec.route} phone — the toggle has an accessible label naming the section`,
      typeof s.ariaLabel === 'string' && /statistics and provenance/i.test(s.ariaLabel) && s.ariaLabel.length > 25,
      s.ariaLabel ?? '')
    check(`${spec.route} phone — the default state is COLLAPSED`,
      s.expanded === 'false' && s.regionVisible === false)
    check(`${spec.route} phone — the search box is visible`, s.searchVisible === true)

    // The whole point: the search is reachable without scrolling past the totals.
    check(`${spec.route} phone — the search box is above the fold, unscrolled`,
      s.scrollY === 0 && s.searchBottom !== null && s.searchBottom <= s.viewportH,
      `bottom ${s.searchBottom} of ${s.viewportH}px`)
    // And near the top of it, not merely inside it. The collapsed header is a few rows tall.
    check(`${spec.route} phone — the search box sits in the top third of the screen`,
      s.searchTop !== null && s.searchTop < Math.round(s.viewportH / 3),
      `top ${s.searchTop}px, third = ${Math.round(s.viewportH / 3)}px`)

    // Expanding restores everything, including the full title.
    check(`${spec.route} phone — the toggle is clickable`, (await p.evaluate(CLICK_TOGGLE)) === true)
    // BOTH attributes, not just aria-expanded. The section ⓘ (SectionInfo) is also a button
    // carrying aria-expanded, and it renders first — matching on that attribute alone read the
    // wrong control and reported a working toggle as broken. aria-controls is what makes this
    // header's toggle unambiguous, and it is the same predicate PROBE uses.
    const open = await p.waitFor(`(() => {
      const t = [...document.querySelectorAll('button')]
        .find(b => b.hasAttribute('aria-expanded') && b.hasAttribute('aria-controls'))
      return t && t.getAttribute('aria-expanded') === 'true' ? true : null
    })()`, { timeout: 8000 })
    check(`${spec.route} phone — aria-expanded flips to true`, open === true)
    const s2 = await p.waitForStable(PROBE, { stableFor: 2, timeout: 15000 })
    check(`${spec.route} phone — the statistics become visible on expand`, s2.regionVisible === true)
    check(`${spec.route} phone — the full title is inside the expanded region`,
      s2.h1Visible === true, s2.h1Text ?? '')
    check(`${spec.route} phone — the search box stays visible while expanded`, s2.searchVisible === true)

    // Collapsing again returns to the compact row.
    await p.evaluate(CLICK_TOGGLE)
    const s3 = await p.waitForStable(PROBE, { stableFor: 2, timeout: 15000 })
    check(`${spec.route} phone — collapsing restores the compact header`,
      s3.expanded === 'false' && s3.regionVisible === false && s3.searchVisible === true)

    await p.close()
  }

  // ── DESKTOP — must be pixel-for-pixel the page it always was ────────────────────────────────
  {
    const p = await b.page(`${BASE}${spec.route}`, DESKTOP)
    await p.waitFor(`document.querySelector('input[placeholder*="earch"]') ? true : null`, { timeout: 60000 })
    const s = await p.waitForStable(PROBE, { stableFor: 2, timeout: 45000 })

    check(`${spec.route} desktop — the statistics are visible with no interaction`,
      s.regionVisible === true)
    check(`${spec.route} desktop — the full title is visible`, s.h1Visible === true, s.h1Text ?? '')
    check(`${spec.route} desktop — the mobile toggle is NOT shown`, s.toggleVisible === false)
    check(`${spec.route} desktop — the search box is visible`, s.searchVisible === true)
    if (spec.heading) {
      check(`${spec.route} desktop — the heading is unchanged`,
        (s.h1Text ?? '').startsWith(spec.heading), s.h1Text ?? '')
    }
    await p.close()
  }
}

await b.close()

console.log(`\nMOBILE CATEGORY HEADER — ${BASE}\n`)
for (const [label, ok, detail] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(70)}${detail ? `  — ${detail}` : ''}`)
console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) {
  console.error('\n[X] the category header is not behaving as specified at one of the two widths.\n')
  process.exit(1)
}
console.log('')
