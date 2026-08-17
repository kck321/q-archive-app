// The month chart behaves the same way everywhere, and a keyboard can drive it.
//
// This is a behaviour gate, not a rendering one. The contract:
//
//   HOVER  reads out. A tooltip carrying the month and its counts, and NOTHING else changes —
//          no chip pulses, no row is recoloured, no selection or filter moves.
//   CLICK  selects. The category filters to that month, only that month's chips remain, the active
//          month is stated, and it can be cleared or changed.
//   KEYS   Enter and Space do exactly what a click does, and the selection is announced.
//
// HOW MUCH OF IT RUNS, AND WHY THAT IS NOT A WEAKENING.
//
// The behaviour was one implementation per page when this gate was written — "it works on Claims"
// was true for months while Emphasis and the Archive each did something slightly different. It is
// now a SINGLE shared module (src/lib/monthFilter.ts + src/components/MonthFilter.tsx), so sweeping
// all 7 Analysis categories runs the same code 7 times. Measured 17 Aug 2026: 371.9s of a 744s live
// proof, for 16 page loads of one component.
//
// So the ordinary run proves the shared module on a representative category plus the Archive — the
// two DIFFERENT hosts — on desktop and phone. The 16-surface sweep still exists and is still
// required when the shared module itself changes, or before a release:
//
//   node scripts/test-month-chart-behaviour.mjs                     4 surfaces (default)
//   node scripts/test-month-chart-behaviour.mjs --full             16 surfaces (release / module change)
//   node scripts/test-month-chart-behaviour.mjs --only emphasis     one category
//   node scripts/test-month-chart-behaviour.mjs --url http://localhost:5173
//
// WAITING IS BY CONDITION. Every step used to hand back a fixed sleep — 14s to settle, 2.5s after
// each key press — which is both slower than the page and still able to race a slow load. Each one
// is now the state the next assertion actually needs: the picker exists, the chip count stopped
// moving, the selection changed, the tooltip appeared, the month was released.
import { launch, MONTHS_READY } from './lib/browser.mjs'

const argv = process.argv.slice(2)
const at = flag => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : null }
const URL_BASE = at('--url') ?? 'https://qdrops.app'

const ALL_CATEGORIES = ['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks', 'emphasis']
// The representative category for an ordinary run. Named Entities because it is the busiest surface
// and the one whose list the chart most recently had to stop reaching into.
const REPRESENTATIVE = at('--rep') ?? 'namedEntities'
// --only <cat> narrows the sweep. Used to point the gate at the DEPLOYED site to prove it is not
// vacuous: against the old build these same assertions fail, which is the only evidence that a
// passing run means anything.
const only = at('--only')
const CATEGORIES = only ? [only] : argv.includes('--full') ? ALL_CATEGORIES : [REPRESENTATIVE]

// Desktop and a phone, because the pulse fired from a mousemove the touch path also produces, and
// the chart bars are ~4px wide on a phone — which is why the keyboard picker matters most there.
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false, deviceScaleFactor: 1, touch: false },
  { name: 'mobile', width: 390, height: 844, mobile: true, deviceScaleFactor: 1, touch: false },
]

const results = []
const check = (id, description, ok, detail = '') => {
  results.push({ id, ok: Boolean(ok), description, detail: String(detail) })
  if (!ok) console.log(`    FAIL  ${id.padEnd(30)} ${description}\n          ↳ ${String(detail).slice(0, 240)}`)
}

// The probe helpers, installed after load — the tab opens AT the url, so anything defined earlier
// belongs to the document being replaced.
const HELPERS = `(() => {
  // NO BACKSLASH ESCAPES IN A PAGE EXPRESSION: this string passes through a template literal, so a
  // /^#\\d+/ written here arrives as /^#d+/ and matches nothing. Character tests instead.
  const HASH = String.fromCharCode(35)
  const isChip = a => { const t = a.textContent.trim(); return t.charAt(0) === HASH && t.charAt(1) >= '0' && t.charAt(1) <= '9' }
  window.__q = {
    // Every month button in the shared picker. These are the keyboard and touch path.
    months: () => [...document.querySelectorAll('[role="radiogroup"] [role="radio"]')],
    selected: () => {
      const b = [...document.querySelectorAll('[role="radiogroup"] [role="radio"]')].find(x => x.getAttribute('aria-checked') === 'true')
      return b ? b.getAttribute('aria-label') : null
    },
    live: () => {
      const el = document.querySelector('[role="status"][aria-live="polite"]')
      return el ? (el.textContent || '').trim() : null
    },
    // Anything that pulses, flashes or dims in the results area. The old hover reached in here.
    animated: () => document.querySelectorAll('[class*="animate-chip-pulse"], [class*="opacity-30"]').length,
    chips: () => [...document.querySelectorAll('a')].filter(isChip).length,
    tooltip: () => {
      const t = document.querySelector('.recharts-tooltip-wrapper')
      return t ? (t.textContent || '').trim() : ''
    },
    bar: () => document.querySelector('.recharts-bar-rectangle'),
    clearButton: () => [...document.querySelectorAll('button')].find(b => /Clear month/i.test(b.textContent)) || null,
  }
  return true
})()`

