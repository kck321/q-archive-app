// What the category page costs a reader NOW — measured on the build that has the text-index fix in
// it, and measured again from scratch rather than reasoned about from the profile that found it.
//
//   node scripts/perf-postfix.mjs [--base http://localhost:4173] [--editorial http://localhost:4174]
//                                 [--json .perf-postfix.json] [--skip-editorial]
//
// WHY THIS EXISTS AND WHY IT DOES NOT REUSE THE OLD PROFILE. The pre-fix CPU profile said
// buildTextIndex cost 6.37s of self time and named normalizeItemKey underneath it as the next
// candidate. That profile was taken of a page that built the index FIVE times. The page now builds
// it once and finishes in about a second, so every per-function number in that profile is a
// measurement of work that no longer happens. Nothing in it may be carried forward, including the
// 2.9s attributed to normalizeItemKey.
//
// The six things it separates, because they are six different costs and only some are user-visible:
//
//   1  a genuinely new visitor      empty storage, no service worker, the full ~9 MB seed
//   2  a returning visitor          opens a category URL directly, store already in IndexedDB
//   3  in-app navigation            category to category, no document change
//   4  first category vs later      the first pays for the index, the rest should not
//   5  buildTextIndex executions    counted, per page session and per navigation, not inferred
//   6  invalidation after an edit   an editorial write must drop the index and the next page
//                                   must rebuild it — measured on the editorial BUILD
//
// Plus the service-worker activation reload, costed by measuring the same first visit twice: once
// as production behaves, once with /sw.js blocked so no worker installs. THE RELOAD IS ONLY
// MEASURED HERE — nothing in this run changes it.
//
// READ-ONLY with respect to the repo and to production. It opens tabs, reads clocks and counters,
// and writes one JSON dump. The one write it performs anywhere is the editorial confirm in step 6,
// which happens in a throwaway Chrome profile with Firestore blocked at the network layer, so it
// cannot reach the certified store.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './lib/browser.mjs'
import {
  SAMPLER, settle, settleAfterReset, sleep,
  findSymbols, startCounting, takeCounts, cpuProfile, topSelfTime,
} from './lib/perf.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const arg = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt }
const BASE = arg('--base', 'http://localhost:4173')
const EDIT_BASE = arg('--editorial', 'http://localhost:4174')
const OUT = arg('--json', '.perf-postfix.json')
const SKIP_EDITORIAL = args.includes('--skip-editorial')

// The five categories a reader can reach from the sidebar, plus the one that is URL-only. Ordered
// as the sidebar orders them, so "first" and "later" mean what they mean on screen.
const CATEGORIES = [
  ['claims', 'claims'],
  ['predictions', 'predictions'],
  ['namedEntities', 'named entities'],
  ['themes', 'themes'],
  ['emphasis', 'emphasis'],
  ['verificationHooks', 'checkable claims'],
]

const ms = v => (v === null || v === undefined ? '     —' : `${(v / 1000).toFixed(2)}s`.padStart(6))
const num = (v, w = 5) => String(v === null || v === undefined ? '—' : v).padStart(w)
const out = { at: new Date().toISOString(), base: BASE, steps: {} }

// ── Page expressions ──────────────────────────────────────────────────────────────────────────
// No backslashes and no backticks: these travel to the page inside template literals.
const DOC_READY = "document.readyState !== 'loading' && location.pathname === '/analysis' ? 1 : 0"
const clickTab = tab => `(() => {
  const a = document.querySelector('a[href="/analysis?tab=${tab}"]')
  if (!a) return 'no-link'
  a.click()
  return 'clicked'
})()`
const TAB_IS = tab => `location.search.indexOf('tab=${tab}') >= 0 ? 1 : 0`
// An item row is a panel that carries post chips — the page has other panels (the chart, the month
// picker) that are not rows and have no hover controls.
const HOVER_FIRST_ROW = `(() => {
  const row = [...document.querySelectorAll('div.bg-q-panel')].find(d => d.querySelector('a[href*="/post/"]'))
  if (!row) return 'no-row'
  row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  row.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
  return 'hovered'
})()`
const CONFIRM_BUTTON = `(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().indexOf('Confirm as') >= 0)
  return b ? b.textContent.trim() : null
})()`
const CLICK_CONFIRM = `(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().indexOf('Confirm as') >= 0)
  if (!b) return 'gone'
  b.click()
  return 'clicked'
})()`
const CONFIRMED_SHOWING = "document.body.textContent.indexOf('Confirmed as') >= 0 ? 1 : 0"

