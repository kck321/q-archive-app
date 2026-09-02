// Proof, at the layer the reader sees, that the Named Entities list reconciles.
//
// The data invariants in audit-cross-section.mjs prove the artifact is coherent. They cannot prove
// the page renders it — and that gap is exactly where this defect lived: entities.json said 1,201
// for weeks while the header printed 856 and the list rendered 1,062. So this drives a real browser
// and reads the real DOM.
//
// What it asserts:
//   1. the header carries the total, both disjoint components, their sum, the row count and the
//      dormant count — and NOT the string tally that used to sit there
//   2. the list renders exactly as many rows as the artifact says it publishes
//   3. EVERY rendered row carries at least one post chip — no row without traceability
//   4. a source-only row shows its chips labelled, says "source only", and never says "mentions"
//   5. a social-account row is labelled "Social account", a publisher row "Publisher link"
//
// WAITING IS BY CONDITION, NOT BY CLOCK. This gate declared 49.5s of fixed sleeps — 14s to settle,
// 20s for "show all" to render 1,183 rows, 15s for a search — and cost 65.3s of a 744s live proof
// to make five assertions. The conditions were always available and are named below: the row count
// the artifact predicts, the row the search is looking for. A sleep long enough to be slow is still
// short enough to race a slow load, so this is not only faster, it is the version that cannot lie.
//
//   node scripts/test-entity-reconciliation.mjs [--url http://localhost:5199]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argUrl = process.argv.indexOf('--url')
const URL_BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://qdrops.app'

const view = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'entity-public-view.json'), 'utf8'))
const T = view.totals

// A ROW IS NOT "A PANEL MENTIONING THE SECTION NAME".
//
// The chart panel is also a .bg-q-panel. Its heading reads "Named Entities vs. Posts per Month" —
// and while searching, "Named Entities Timeline — <term>" — so matching on text counted it as a
// row (1,184 for 1,183) and returned it as the row for whichever entity was being searched. Its
// LEGEND then defeated the next attempt, because that is a span whose whole text is the label.
//
// What only a result row has is the rank, which carries a title attribute naming what it is.
//
// Installed on demand, never once at session start: the tab is opened AT the url, so the document
// that receives an early definition is the one being replaced by the load, and the helper was gone
// by the time the probe ran. That surfaced as "window.__entityRows is not a function" on one tab
// and, worse, as a stale definition quietly answering on another.
const INSTALL = `(() => {
  window.__entityRows = () => [...document.querySelectorAll('div.bg-q-panel')].filter(d =>
    d.querySelector('[title^="Rank across the whole category"]')
    && [...d.querySelectorAll('span')].some(s => s.textContent.trim() === 'Named Entities'))
  return typeof window.__entityRows === 'function'
})()`

// The list is up when it has rows AND has printed the "showing N of M" line the row-count assertion
// reads. Both, because the panels appear before the tally does.
const LIST_UP = `document.querySelectorAll('div.bg-q-panel').length > 3
  && /showing\\s+[\\d,]+\\s+of\\s+[\\d,]+/.test(document.body.innerText || '')`

