// GROUND TRUTH: what the drop body actually paints, read out of the rendered DOM.
//
// audit-unhighlighted-sentences.mjs TRANSCRIBES renderPostBody() into Node and measures against
// the transcription. PROJECT_CONTEXT names that as the failure mode it is — "a near-enough
// reimplementation would invent uncovered text that is actually painted" — and a transcription
// only stays true until the renderer moves.
//
// So this asks the browser instead. It walks the text nodes inside <pre class="post-text">,
// records which character ranges sit inside a <mark> or an <a>, and reports the leftovers. No
// model, no transcription: the marks are the ones a reader can see.
//
//   node scripts/audit-painted-truth.mjs                 # every post, public build
//   node scripts/audit-painted-truth.mjs --posts 1,2,17  # named posts
//   node scripts/audit-painted-truth.mjs --limit 40      # first N posts with body text
//   node scripts/audit-painted-truth.mjs --base http://localhost:5174
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './lib/browser.mjs'
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit', 'unhighlighted-sentences')

const arg = n => {
  const i = process.argv.indexOf(n)
  return i === -1 ? null : process.argv[i + 1]
}
const BASE = arg('--base') ?? 'http://localhost:5174'
const LIMIT = arg('--limit') ? Number(arg('--limit')) : null
const ONLY = arg('--posts') ? arg('--posts').split(',').map(Number) : null

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const withText = posts.filter(p => runtimeText(p.text ?? '').trim())
let targets = ONLY ? withText.filter(p => ONLY.includes(p.postNum)) : withText
if (LIMIT) targets = targets.slice(0, LIMIT)

// ── the readout, run inside the page ─────────────────────────────────────────
// A mark's KIND comes from its title where the renderer sets one, else from the colour classes,
// so a painted range can be attributed rather than just counted.
//
// A drop that QUOTES another renders TWO pre.post-text blocks — the quoted post first, the drop
// itself second. querySelector() took the first, so on every quoting drop this measured the
// wrong body: #1010 came back as #893904's text, 122 characters shorter. The right element is
// picked by matching the text the drop is supposed to have, which also proves the offsets align
// instead of assuming it.
const READ = expected => `(() => {
  const want = ${JSON.stringify(expected)}
  const pres = [...document.querySelectorAll('pre.post-text')]
  const pre = pres.find(p => p.textContent === want)
  if (!pre) return { error: 'no pre.post-text matching the drop text (' + pres.length + ' candidates)' }
  const text = pre.textContent
  const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT, null)
  let pos = 0
  const painted = []
  while (walker.nextNode()) {
    const node = walker.currentNode
    const len = node.nodeValue.length
    let el = node.parentElement, kind = null
    while (el && el !== pre) {
      if (el.tagName === 'MARK') { kind = el.getAttribute('title') || el.className || 'mark'; break }
      if (el.tagName === 'A') { kind = 'link'; break }
      el = el.parentElement
    }
    if (kind) painted.push({ start: pos, end: pos + len, kind })
    pos += len
  }
  return { text, painted }
})()`

const NUM_READY = n => `(() => {
  const el = document.querySelector('pre.post-text')
  if (!el) return false
  return document.body.textContent.includes('#${n}') ? true : false
})()`

// ── run ──────────────────────────────────────────────────────────────────────
const browser = await launch({ mode: 'warm' })
const page = await browser.page(`${BASE}/post/${targets[0].postNum}`)
const ready = await page.waitFor(`document.querySelectorAll('pre.post-text').length > 0`, { timeout: 90000 })
if (!ready) {
  console.error(`REFUSED: ${BASE}/post/${targets[0].postNum} never rendered a drop body.`)
  console.error('Is the public dev server running?  npm run dev:public')
  process.exit(2)
}