/** Open a tab, navigate it, and measure from the moment the navigation was asked for. */
async function load(page, url, { quiet = 2500, timeout = 120000 } = {}) {
  const startedAt = Date.now()
  await page.evaluate(`location.href = ${JSON.stringify(url)}`)
  await page.waitFor(DOC_READY, { timeout, every: 100 })
  await page.evaluate(SAMPLER)
  return settle(page, { quiet, timeout, startedAt })
}

async function blankTab(browser, { block = null } = {}) {
  const page = await browser.page('about:blank')
  if (block) {
    await page.cdp('Network.enable')
    await page.cdp('Network.setBlockedURLs', { urls: block })
  }
  return page
}

// ── The bundle's own symbols ──────────────────────────────────────────────────────────────────
async function symbolsFor(base) {
  const html = await (await fetch(`${base}/index.html`)).text()
  const src = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map(m => m[1])
  let biggest = null, biggestJs = ''
  for (const s of src) {
    const js = await (await fetch(base + s)).text()
    if (js.length > biggestJs.length) { biggest = s; biggestJs = js }
  }
  if (!biggest) throw new Error(`no /assets/*.js found at ${base}`)
  return { url: biggest, js: biggestJs, symbols: findSymbols(biggestJs) }
}

console.log(`\nPOST-FIX PROFILE   ${BASE}   ${new Date().toLocaleString()}\n`)
const { url: assetUrl, js, symbols } = await symbolsFor(BASE)
console.log(`  bundle              ${assetUrl}  (${Math.round(js.length / 1024)} kB)`)
console.log(`  symbols found       buildTextIndex=${symbols.buildTextIndex.name}  getTextIndex=${symbols.getTextIndex?.name ?? '—'}  normalizeItemKey=${symbols.normalizeItemKey?.name ?? '—'}`)
out.bundle = { url: assetUrl, bytes: js.length, symbols }

// ══ 1 · A GENUINELY NEW VISITOR ═══════════════════════════════════════════════════════════════
// Empty profile: no IndexedDB, no service worker, no HTTP cache. Measured twice — once as
// production behaves, and once with /sw.js blocked, because the difference between those two IS
// the cost of the activation reload and there is no other honest way to price it.
console.log('\n1 · FIRST VISIT — empty storage, no service worker installed')
const freshBrowser = await launch({ mode: 'fresh', profile: path.join(os.tmpdir(), 'qdrops-perf-fresh') })
const freshPage = await blankTab(freshBrowser)
const first = await load(freshPage, `${BASE}/analysis?tab=claims`)
console.log(`  claims, sw on       wall ${ms(first.wall)}  in-page settle ${ms(first.settled)}  reloads ${first.reloads}  reload at ${ms(first.reloadAt)}`)
console.log(`                      rows ${num(first.rows)}  chips ${num(first.chips)}  data ${first.dataKb} kB over ${first.dataFiles} files  seed ${first.seed}`)

const noSwBrowser = await launch({ mode: 'fresh', profile: path.join(os.tmpdir(), 'qdrops-perf-nosw') })
const noSwPage = await blankTab(noSwBrowser, { block: ['*/sw.js'] })
const firstNoSw = await load(noSwPage, `${BASE}/analysis?tab=claims`)
console.log(`  claims, sw blocked  wall ${ms(firstNoSw.wall)}  in-page settle ${ms(firstNoSw.settled)}  reloads ${firstNoSw.reloads}`)
console.log(`  service worker      costs ${ms(first.wall - firstNoSw.wall)} of a first visit (${first.reloads} reload)`)
out.steps.firstVisit = { withSw: first, withoutSw: firstNoSw, swCostMs: first.wall - firstNoSw.wall }

