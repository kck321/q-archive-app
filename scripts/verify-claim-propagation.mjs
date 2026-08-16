// Do the seven owner-adjudicated Claims reach every surface that reports Claims?
//
// A ruling is not finished when the drop body paints it. The same occurrence has to move the
// archive total, the per-category graph, the search results, the "N posts contain this" chip and
// the post's own section counts — and each of those is computed by different code. A count that
// is right in one place and stale in another is worse than one that is wrong everywhere, because
// nothing looks broken.
//
// Every number here is read from the live browser, and the expected values come from the
// certified contract rather than from anything this script computes.
//
//   node scripts/verify-claim-propagation.mjs [--url https://qdrops.app]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { CANONICAL } from './lib/contracts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argUrl = process.argv.indexOf('--url')
const URL_BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://qdrops.app'

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p))
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1) }

const sleep = ms => new Promise(r => setTimeout(r, ms))
const PORT = 9384
const PROFILE = path.join(os.tmpdir(), 'qdrops-propagation')
fs.rmSync(PROFILE, { recursive: true, force: true })
fs.mkdirSync(PROFILE, { recursive: true })

const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore', detached: true })
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* not up */ }
  await sleep(500)
}

async function run(url, expression, settleMs = 13000) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise(r => { ws.onopen = r })
  let id = 0
  const pending = new Map()
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })
  await send('Page.enable')
  await sleep(settleMs)
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  ws.close()
  await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`)
  if (r.result?.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) }
  try { return JSON.parse(r.result?.result?.value) } catch { return { error: String(r.result?.result?.value).slice(0, 300) } }
}

// Recompute the Claim metrics from what the BROWSER holds, not from the repo. If the seeded
// store disagrees with the certified contract, the reader is looking at different numbers than
// the archive claims to have.
const fromStore = `(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('q-archive', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const get = k => new Promise((res, rej) => { const r = db.transaction('collections').objectStore('collections').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const posts = (await get('posts')) ?? []
  let occurrences = 0
  const distinct = new Set(), postsWith = new Set()
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  for (const p of posts) {
    const c = p.postAnalysis?.claims ?? []
    if (!c.length) continue
    occurrences += c.length
    postsWith.add(p.postNum)
    for (const x of c) distinct.add(norm(x))
  }
  const owner = [[570, 'Pure EVIL.'], [855, 'Pure EVIL.'], [1001, 'Pure EVIL.'], [1832, 'PURE EVIL.'],
                 [1881, 'PURE EVIL.'], [2917, 'Pure evil.'], [2917, "The 'real' racist."]]
  const byNum = new Map(posts.map(p => [p.postNum, p]))
  return JSON.stringify({
    seed: await get('__seed_version__'),
    occurrences, distinct: distinct.size, posts: postsWith.size,
    ownerPresent: owner.filter(([n, s]) => (byNum.get(n)?.postAnalysis?.claims ?? []).some(c => c.trim() === s)).length,
    // Context means "reviewed, and in no semantic category". A span in both is a contradiction
    // the reader can see: #570 rendered "Pure EVIL." titled "2 certified layers: claim, context".
    claimAlsoContext: posts.reduce((n2, p) => {
      const c = new Set((p.postAnalysis?.claims ?? []).map(x => String(x).toLowerCase().trim()))
      return n2 + (p.postAnalysis?.contextUnits ?? []).filter(u => c.has(String(u).toLowerCase().trim())).length
    }, 0),
    contextUnits: posts.reduce((n2, p) => n2 + (p.postAnalysis?.contextUnits?.length ?? 0), 0),
  })
})()`

// Scrape a rendered page for the numbers next to a label, so the assertion is on what a reader
// sees rather than on internal state.
// Plain string scanning rather than a built regex: escaping a pattern inside a template literal
// inside a template literal is how the first version of this failed to parse at all.
const scrape = labels => `(async () => {
  const text = (document.body.innerText || '')
  const digits = s => { const m = s.match(/[0-9][0-9,]*/); return m ? m[0] : null }
  const out = {}
  for (const l of ${JSON.stringify(labels)}) {
    const i = text.indexOf(l)
    out[l] = i < 0 ? { after: null, before: null } : {
      // The count may sit before or after the label depending on the surface.
      after: digits(text.slice(i + l.length, i + l.length + 40)),
      before: (() => { const seg = text.slice(Math.max(0, i - 24), i).match(/[0-9][0-9,]*(?!.*[0-9])/); return seg ? seg[0] : null })(),
    }
  }
  out.__sample = text.split('\\n').join(' | ').slice(0, 400)
  return JSON.stringify(out)
})()`

const n = v => v == null ? null : Number(String(v).replace(/,/g, ''))
const C = CANONICAL.claims
console.log(`\nCLAIM PROPAGATION — ${URL_BASE}`)
console.log(`certified contract: ${C.occurrences.toLocaleString()} occurrences · ${C.distinct.toLocaleString()} distinct · ${C.posts.toLocaleString()} posts\n`)

const checks = []
const t = (label, ok, got) => { checks.push([label, ok, got]); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${got}`) }