const results = []
let mismatched = 0
const t0 = Date.now()
for (let i = 0; i < targets.length; i++) {
  const p = targets[i]
  // Client-side navigation: a full page load per post costs ~7s and there are thousands of them.
  // React Router's BrowserRouter listens on popstate, so pushState + popstate is its own path.
  await page.evaluate(`(() => {
    history.pushState({}, '', '/post/${p.postNum}')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })()`)
  const expected = runtimeText(p.text ?? '')
  // Wait for the body to BE this post's body, not merely for a body to exist — otherwise the
  // previous post's DOM is read and every offset is wrong. Exact equality against the expected
  // text is the wait condition AND the alignment proof: the glossary wraps acronyms in info
  // boxes, and if that ever injected visible text the offsets would stop meaning anything.
  const want = JSON.stringify(expected)
  const got = await page.waitFor(
    `([...document.querySelectorAll('pre.post-text')].some(p => p.textContent === ${want})) ? '1' : false`,
    { timeout: 15000, every: 60 },
  )
  if (!got) { results.push({ postNum: p.postNum, error: 'no pre matched the drop text' }); mismatched++; continue }
  const r = await page.evaluate(READ(expected))
  if (!r || r.error) { results.push({ postNum: p.postNum, error: r?.error ?? 'read failed' }); continue }

  const domText = r.text
  const aligned = domText === expected

  const n = domText.length
  const hit = new Uint8Array(n)
  for (const s of r.painted) for (let k = Math.max(0, s.start); k < Math.min(n, s.end); k++) hit[k] = 1
  // >>NNNNNN pointers are never painted by design and are not leftovers.
  const refs = [...domText.matchAll(/>>\d+/g)].map(m => [m.index, m.index + m[0].length])
  const inRef = k => refs.some(([a, b]) => k >= a && k < b)

  let total = 0, covered = 0
  const runs = []
  let runStart = null
  const close = at => {
    if (runStart === null) return
    let a = runStart, b = at
    while (a < b && /\s/.test(domText[a])) a++
    while (b > a && /\s/.test(domText[b - 1])) b--
    if (b > a) runs.push({ start: a, end: b, text: domText.slice(a, b) })
    runStart = null
  }
  for (let k = 0; k < n; k++) {
    if (/\s/.test(domText[k])) continue
    if (inRef(k)) continue
    total++
    if (hit[k]) { covered++; close(k) } else if (runStart === null) runStart = k
  }
  close(n)

  results.push({
    postNum: p.postNum,
    aligned,
    domText,
    // The RANGES, not just the count. Storing only a tally made the downstream pass read every
    // post as 100% unpainted and report 29,563 leftovers with a straight face — its "marks read
    // from the DOM: 0" line is the only reason that was caught.
    painted: r.painted,
    markCount: r.painted.length,
    kinds: [...new Set(r.painted.map(s => s.kind))],
    totalChars: total,
    paintedChars: covered,
    uncoveredChars: total - covered,
    pct: total ? covered / total : 1,
    runs,
  })
  if ((i + 1) % 50 === 0 || i === targets.length - 1) {
    const rate = (i + 1) / ((Date.now() - t0) / 1000)
    process.stdout.write(`\r  ${i + 1}/${targets.length} posts  ${rate.toFixed(1)}/s  eta ${Math.round((targets.length - i - 1) / rate)}s   `)
  }
}
process.stdout.write('\n')
await page.close()

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'painted-truth.jsonl'), results.map(r => JSON.stringify(r)).join('\n') + '\n')

const ok = results.filter(r => !r.error)
const fully = ok.filter(r => r.uncoveredChars === 0)
console.log(`\nPAINTED GROUND TRUTH  —  ${BASE}\n`)
console.log(`  posts read                : ${ok.length.toLocaleString()}${results.length - ok.length ? `  (${results.length - ok.length} failed)` : ''}`)
console.log(`  DOM text != runtimeText   : ${mismatched}`)
console.log(`  posts fully painted       : ${fully.length.toLocaleString()}  (${(fully.length * 100 / (ok.length || 1)).toFixed(1)}%)`)
console.log(`  posts with leftovers      : ${(ok.length - fully.length).toLocaleString()}`)
console.log(`  leftover runs             : ${ok.reduce((n, r) => n + r.runs.length, 0).toLocaleString()}`)
console.log(`  characters left unpainted : ${ok.reduce((n, r) => n + r.uncoveredChars, 0).toLocaleString()} of ${ok.reduce((n, r) => n + r.totalChars, 0).toLocaleString()}`)
console.log(`\n→ ${path.relative(ROOT, path.join(OUT, 'painted-truth.jsonl'))}\n`)