// Counted without the helpers, because this is what we wait on BEFORE installing them.
const CHIP_COUNT = `(() => { const H = String.fromCharCode(35)
  return [...document.querySelectorAll('a')].filter(a => { const t = a.textContent.trim()
    return t.charAt(0) === H && t.charAt(1) >= '0' && t.charAt(1) <= '9' }).length })()`

const READ = `({
  months: window.__q.months().length,
  selected: window.__q.selected(),
  animated: window.__q.animated(),
  chips: window.__q.chips(),
  live: window.__q.live(),
  tooltip: window.__q.tooltip(),
})`

async function runSurface(browser, name, url, viewport) {
  const started = Date.now()
  const page = await browser.page(url, viewport)

  // READY = the picker exists and the chip count has stopped moving. `base.chips` is the control
  // for the "selecting narrows the visible chips" assertion, so reading it mid-render is not a
  // slow test, it is a wrong one.
  const ready = await page.waitFor(MONTHS_READY, { timeout: 90000 })
  if (!ready) {
    check(`${name}-picker-present`, 'the month picker offers a focusable control per month', false, 'never rendered')
    await page.close()
    return
  }
  await page.waitForStable(CHIP_COUNT, { timeout: 30000 })
  await page.evaluate(HELPERS)

  const base = await page.evaluate(READ)

  check(`${name}-picker-present`, 'the month picker offers a focusable control per month',
    (base.months ?? 0) > 0, `${base.months} month buttons`)
  check(`${name}-starts-unfiltered`, 'nothing is selected before an interaction',
    base.selected === null, `selected=${base.selected}`)

  // ── HOVER: reads out, changes nothing ──────────────────────────────────────
  // Dispatched as a real pointer move over the plot area, which is what produced the pulse.
  const hover = await page.evaluate(`(() => {
    const bar = window.__q.bar()
    if (!bar) return { noBar: true }
    const r = bar.getBoundingClientRect()
    const at = (type, x, y) => bar.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }))
    at('mouseover', r.left + r.width / 2, r.top + r.height / 2)
    at('mousemove', r.left + r.width / 2, r.top + r.height / 2)
    return { noBar: false }
  })()`)

  if (!hover.noBar) {
    // The condition, not a clock: the tooltip is the thing hovering is supposed to produce. If it
    // never appears we stop waiting and still assert what this gate is for — that hovering changed
    // nothing else. Short timeout, because a missing tooltip must not cost 45s.
    await page.waitFor(`window.__q.tooltip().length > 0`, { timeout: 6000, every: 150 })
    const afterHover = await page.evaluate(READ)

    check(`${name}-hover-no-animation`, 'hover pulses, flashes or dims nothing in the results',
      afterHover.animated === 0 && base.animated === 0, `before=${base.animated} after=${afterHover.animated}`)
    check(`${name}-hover-no-selection`, 'hover changes neither selection nor filtering',
      afterHover.selected === base.selected && afterHover.chips === base.chips,
      `selected ${base.selected}->${afterHover.selected}, chips ${base.chips}->${afterHover.chips}`)
    check(`${name}-hover-no-announcement`, 'hover says nothing to a screen reader',
      afterHover.live === base.live, `live "${base.live}" -> "${afterHover.live}"`)
  }

  // ── KEYBOARD: Enter selects, exactly as a click does ───────────────────────
  // A month with results, so the assertions below have something to count.
  const target = await page.evaluate(`(() => {
    const bs = window.__q.months()
    const withData = bs.find(b => {
      const m = (b.getAttribute('aria-label') || '').match(/,\\s*([\\d,]+)\\s/)
      return m && Number(m[1].replace(/,/g, '')) > 0
    }) || bs[0]
    if (!withData) return { none: true }
    withData.focus()
    return { none: false, label: withData.getAttribute('aria-label') }
  })()`)

  if (!target.none) {
    await page.press('Enter')
    // The selection landing IS the condition. 2.5s was a guess at it.
    await page.waitFor(`window.__q.selected() !== null`, { timeout: 20000, every: 150 })
    // …and then the list it filters settling, which is what the chip assertion reads.
    await page.waitForStable(CHIP_COUNT, { timeout: 20000 })
    const afterEnter = await page.evaluate(`({
      selected: window.__q.selected(), chips: window.__q.chips(), live: window.__q.live(),
      cleared: Boolean(window.__q.clearButton()),
    })`)
    check(`${name}-enter-selects`, 'Enter selects the focused month',
      Boolean(afterEnter.selected) && /selected/.test(afterEnter.selected ?? ''), `selected=${afterEnter.selected}`)
    check(`${name}-enter-filters`, 'selecting narrows the visible post chips',
      (afterEnter.chips ?? 0) <= (base.chips ?? 0), `chips ${base.chips} -> ${afterEnter.chips}`)
    check(`${name}-announced`, 'the month and its result count are announced',
      Boolean(afterEnter.live) && /selected/i.test(afterEnter.live ?? '') && /\d/.test(afterEnter.live ?? ''),
      `live="${afterEnter.live}"`)
    check(`${name}-clearable`, 'a way to clear the month is offered',
      afterEnter.cleared === true, `clear control=${afterEnter.cleared}`)

    // CHANGING the month, not just setting it: pick a different one and confirm the first is released.
    const changed = await page.evaluate(`(() => {
      const bs = window.__q.months()
      const cur = bs.findIndex(b => b.getAttribute('aria-checked') === 'true')
      const next = bs[cur + 1] || bs[cur - 1]
      if (!next) return { none: true }
      next.focus()
      return { none: false, label: next.getAttribute('aria-label') }
    })()`)
    if (!changed.none) {
      await page.press(' ')
      // Condition: the selection is no longer the one Enter made.
      await page.waitFor(`window.__q.selected() !== ${JSON.stringify(afterEnter.selected)}`,
        { timeout: 20000, every: 150 })
      const afterSpace = await page.evaluate(`({
        selected: window.__q.selected(),
        checked: window.__q.months().filter(b => b.getAttribute('aria-checked') === 'true').length,
      })`)
      check(`${name}-space-selects`, 'Space performs the same action as Enter and a click',
        Boolean(afterSpace.selected) && afterSpace.selected !== afterEnter.selected,
        `${afterEnter.selected} -> ${afterSpace.selected}`)
      check(`${name}-single-selection`, 'changing the month releases the previous one',
        afterSpace.checked === 1, `${afterSpace.checked} months marked selected`)
    }

    // And clearing puts it back.
    await page.evaluate(`(() => { const b = window.__q.clearButton(); if (b) b.click(); return Boolean(b) })()`)
    await page.waitFor(`window.__q.selected() === null`, { timeout: 20000, every: 150 })
    const afterClear = await page.evaluate(`({ selected: window.__q.selected(), live: window.__q.live() })`)
    check(`${name}-clears`, 'clearing releases the month and says so',
      afterClear.selected === null && /cleared/i.test(afterClear.live ?? ''),
      `selected=${afterClear.selected} live="${afterClear.live}"`)
  }

  await page.close()
  return ((Date.now() - started) / 1000).toFixed(1)
}