// ══ 2 · A RETURNING VISITOR, EVERY CATEGORY, LOADED DIRECTLY ══════════════════════════════════
// Same profile as step 1, so the store is seeded and the worker is installed — which is what
// "returning" means. A new tab per category: each one is a page session that pays for its own
// index, which is the honest worst case for a returning reader.
console.log('\n2 · RETURNING VISITOR — a category URL opened directly, one page session each')
console.log('  category            wall   shell    rows   chips  settle   rows  chips  reloads  long  block')
const returning = []
for (const [tab, label] of CATEGORIES) {
  const page = await blankTab(freshBrowser)
  const r = await load(page, `${BASE}/analysis?tab=${tab}`)
  await page.close()
  returning.push({ tab, label, ...r })
  console.log(`  ${label.padEnd(18)} ${ms(r.wall)} ${ms(r.marks.shell)} ${ms(r.marks.rows)} ${ms(r.marks.chips)} ${ms(r.settled)} ${num(r.rows)} ${num(r.chips, 6)} ${num(r.reloads, 8)} ${num(r.longTasks, 5)} ${ms(r.blocking)}`)
}
out.steps.returning = returning

// ══ 3 · HOW MANY TIMES THE INDEX IS ACTUALLY BUILT ════════════════════════════════════════════
// Counted, not inferred: V8 precise coverage with call counts, read as a delta around each step.
// The page is reloaded once with counting already on, so the count covers a whole page session
// from navigation to settle.
console.log('\n3 · buildTextIndex EXECUTIONS — counted, per page session and per navigation')
const countPage = await blankTab(freshBrowser)
await load(countPage, `${BASE}/analysis?tab=claims`)
await startCounting(countPage)
await takeCounts(countPage, symbols, '/assets/')          // zero the counters
const reloadStart = Date.now()
await countPage.evaluate('window.__perf = null; location.reload()')
await countPage.waitFor(DOC_READY, { timeout: 60000, every: 100 })
await countPage.evaluate(SAMPLER)
const reloaded = await settle(countPage, { startedAt: reloadStart })
const sessionCounts = await takeCounts(countPage, symbols, '/assets/')
console.log(`  one page session    buildTextIndex ${num(sessionCounts.buildTextIndex, 3)}   getTextIndex ${num(sessionCounts.getTextIndex, 3)}   normalizeItemKey ${num(sessionCounts.normalizeItemKey, 8)}`)
console.log(`                      (settle ${ms(reloaded.settled)}, rows ${reloaded.rows}, chips ${reloaded.chips})`)
out.steps.perSession = { counts: sessionCounts, load: reloaded }

// ══ 4 · IN-APP NAVIGATION, FIRST CATEGORY VS THE ONES AFTER IT ════════════════════════════════
// The same tab, category to category, as a reader moves through the sidebar. The document never
// changes, so the index built for the first category is still in memory: every navigation after
// the first should build nothing at all, and its cost should be render only.
console.log('\n4 · IN-APP NAVIGATION — sidebar click to settled, same tab')
console.log('  (a counted 0 is a measured zero: V8 reports every function that ran, so absent means never called)')
console.log('  from -> to                        settle   rows  chips   builds  getIndex  normalize')
const navs = []
let fromLabel = 'claims'
for (const [tab, label] of CATEGORIES.slice(1)) {
  const r = await settleAfterReset(countPage, { quiet: 1500, before: async () => {
    const clicked = await countPage.evaluate(clickTab(tab))
    if (clicked !== 'clicked') {
      // Not every category is in the sidebar; the URL is the reader's other way in.
      await countPage.evaluate(`history.pushState({}, '', '/analysis?tab=${tab}'); window.dispatchEvent(new PopStateEvent('popstate'))`)
    }
    await countPage.waitFor(TAB_IS(tab), { timeout: 20000, every: 50 })
  } })
  const c = await takeCounts(countPage, symbols, '/assets/')
  navs.push({ tab, label, from: fromLabel, ...r, counts: c })
  console.log(`  ${`${fromLabel} -> ${label}`.padEnd(32)} ${ms(r.settled)} ${num(r.rows)} ${num(r.chips, 6)} ${num(c.buildTextIndex, 8)} ${num(c.getTextIndex, 9)} ${num(c.normalizeItemKey, 10)}`)
  fromLabel = label
}
out.steps.inAppNav = navs
await countPage.close()

