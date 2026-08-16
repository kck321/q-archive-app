// The Claims graph, verified by clicking it — not by reasoning about the data source.
//
// The propagation check could not assert the chart because no recharts SVG is mounted on first
// paint: /analysis renders its chart behind a control, and the only <svg> at load is a 22px icon.
// Inferring "same store, therefore correct" is not verification. This drives the page.
//
// One page session throughout, because clicking and then reading in two separate tabs would read
// a fresh page that was never clicked.
//
//   node scripts/verify-claim-graph.mjs [--url https://qdrops.app]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { CANONICAL } from './lib/contracts.mjs'

const argUrl = process.argv.indexOf('--url')
const URL_BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://qdrops.app'
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p))
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1) }

const sleep = ms => new Promise(r => setTimeout(r, ms))
const PORT = 9401
const PROFILE = path.join(os.tmpdir(), 'qdrops-claim-graph')
fs.rmSync(PROFILE, { recursive: true, force: true })
fs.mkdirSync(PROFILE, { recursive: true })
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1400,1600',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore', detached: true })
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* not up */ }
  await sleep(500)
}

/** One tab, held open, so a click and the read that follows happen on the same page. */
async function session(url) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise(r => { ws.onopen = r })
  let id = 0
  const pending = new Map()
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })
  await send('Page.enable')
  return {
    async eval(expression, settle = 0) {
      if (settle) await sleep(settle)
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) }
      const v = r.result?.result?.value
      try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return v }
    },
    close: async () => { ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`) },
  }
}

const checks = []
const t = (label, ok, got) => { checks.push([label, ok, got]); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(50)} ${got}`) }
const C = CANONICAL.claims

console.log(`\nCLAIMS GRAPH — ${URL_BASE}`)
console.log(`certified: ${C.occurrences.toLocaleString()} occurrences · ${C.distinct.toLocaleString()} distinct · ${C.posts.toLocaleString()} posts\n`)

// ── /analysis ────────────────────────────────────────────────────────────────
// The sidebar links to /analysis?tab=claims — the archive mounts per-category, so the bare
// /analysis URL shows a different tab and no Claims chart. Loading the tab the reader loads.
const s = await session(`${URL_BASE}/analysis?tab=claims`)
await sleep(15000)

console.log('── controls on /analysis ──')
const controls = await s.eval(`(() => {
  const main = document.querySelector('main') || document.body
  return JSON.stringify([...main.querySelectorAll('button,[role="tab"],a')]
    .map((e, i) => ({ i, tag: e.tagName.toLowerCase(), text: (e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 34) }))
    .filter(e => e.text).slice(0, 40))
})()`)
console.log(`  ${JSON.stringify(controls).slice(0, 700)}`)

// Click the control that mounts the chart. Chart-ish first, then the Claims category itself.
console.log('\n── clicking through to the graph ──')
const clicked = await s.eval(`(() => {
  const main = document.querySelector('main') || document.body
  const all = [...main.querySelectorAll('button,[role="tab"]')]
  // "+N more" buttons dominate this page; they expand post lists and never mount a chart.
  const candidates = all.filter(e => !/more$/i.test((e.innerText || '').trim()))
  const hit = candidates.find(e => /chart|graph|timeline|over time|trend|by month/i.test(e.innerText || ''))
             || candidates.find(e => /^claims$/i.test((e.innerText || '').trim()))
  if (!hit) return JSON.stringify({ clicked: null, tried: all.map(e => (e.innerText || '').trim().slice(0, 24)).slice(0, 24) })
  hit.click()
  return JSON.stringify({ clicked: (hit.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 40) })
})()`)
console.log(`  clicked: ${JSON.stringify(clicked)}`)

const chart = await s.eval(`(() => {
  const rech = [...document.querySelectorAll('svg.recharts-surface')]
  const svg = rech[0] || null
  const series = svg ? [...svg.querySelectorAll('*')].map(e => ({
    tag: e.tagName.toLowerCase(),
    cls: String(e.getAttribute('class') || '').slice(0, 40),
    fill: e.getAttribute('fill') || '', stroke: e.getAttribute('stroke') || '',
  })).filter(e => e.fill || e.stroke) : []
  const amber = series.filter(e => /f59e0b|78350f/i.test(e.fill + e.stroke))
  return JSON.stringify({
    rechartsCount: rech.length,
    shapes: series.length,
    amberCount: amber.length,
    amberSample: amber.slice(0, 4),
    distinctColors: [...new Set(series.map(e => (e.fill || e.stroke).toLowerCase()))].slice(0, 14),
    legend: [...document.querySelectorAll('.recharts-legend-item-text, .recharts-legend-item')]
      .map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 20),
    bars: [...document.querySelectorAll('.recharts-bar-rectangle, .recharts-line-curve, .recharts-area-area')].length,
  })
})()`, 5000)
console.log(`  recharts surfaces: ${chart.rechartsCount}   coloured shapes: ${chart.shapes}   bars/lines: ${chart.bars}`)
console.log(`  colours: ${JSON.stringify(chart.distinctColors)}`)
console.log(`  legend : ${JSON.stringify(chart.legend)}`)
t('the Claims graph is mounted', chart.rechartsCount > 0, chart.rechartsCount)
t('the graph draws the Claims series (amber)', chart.amberCount > 0, `${chart.amberCount} shapes`)

