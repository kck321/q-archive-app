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
//   node scripts/test-entity-reconciliation.mjs [--url http://localhost:5199]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argUrl = process.argv.indexOf('--url')
const URL_BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://qdrops.app'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const view = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'entity-public-view.json'), 'utf8'))
const T = view.totals

const PORT = 9413
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'qdrops-recon-'))
const CHROME = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'google-chrome'
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
{ stdio: 'ignore', detached: true })
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* not up */ }
  await sleep(500)
}

async function session(url) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise(r => { ws.onopen = r })
  let id = 0
  const pending = new Map()
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })
  await send('Page.enable')
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    try { return JSON.parse(r.result?.result?.value) } catch { return { error: String(r.result?.result?.value).slice(0, 300) } }
  }
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
  const install = () => evaluate(`(() => {
    window.__entityRows = () => [...document.querySelectorAll('div.bg-q-panel')].filter(d =>
      d.querySelector('[title^="Rank across the whole category"]')
      && [...d.querySelectorAll('span')].some(s => s.textContent.trim() === 'Named Entities'))
    return JSON.stringify({ ok: typeof window.__entityRows === 'function' })
  })()`)
  const close = async () => { ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`) }
  return { evaluate, close, install }
}

const results = []
const check = (id, description, ok, detail) => {
  results.push({ id, ok: Boolean(ok), description, detail: String(detail) })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(34)} ${description}`)
  if (!ok) console.log(`        ↳ ${String(detail).slice(0, 260)}`)
}

console.log(`\nENTITY LIST RECONCILIATION — ${URL_BASE}\n`)

// ── 1 + 2 + 3: header, row count, and a chip on every row ────────────────────
{
  const s = await session(`${URL_BASE}/analysis?tab=namedEntities`)
  await sleep(14000)
  await s.install()

  const header = await s.evaluate(`(() => {
    const main = document.querySelector('main') || document.body
    return JSON.stringify({ head: (main.innerText || '').split(String.fromCharCode(10)).filter(Boolean).slice(0, 8).join(' | ') })
  })()`)
  const line = header.head ?? ''

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
  const shown = await s.evaluate(`(() => {
    const m = (document.body.innerText || '').match(/showing\\s+([\\d,]+)\\s+of\\s+([\\d,]+)/)
    return JSON.stringify({ of: m ? Number(m[2].replace(/,/g, '')) : null })
  })()`)
  check('list-row-count', `the list publishes ${T.publicRows.toLocaleString()} rows`,
    shown.of === T.publicRows, `page says ${shown.of}`)

  // Render every row, then look for one without a post chip.
  await s.evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'show all')
    if (b) b.click()
    return JSON.stringify({ clicked: Boolean(b) })
  })()`)
  await sleep(20000)

  await s.install()
  const chips = await s.evaluate(`(() => {
    try {
      const rows = window.__entityRows()
      const without = rows.filter(d => ![...d.querySelectorAll('a')].some(a => /^#\\d+/.test(a.textContent.trim())))
      return JSON.stringify({
        rows: rows.length,
        without: without.length,
        sample: without.slice(0, 3).map(d => (d.innerText || '').split(String.fromCharCode(10)).slice(0, 3).join(' / ')),
      })
    } catch (err) { return JSON.stringify({ thrown: String(err && err.message || err) }) }
  })()`)
  check('every-row-has-a-post-chip', 'every rendered row carries at least one post chip',
    chips.rows === T.publicRows && chips.without === 0,
    `${chips.rows} rows rendered, ${chips.without} without a chip ${(chips.sample ?? []).join(' | ')}`)

  await s.close()
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
  const s = await session(`${URL_BASE}/analysis?tab=namedEntities&q=${encodeURIComponent(target.name)}`)
  await sleep(15000)
  await s.install()
  // Identified by its HEADING, not by "a panel whose text contains the name". The name also appears
  // in the chart title when searching, in another row's alias chips, and in the drop text of any
  // opened reader — all of which made the lookup land somewhere that was not the row.
  const probe = await s.evaluate(`(() => {
    try {
      const rows = window.__entityRows()
      const row = rows.find(d => [...d.querySelectorAll('button')].some(b => b.textContent.trim() === ${JSON.stringify(target.name)}))
      if (!row) return JSON.stringify({ found: false, rows: rows.length, headings: rows.slice(0, 5).map(d => (d.innerText || '').split(String.fromCharCode(10)).slice(0, 4).join('/')) })
      const text = row.innerText || ''
      const chips = [...row.querySelectorAll('a')].map(a => a.textContent.trim()).filter(t => /^#\\d+/.test(t))
      // DISTINCT DROPS, not chip elements. A single-result search auto-opens the row's drop reader,
      // and the drop card it mounts carries its own "#2847" link inside the same row — so counting
      // elements reported two chips for a one-source entity. That the reader opens at all is the
      // point: the source post is a real drop a reader can read.
      const posts = [...new Set(chips.map(t => (t.match(/^#(\\d+)/) || [])[1]).filter(Boolean))]
      return JSON.stringify({
        found: true,
        chips,
        posts: posts.length,
        labelled: chips.filter(c => c.includes(${JSON.stringify(label)})).length,
        sourceOnlyBadge: text.includes('source only'),
        saysMentions: /\\d+\\s+mentions/.test(text),
        explains: /linked this source|not necessarily named/i.test(text),
        sourcesLink: Boolean([...row.querySelectorAll('a')].find(a => (a.getAttribute('href') || '').includes('/sources'))),
      })
    } catch (err) { return JSON.stringify({ thrown: String(err && err.message || err) }) }
  })()`)
  await s.close()

  const expected = (target.row.sourcePosts ?? []).length
  check(`source-row-${kind}-renders`, `${target.name} renders as a row with its ${expected} source chip${expected !== 1 ? 's' : ''}`,
    probe.found && probe.posts === expected,
    `found=${probe.found} posts=${probe.posts}/${expected} [${(probe.chips ?? []).join(' | ')}] ${probe.thrown ?? ''} ${probe.error ?? ''} ${(probe.headings ?? []).join(' ; ')}`)
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

try { process.kill(-proc.pid) } catch { try { proc.kill() } catch { /* gone */ } }
const failed = results.filter(r => !r.ok)
console.log(failed.length
  ? `\n  ${failed.length} of ${results.length} checks FAILED\n`
  : `\n  all ${results.length} checks pass\n`)
process.exit(failed.length ? 1 : 0)