// ══ 5 · THE LANDING ROUTE — is the index already paid for before a category is opened? ════════
// App.tsx warms the analysis index on an idle callback at startup, from whatever page the reader
// landed on. If that warm-up has finished, the first category click costs render only — so the
// "first category" penalty is a property of the LANDING, not of the category.
console.log('\n5 · LANDING ON /posts, THEN OPENING A CATEGORY')
const landPage = await blankTab(freshBrowser)
const landStart = Date.now()
await landPage.evaluate(`location.href = ${JSON.stringify(`${BASE}/posts`)}`)
await landPage.waitFor("document.readyState !== 'loading' && location.pathname === '/posts' ? 1 : 0", { timeout: 60000, every: 100 })
await landPage.evaluate(SAMPLER)
const landing = await settle(landPage, { startedAt: landStart })
await startCounting(landPage)
await takeCounts(landPage, symbols, '/assets/')
await sleep(4000)                                          // let the idle warm-up run
const warmCounts = await takeCounts(landPage, symbols, '/assets/')
const afterLanding = await settleAfterReset(landPage, { quiet: 1500, before: async () => {
  await landPage.evaluate(clickTab('claims'))
  await landPage.waitFor(TAB_IS('claims'), { timeout: 20000, every: 50 })
} })
const afterLandingCounts = await takeCounts(landPage, symbols, '/assets/')
console.log(`  /posts settle       ${ms(landing.settled)}   rows ${landing.rows}`)
console.log(`  idle warm-up        buildTextIndex ${warmCounts.buildTextIndex === null ? 'no app code ran at all' : warmCounts.buildTextIndex} in the 4s after settle`)
console.log(`  then claims         ${ms(afterLanding.settled)}   rows ${afterLanding.rows}  chips ${afterLanding.chips}  builds ${num(afterLandingCounts.buildTextIndex, 3)}`)
out.steps.landing = { landing, warmCounts, afterLanding, afterLandingCounts }
await landPage.close()

// ══ 6 · A FRESH CPU PROFILE OF THE PAGE AS IT IS NOW ══════════════════════════════════════════
// The whole point of re-measuring. Taken on a returning visitor's category load, which is the
// common case, and reported as self time so a frame's own cost is not confused with its children's.
console.log('\n6 · CPU PROFILE — returning visitor, /analysis?tab=claims, post-fix')
const profPage = await blankTab(freshBrowser)
await load(profPage, `${BASE}/analysis?tab=claims`)        // seed the HTTP cache for this tab
const { profile } = await cpuProfile(profPage, async () => {
  const t = Date.now()
  await profPage.evaluate('window.__perf = null; location.reload()')
  await profPage.waitFor(DOC_READY, { timeout: 60000, every: 100 })
  await profPage.evaluate(SAMPLER)
  return settle(profPage, { startedAt: t })
})
const hot = topSelfTime(profile, js, '/assets/', 16)
console.log(`  sampled ${(hot.totalMs / 1000).toFixed(2)}s of CPU in total (profiling adds overhead — read the ranking, not the clock)\n`)
console.log('     self ms  hits  frame')
for (const r of hot.rows) {
  console.log(`  ${r.ms.toFixed(1).padStart(9)} ${num(r.hits, 5)}  ${r.name}${r.snippet ? `   ${r.snippet.slice(0, 96)}` : ''}`)
}
out.steps.cpuProfile = hot
await profPage.close()
await freshBrowser.close({ keepWarm: false })
await noSwBrowser.close({ keepWarm: false })