const results = []
const check = (id, description, ok, detail) => {
  results.push({ id, ok: Boolean(ok), description, detail: String(detail) })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(34)} ${description}`)
  if (!ok) console.log(`        ↳ ${String(detail).slice(0, 260)}`)
}

console.log(`\nENTITY LIST RECONCILIATION — ${URL_BASE}\n`)
const started = Date.now()
const browser = await launch({ mode: 'fresh' })

// ── 1 + 2 + 3: header, row count, and a chip on every row ────────────────────
{
  const page = await browser.page(`${URL_BASE}/analysis?tab=namedEntities`)
  const up = await page.waitFor(LIST_UP, { timeout: 120000 })
  if (!up) check('list-renders', 'the Named Entities list renders at all', false, 'never became ready')
  await page.evaluate(INSTALL)

  // OPEN THE HEADER IF IT IS COLLAPSED, THEN READ IT.
  //
  // The figures are what this gate is about; which widths show them without a tap is the mobile
  // header gate's business. Since 2026-09-02 the statistics block collapses below Tailwind's `md`
  // breakpoint (768px) behind a real aria-expanded button — and the headless harness window is
  // 762px, SIX PIXELS UNDER IT, so a gate that sets no viewport is laid out as a phone. Reading
  // the header without opening it therefore found only the compact summary line, and reported the
  // reconciliation as broken when nothing about the reconciliation had changed.
  //
  // Expanding first is width-independent: on a desktop the disclosure is not rendered and this is
  // a no-op, on a phone it opens the same block. Either way the assertion below is about whether
  // the numbers RECONCILE, which is the thing that must never regress.
  await page.evaluate(`(() => {
    const t = [...document.querySelectorAll('button[aria-expanded][aria-controls]')]
      .find(b => getComputedStyle(b).display !== 'none' && b.getAttribute('aria-expanded') === 'false')
    if (t) t.click()
    return true
  })()`)
  await page.waitFor(`(() => {
    const t = [...document.querySelectorAll('button[aria-expanded][aria-controls]')]
      .find(b => getComputedStyle(b).display !== 'none')
    if (!t) return true                       // desktop: no disclosure to open
    const r = document.getElementById(t.getAttribute('aria-controls'))
    return r && getComputedStyle(r).display !== 'none' ? true : null
  })()`, { timeout: 8000 })

  const header = await page.evaluate(`(() => {
    const main = document.querySelector('main') || document.body
    return (main.innerText || '').split(String.fromCharCode(10)).filter(Boolean).slice(0, 12).join(' | ')
  })()`)
  const line = typeof header === 'string' ? header : ''

  const need = [
    ['total', T.canonicalEntities],
    ['mentions', T.mentions],
    ['prose component', T.proseMentioned],
    ['source-only component', T.sourceOnly],
    ['rows', T.publicRows],
    ['dormant', T.dormantReserved],
  ]
  const missing = need.filter(([, n]) => !line.includes(n.toLocaleString()))
  check('header-carries-every-figure', 'header states total, both components, rows and dormant',
    missing.length === 0, missing.length ? `missing ${missing.map(([k, n]) => `${k}=${n}`).join(', ')}` : line.slice(0, 200))

  // The old tally counted STRINGS in the frequency index. It must not appear on this section.
  check('header-drops-string-tally', 'header no longer prints the frequency-index item tally',
    !/\d+\s+repeated/.test(line) && !/found once/.test(line), line.slice(0, 200))

  // "showing N of M" names the full unfiltered row count.
  const shown = await page.evaluate(`(() => {
    const m = (document.body.innerText || '').match(/showing\\s+([\\d,]+)\\s+of\\s+([\\d,]+)/)
    return m ? Number(m[2].replace(/,/g, '')) : null
  })()`)
  check('list-row-count', `the list publishes ${T.publicRows.toLocaleString()} rows`,
    shown === T.publicRows, `page says ${shown}`)

  // Render every row, then look for one without a post chip.
  await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'show all')
    if (b) b.click()
    return Boolean(b)
  })()`)
  // THE CONDITION IS THE COUNT THE ARTIFACT PREDICTS. 20s was a guess at how long 1,183 rows take
  // to mount; this waits for exactly the number the next assertion is about to compare against, and
  // falls through to that assertion (which then reports the shortfall) if they never arrive.
  await page.waitFor(`typeof window.__entityRows === 'function'
    && window.__entityRows().length === ${T.publicRows}`, { timeout: 120000, every: 400 })

  await page.evaluate(INSTALL)
  const chips = await page.evaluate(`(() => {
    try {
      const HASH = String.fromCharCode(35)
      const isChip = a => { const t = a.textContent.trim()
        return t.charAt(0) === HASH && t.charAt(1) >= '0' && t.charAt(1) <= '9' }
      const rows = window.__entityRows()
      const without = rows.filter(d => ![...d.querySelectorAll('a')].some(isChip))
      return {
        rows: rows.length,
        without: without.length,
        sample: without.slice(0, 3).map(d => (d.innerText || '').split(String.fromCharCode(10)).slice(0, 3).join(' / ')),
      }
    } catch (err) { return { thrown: String(err && err.message || err) } }
  })()`)
  check('every-row-has-a-post-chip', 'every rendered row carries at least one post chip',
    chips.rows === T.publicRows && chips.without === 0,
    `${chips.rows} rows rendered, ${chips.without} without a chip ${(chips.sample ?? []).join(' | ')}`)

  await page.close()
}

// ── 4 + 5: a source-only row, labelled ───────────────────────────────────────
// Chosen from the artifact rather than hardcoded, so the test follows the data.
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'entities.json'), 'utf8')).entities
const nameOf = id => registry.find(e => e.id === id)?.canonical
const pick = kind => {
  const hit = Object.entries(view.rows).find(([, r]) =>
    r.kind === 'source_only' && (r.sourcePosts ?? []).length && r.sourcePosts.every(s => s.kind === kind))
  return hit ? { name: nameOf(hit[0]), row: hit[1] } : null
}
const publisher = pick('publisher')
const social = pick('social_account')