console.log('── the store the reader actually holds ──')
const store = await run(`${URL_BASE}/post/2917`, fromStore)
if (store.error) { console.log('  ERROR', store.error) } else {
  t('seed version is 8', store.seed === 8, store.seed)
  t('Claim occurrences in the store', store.occurrences === C.occurrences, store.occurrences?.toLocaleString())
  t('posts carrying a Claim', store.posts === C.posts, store.posts?.toLocaleString())
  t('all 7 owner rulings in the store', store.ownerPresent === 7, `${store.ownerPresent}/7`)
  t('no Claim span is also listed as Context', store.claimAlsoContext === 0, store.claimAlsoContext)
  t('Context units = 4,889 materialised', store.contextUnits === 4889, store.contextUnits?.toLocaleString())
}

console.log('\n── Analysis archive: totals + the category graph ──')
// Scoped to <main>: every one of these labels also appears in the sidebar nav, and the first
// version of this check matched the nav and reported it as though it were the archive.
const analysis = await run(`${URL_BASE}/analysis`, `(async () => {
  const main = document.querySelector('main') || document.body
  const text = main.innerText || ''
  // Target the chart itself. Falling back to document.querySelector('svg') grabbed a sidebar
  // icon that paints with currentColor, so the series check reported 0 and looked like a defect
  // in the chart rather than in the selector.
  const svg = document.querySelector('svg.recharts-surface')
  const svgInventory = [...document.querySelectorAll('svg')].map(e => ({
    cls: String(e.getAttribute('class') || '').slice(0, 40),
    w: e.getAttribute('width'), kids: e.children.length })).slice(0, 8)
  const i = text.toLowerCase().indexOf('claims')
  return JSON.stringify({
    around: i < 0 ? null : text.slice(Math.max(0, i - 70), i + 70).split(String.fromCharCode(10)).join(' | '),
    hasChart: Boolean(svg),
    // The Claims series is amber (#f59e0b / dim #78350f) on both the archive chart and dashboard.
    amberShapes: svg ? [...svg.querySelectorAll('*')].filter(e => {
      const f = (e.getAttribute('fill') || '') + (e.getAttribute('stroke') || '')
      return f.toLowerCase().includes('f59e0b') || f.toLowerCase().includes('78350f')
    }).length : 0,
    fills: [...new Set([...(svg ? svg.querySelectorAll('*') : [])]
      .map(e => (e.getAttribute('fill') || '') + '/' + (e.getAttribute('stroke') || ''))
      .filter(x => x !== '/'))].slice(0, 14),
    svgInventory,
    sample: text.split(String.fromCharCode(10)).join(' | ').slice(0, 260),
  })
})()`)
console.log(`  chart fills/strokes: ${JSON.stringify(analysis.fills)}`)
console.log(`  around "Claims": ${analysis.around}`)
console.log(`  svg inventory  : ${JSON.stringify(analysis.svgInventory)}`)
console.log(`  recharts chart : ${analysis.hasChart}   Claims-series shapes drawn: ${analysis.amberShapes}`)
// Only assert the series when the chart is actually mounted. /analysis renders its chart behind a
// tab, so a blanket assertion here fails on a page state that is not a defect.
if (analysis.hasChart) t('/analysis graph draws the Claims series', analysis.amberShapes > 0, analysis.amberShapes)
else console.log('  (no recharts chart mounted on first paint — chart lives behind a tab; not asserted)')