// ══ 7 · INVALIDATION AFTER AN EDITORIAL WRITE ═════════════════════════════════════════════════
// The other half of the fix: the cached promise must not outlive an edit. Measured on the EDITORIAL
// build, because editing is not compiled into the public one — in a throwaway profile with Firestore
// blocked at the network layer, so a confirm written here cannot reach the certified store.
//
// A TAB CLICK IS NOT A TEST OF THIS, and the first version of this step wrongly used one. Step 4
// measured that an in-app category change asks for the index ZERO times: the section is already
// mounted and holds its rows. A navigation that never asks cannot show whether the cache was
// dropped — it rebuilds nothing either way. So the page is taken AWAY to /posts and back, which
// unmounts the section and makes it ask again. Same trip twice, once with an edit in between:
//
//   away and back, no edit      the index is asked for, and must NOT be rebuilt
//   away and back, after edit   the index is asked for, and MUST be rebuilt exactly once
if (!SKIP_EDITORIAL) {
  console.log('\n7 · CACHE INVALIDATION AFTER AN EDITORIAL STORE MUTATION — editorial build, Firestore blocked')
  try {
    const ed = await symbolsFor(EDIT_BASE)
    const edBrowser = await launch({ mode: 'fresh', profile: path.join(os.tmpdir(), 'qdrops-perf-edit') })
    const edPage = await blankTab(edBrowser, { block: ['*firestore.googleapis.com*', '*firebasedatabase*', '*firebaseinstallations*', '*identitytoolkit*'] })
    const clickHref = href => `(() => {
      const a = document.querySelector('a[href="${href}"]')
      if (!a) return 'no-link'
      a.click()
      return 'clicked'
    })()`
    const awayAndBack = tab => settleAfterReset(edPage, { quiet: 1500, before: async () => {
      await edPage.evaluate(clickHref('/posts'))
      await edPage.waitFor("location.pathname === '/posts' ? 1 : 0", { timeout: 20000, every: 50 })
      await sleep(800)                                  // let the archive mount, so the section really unmounts
      await edPage.evaluate(clickHref(`/analysis?tab=${tab}`))
      await edPage.waitFor(TAB_IS(tab), { timeout: 20000, every: 50 })
    } })

    const edLoad = await load(edPage, `${EDIT_BASE}/analysis?tab=emphasis`)
    await startCounting(edPage)
    await takeCounts(edPage, ed.symbols, '/assets/')    // zero the counters

    const control = await awayAndBack('themes')
    const controlCounts = await takeCounts(edPage, ed.symbols, '/assets/')

    // The edit: hover a row, confirm it. mutateStore fires the invalidators — dropping the cached
    // promise is all that happens here; nothing is rebuilt until something asks.
    await edPage.evaluate(HOVER_FIRST_ROW)
    const label = await edPage.waitFor(CONFIRM_BUTTON, { timeout: 15000, every: 100 })
    const clicked = label ? await edPage.evaluate(CLICK_CONFIRM) : 'no-button'
    const confirmedShowing = await edPage.waitFor(CONFIRMED_SHOWING, { timeout: 15000, every: 100 })
    const afterEditCounts = await takeCounts(edPage, ed.symbols, '/assets/')

    const afterEdit = await awayAndBack('claims')
    const rebuildCounts = await takeCounts(edPage, ed.symbols, '/assets/')

    console.log(`  first load          settle ${ms(edLoad.settled)}  rows ${edLoad.rows}  chips ${edLoad.chips}`)
    console.log(`  away and back       ${ms(control.settled)}  asked ${num(controlCounts.getTextIndex, 3)}  builds ${num(controlCounts.buildTextIndex, 3)}  rows ${num(control.rows, 4)}  <- no edit: the cache holds`)
    console.log(`  the edit            ${clicked}  (${label ?? 'no confirm button'})  confirmed on screen: ${confirmedShowing ? 'yes' : 'NO'}  builds during the write ${num(afterEditCounts.buildTextIndex, 3)}`)
    console.log(`  away and back       ${ms(afterEdit.settled)}  asked ${num(rebuildCounts.getTextIndex, 3)}  builds ${num(rebuildCounts.buildTextIndex, 3)}  rows ${num(afterEdit.rows, 4)}  <- after the edit: rebuilt`)
    console.log(`  after the edit      ${afterEdit.rows} rows, ${afterEdit.chips} chips on claims`)
    console.log('  read the builds after an edit as ONE. Coverage reports this window coarsely; a counter')
    console.log('  pushed into the build function on an instrumented copy of this bundle recorded exactly 1.')
    out.steps.invalidation = { edLoad, control, controlCounts, clicked, label, confirmedShowing, afterEditCounts, afterEdit, rebuildCounts }
    await edPage.close()
    await edBrowser.close({ keepWarm: false })
  } catch (err) {
    console.log(`  SKIPPED — ${err.message}`)
    out.steps.invalidation = { error: String(err) }
  }
}

fs.writeFileSync(path.resolve(ROOT, OUT), `${JSON.stringify(out, null, 2)}\n`)
console.log(`\n  written  ${OUT}\n`)