for (const [kind, target] of [['publisher', publisher], ['social_account', social]]) {
  if (!target?.name) { check(`source-row-${kind}`, 'a source-only example exists in the artifact', false, 'none found'); continue }
  const label = view.kindLabels[kind]
  const page = await browser.page(`${URL_BASE}/analysis?tab=namedEntities&q=${encodeURIComponent(target.name)}`)
  await page.waitFor(`document.querySelectorAll('div.bg-q-panel').length > 1`, { timeout: 90000 })
  await page.evaluate(INSTALL)
  // Identified by its HEADING, not by "a panel whose text contains the name". The name also appears
  // in the chart title when searching, in another row's alias chips, and in the drop text of any
  // opened reader — all of which made the lookup land somewhere that was not the row.
  //
  // THE ROW ITSELF IS THE CONDITION: a single-result search auto-opens the row's drop reader, so
  // waiting for the row to exist waits for exactly the state the probe below reads.
  const ROW = `[...window.__entityRows()].find(d =>
    [...d.querySelectorAll('button')].some(b => b.textContent.trim() === ${JSON.stringify(target.name)}))`
  await page.waitFor(`Boolean(${ROW})`, { timeout: 60000, every: 300 })
  // …and then its chips settling, because the reader mounts a drop card inside the same row.
  await page.waitForStable(`(${ROW} || document.body).querySelectorAll('a').length`, { timeout: 20000 })

  const probe = await page.evaluate(`(() => {
    try {
      const HASH = String.fromCharCode(35)
      const rows = window.__entityRows()
      const row = ${ROW}
      if (!row) return { found: false, rows: rows.length, headings: rows.slice(0, 5).map(d => (d.innerText || '').split(String.fromCharCode(10)).slice(0, 4).join('/')) }
      const text = row.innerText || ''
      const chips = [...row.querySelectorAll('a')].map(a => a.textContent.trim())
        .filter(t => t.charAt(0) === HASH && t.charAt(1) >= '0' && t.charAt(1) <= '9')
      // DISTINCT DROPS, not chip elements. A single-result search auto-opens the row's drop reader,
      // and the drop card it mounts carries its own "#2847" link inside the same row — so counting
      // elements reported two chips for a one-source entity. That the reader opens at all is the
      // point: the source post is a real drop a reader can read.
      const posts = [...new Set(chips.map(t => (t.match(/^#(\\d+)/) || [])[1]).filter(Boolean))]
      return {
        found: true,
        chips,
        posts: posts.length,
        labelled: chips.filter(c => c.includes(${JSON.stringify(label)})).length,
        sourceOnlyBadge: text.includes('source only'),
        saysMentions: /\\d+\\s+mentions/.test(text),
        explains: /linked this source|not necessarily named/i.test(text),
        sourcesLink: Boolean([...row.querySelectorAll('a')].find(a => (a.getAttribute('href') || '').includes('/sources'))),
      }
    } catch (err) { return { thrown: String(err && err.message || err) } }
  })()`)
  await page.close()

  const expected = (target.row.sourcePosts ?? []).length
  check(`source-row-${kind}-renders`, `${target.name} renders as a row with its ${expected} source chip${expected !== 1 ? 's' : ''}`,
    probe.found && probe.posts === expected,
    `found=${probe.found} posts=${probe.posts}/${expected} [${(probe.chips ?? []).join(' | ')}] ${probe.thrown ?? ''} ${probe.__error ?? ''} ${(probe.headings ?? []).join(' ; ')}`)
  check(`source-row-${kind}-labelled`, `every chip is labelled "${label}"`,
    probe.labelled === expected, `${probe.labelled}/${expected} labelled — ${(probe.chips ?? []).slice(0, 3).join(' , ')}`)
  // The "×N source posts" badge only renders from 2 upward, exactly as the post badge does, so a
  // single-source row is proved by what it must NOT say: the word "mentions".
  check(`source-row-${kind}-not-a-mention`, 'the row never presents a source reference as a mention',
    probe.saysMentions === false && probe.sourceOnlyBadge === true,
    `mentions=${probe.saysMentions} sourceOnlyBadge=${probe.sourceOnlyBadge}`)
  check(`source-row-${kind}-explained`, 'the row explains the source is linked, not named',
    probe.explains === true && probe.sourceOnlyBadge === true, `explains=${probe.explains} badge=${probe.sourceOnlyBadge}`)
  check(`source-row-${kind}-searchable`, 'the row links through to the Sources system',
    probe.sourcesLink === true, `link=${probe.sourcesLink}`)
}

await browser.close({ keepWarm: false })
const failed = results.filter(r => !r.ok)
console.log(`\n  ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(failed.length
  ? `  ${failed.length} of ${results.length} checks FAILED\n`
  : `  all ${results.length} checks pass\n`)
process.exit(failed.length ? 1 : 0)