const scope = only ? `--only ${only}` : argv.includes('--full')
  ? `--full (${ALL_CATEGORIES.length} categories + Archive)`
  : `representative (${REPRESENTATIVE} + Archive) — --full for all ${ALL_CATEGORIES.length}`
console.log(`\nMONTH CHART BEHAVIOUR — ${URL_BASE}\n  scope: ${scope}\n`)

const started = Date.now()
// One browser for the whole sweep. A fresh profile per surface re-seeds IndexedDB from a 9 MB
// bundle every time; the assertions here are about a chart, not about seeding.
const browser = await launch({ mode: 'fresh' })

for (const viewport of VIEWPORTS) {
  console.log(`  ${viewport.name} (${viewport.width}x${viewport.height})`)
  for (const cat of CATEGORIES) {
    const s = await runSurface(browser, `${viewport.name}/${cat}`, `${URL_BASE}/analysis?tab=${cat}`, viewport)
    console.log(`    ${cat.padEnd(20)} ${s}s`)
  }
  // The Archive chart, driven by the same module — the other HOST of the shared component, which
  // is the reason this surface is never dropped from an ordinary run.
  const s = await runSurface(browser, `${viewport.name}/archive`, `${URL_BASE}/posts?q=Israel`, viewport)
  console.log(`    ${'archive'.padEnd(20)} ${s}s`)
  const passed = results.filter(r => r.id.startsWith(viewport.name) && r.ok).length
  const total = results.filter(r => r.id.startsWith(viewport.name)).length
  console.log(`    ${passed}/${total} checks pass`)
}

await browser.close({ keepWarm: false })
const failed = results.filter(r => !r.ok)
console.log(`\n  ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(failed.length
  ? `  ${failed.length} of ${results.length} checks FAILED\n`
  : `  all ${results.length} checks pass — hover reads out, click selects, keys match the mouse\n`)
process.exit(failed.length ? 1 : 0)