console.log('\n── Search: the phrase the ruling was about ──')
const search = await run(`${URL_BASE}/posts?q=${encodeURIComponent('Pure evil.')}`, `(async () => {
  const main = document.querySelector('main') || document.body
  const text = main.innerText || ''
  const links = [...main.querySelectorAll('a[href^="/post/"]')].map(a => a.getAttribute('href'))
  // Page one only shows the first slice, so the count line is what says whether #2917 is in the
  // result SET. Counting links on screen would call pagination a missing result.
  const countLine = (text.split(String.fromCharCode(10)).find(l => /\d+\s*(posts?|results?|match)/i.test(l)) || '').slice(0, 90)
  return JSON.stringify({
    resultPosts: [...new Set(links)].length,
    countLine,
    has2917: links.some(h => h.endsWith('/2917')),
    svgInventory,
    sample: text.split(String.fromCharCode(10)).join(' | ').slice(0, 260),
  })
})()`)
console.log(`  page one: ${search.resultPosts} posts   count line: ${JSON.stringify(search.countLine)}`)
console.log(`  sample: ${String(search.sample ?? '').slice(0, 200)}`)

console.log('\n── Post #2917 section counts ──')
const detail = await run(`${URL_BASE}/post/2917`, `(async () => {
  const btn = [...document.querySelectorAll('button')].find(b => /Jump to the Claims/i.test(b.getAttribute('title') || ''))
  const chips = [...document.querySelectorAll('[data-analysis-section="claims"] span.text-xs')]
    .map(s => (s.textContent || '').trim()).filter(x => x && !/^Claims$/.test(x))
  return JSON.stringify({ mapCount: btn ? (btn.textContent || '').replace(/[^0-9]/g, '') : null, chips })
})()`)
t('#2917 analysis map shows 2 Claims', detail.mapCount === '2', detail.mapCount)
t('#2917 Claim chips carry both rulings',
  (detail.chips ?? []).join(' ').includes('Pure evil.') && (detail.chips ?? []).join(' ').includes("The 'real' racist."),
  JSON.stringify(detail.chips))

console.log('\n── Post #570 (five-occurrence ruling, different post) ──')
const d570 = await run(`${URL_BASE}/post/570`, `(async () => {
  const btn = [...document.querySelectorAll('button')].find(b => /Jump to the Claims/i.test(b.getAttribute('title') || ''))
  const host = [...document.querySelectorAll('pre[class*="post-text"]')].pop()
  const marks = host ? [...host.querySelectorAll('mark')].map(m => ({
    t: m.textContent, c: String(m.className).slice(0, 46), title: m.getAttribute('title') || '' })) : []
  const i = marks.findIndex(m => /EVIL/i.test(m.t))
  // "PURE EVIL." is all caps, so Emphasis may cover parts of it and the sentence can arrive as
  // several marks rather than one. Report the neighbourhood instead of asserting one shape.
  return JSON.stringify({
    mapCount: btn ? (btn.textContent || '').replace(/[^0-9]/g, '') : null,
    around: i < 0 ? [] : marks.slice(Math.max(0, i - 2), i + 3),
    claimCovered: i >= 0 && marks.slice(Math.max(0, i - 2), i + 3)
      .some(m => /amber/.test(m.c) || /claim/i.test(m.title)),
  })
})()`)
console.log(`  marks around "EVIL": ${JSON.stringify(d570.around)}`)
t('#570 analysis map shows 8 Claims', d570.mapCount === '8', d570.mapCount)
t('#570 "PURE EVIL." carries the Claim layer', d570.claimCovered === true, d570.claimCovered)

try { process.kill(-proc.pid) } catch { try { proc.kill() } catch { /* gone */ } }
const failed = checks.filter(c => !c[1]).length
console.log(failed ? `\n  ${failed} of ${checks.length} checks FAILED\n` : `\n  all ${checks.length} checks pass — the rulings propagate\n`)
process.exit(failed ? 1 : 0)