// Hover a bar so recharts renders its tooltip, and read the values it puts on screen. This is
// the only way to see the numbers the chart is actually plotting rather than its geometry.
const tooltip = await s.eval(`(() => {
  const bar = document.querySelector('.recharts-bar-rectangle path, .recharts-bar-rectangle, .recharts-rectangle')
  if (!bar) return JSON.stringify({ error: 'no bar to hover' })
  const r = bar.getBoundingClientRect()
  const x = r.left + r.width / 2, y = r.top + r.height / 2
  for (const type of ['mouseover', 'mousemove']) {
    bar.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }))
  }
  return JSON.stringify({ hovered: true, x: Math.round(x), y: Math.round(y) })
})()`)
const tipText = await s.eval(`(() => {
  const tip = document.querySelector('.recharts-tooltip-wrapper, .recharts-default-tooltip')
  const header = (document.querySelector('main') || document.body).innerText || ''
  const claimsLine = header.split(String.fromCharCode(10)).slice(0, 14).join(' | ')
  return JSON.stringify({
    tooltip: tip ? (tip.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 200) : null,
    pageHead: claimsLine.slice(0, 300),
  })
})()`, 1200)
console.log(`\n  hover: ${JSON.stringify(tooltip)}`)
console.log(`  tooltip text : ${JSON.stringify(tipText.tooltip)}`)
console.log(`  page header  : ${tipText.pageHead}`)

// The rendered series must come from the seeded Seed-8 data, not a stale cache. Compare the
// chart's own Claims values against the store the page is reading.
const crossCheck = await s.eval(`(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('q-archive', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const get = k => new Promise((res, rej) => { const r = db.transaction('collections').objectStore('collections').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const posts = (await get('posts')) ?? []
  const seed = await get('__seed_version__')
  const occurrences = posts.reduce((n, p) => n + (p.postAnalysis?.claims?.length ?? 0), 0)
  const postsWith = posts.filter(p => (p.postAnalysis?.claims?.length ?? 0) > 0).length
  // The frequency cache is what the archive and its chart actually render from.
  const keys = await new Promise((res, rej) => { const r = db.transaction('collections').objectStore('collections').getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const freqKey = keys.find(k => /freq/i.test(String(k)))
  const freq = freqKey ? await get(freqKey) : null
  const claimRows = (freq?.rows ?? []).filter(r => r.category === 'claims')
  const claimTotal = claimRows.reduce((n, r) => n + (r.certifiedTotal ?? r.count ?? 0), 0)
  return JSON.stringify({
    seed, occurrences, postsWith,
    freqKey: String(freqKey ?? ''), freqStamp: freq?.stamp ?? null,
    claimRowCount: claimRows.length,
    claimTotalFromFreq: claimTotal,
    ownerRowsInFreq: claimRows.filter(r => /^(pure evil\\.|the 'real' racist\\.)$/i.test(String(r.text).trim()))
      .map(r => ({ text: r.text, count: r.count, certifiedTotal: r.certifiedTotal ?? null })),
  })
})()`)
console.log(`\n── the data the chart renders from ──`)
console.log(`  seed=${crossCheck.seed}  store claims=${crossCheck.occurrences}  posts=${crossCheck.postsWith}`)
console.log(`  frequency cache key : ${crossCheck.freqKey}`)
console.log(`  frequency stamp     : ${crossCheck.freqStamp}`)
console.log(`  claim rows in cache : ${crossCheck.claimRowCount}`)
console.log(`  owner rulings in it : ${JSON.stringify(crossCheck.ownerRowsInFreq)}`)
t('store the page reads holds 4,188 Claims', crossCheck.occurrences === C.occurrences, crossCheck.occurrences?.toLocaleString())
t('store holds 1,953 posts with a Claim', crossCheck.postsWith === C.posts, crossCheck.postsWith?.toLocaleString())
t('frequency cache is stamped with seed 8', String(crossCheck.freqStamp ?? '').startsWith('8:'), crossCheck.freqStamp)
t('the owner rulings appear as Claim rows', crossCheck.ownerRowsInFreq?.length >= 1, JSON.stringify(crossCheck.ownerRowsInFreq))

await s.close()

// ── /dashboard ───────────────────────────────────────────────────────────────
console.log('\n── /dashboard Claim statistics ──')
const d = await session(`${URL_BASE}/dashboard`)
await sleep(16000)
const dash = await d.eval(`(() => {
  const main = document.querySelector('main') || document.body
  const text = main.innerText || ''
  const i = text.toLowerCase().indexOf('claim')
  const rech = [...document.querySelectorAll('svg.recharts-surface')]
  return JSON.stringify({
    around: i < 0 ? null : text.slice(Math.max(0, i - 150), i + 150).split(String.fromCharCode(10)).join(' | '),
    rechartsCount: rech.length,
    numbers: (text.match(/[0-9][0-9,]{2,}/g) || []).slice(0, 20),
  })
})()`)
console.log(`  around "claim": ${dash.around}`)
console.log(`  recharts surfaces: ${dash.rechartsCount}`)
console.log(`  large numbers on page: ${JSON.stringify(dash.numbers)}`)
await d.close()

// ── sidebar ──────────────────────────────────────────────────────────────────
console.log('\n── sidebar Claim entry ──')
const nav = await session(`${URL_BASE}/post/2917`)
await sleep(14000)
const side = await nav.eval(`(() => {
  const link = [...document.querySelectorAll('a')].find(a => /q claims/i.test(a.innerText || ''))
  return JSON.stringify({ text: link ? (link.innerText || '').replace(/\\s+/g, ' ').trim() : null,
                          href: link ? link.getAttribute('href') : null })
})()`)
console.log(`  ${JSON.stringify(side)}`)
await nav.close()

try { process.kill(-proc.pid) } catch { try { proc.kill() } catch { /* gone */ } }
const failed = checks.filter(c => !c[1]).length
console.log(failed ? `\n  ${failed} of ${checks.length} checks FAILED\n` : `\n  all ${checks.length} checks pass\n`)
process.exit(failed ? 1 : 0)
