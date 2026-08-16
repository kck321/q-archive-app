// Why a certified Claim does not paint, answered by the browser rather than by reading source.
//
// Live #2917 ships postAnalysis.claims = ["Pure evil.", "The 'real' racist."] and the production
// Claim total is 4,188, yet neither sentence appears with the Claim treatment while 'real' inside
// one of them is visibly Emphasised. So the compositor IS running; the Claim layer is not
// reaching it, or is being overwritten.
//
// #570 is the control: a Claim ("PURE EVIL.") with no nested Emphasis on the same sentence. If it
// also fails to paint, the whole Claim layer is unconsumed. If only #2917 fails, the defect is in
// overlap compositing.
//
// Reports, for each target sentence: whether the text is in the DOM at all, the element chain and
// classes actually rendered, the computed background/colour, and what the app holds in IndexedDB
// for that post — so a missing paint can be attributed to data, to the span coordinates, or to
// the class assignment.
//
//   node scripts/diagnose-claim-render.mjs [--url https://qdrops.app]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const argUrl = process.argv.indexOf('--url')
const URL_BASE = argUrl > -1 ? process.argv[argUrl + 1] : 'https://qdrops.app'

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p))
if (!CHROME) { console.error('No Chrome or Edge found.'); process.exit(1) }

const sleep = ms => new Promise(r => setTimeout(r, ms))
const PORT = 9377
const PROFILE = path.join(os.tmpdir(), 'qdrops-claim-render')

fs.rmSync(PROFILE, { recursive: true, force: true })
fs.mkdirSync(PROFILE, { recursive: true })
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore', detached: true })

for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* not up */ }
  await sleep(500)
}

async function evaluate(url, expression, settleMs = 11000) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise(r => { ws.onopen = r })
  let id = 0
  const pending = new Map()
  ws.onmessage = e => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  }
  const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })
  await send('Page.enable')
  await sleep(settleMs)
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  ws.close()
  await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`)
  return r.result?.result?.value ?? { error: JSON.stringify(r.result?.exceptionDetails ?? r.result)?.slice(0, 400) }
}

// Runs inside the page. TARGETS is substituted per post.
const probe = targets => `(async () => {
  const targets = ${JSON.stringify(targets)}
  const out = { url: location.href, targets: [] }

  // What the app actually holds for this post, read from IndexedDB rather than from the network.
  out.store = await (async () => {
    try {
      const dbs = await indexedDB.databases()
      const name = (dbs.find(d => /q/i.test(d.name)) || dbs[0] || {}).name
      if (!name) return { error: 'no indexeddb' }
      const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
      const storeName = [...db.objectStoreNames].find(s => /post/i.test(s))
      if (!storeName) return { error: 'no post store', stores: [...db.objectStoreNames] }
      const all = await new Promise((res, rej) => { const r = db.transaction(storeName).objectStore(storeName).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
      const p = all.find(x => String(x.postNum) === String(${targets.postNum}))
      return p ? {
        dbName: name, storeName, count: all.length,
        claims: p.postAnalysis?.claims ?? null,
        claimSpans: p.postAnalysis?.claimSpans ?? null,
        emphasis: p.postAnalysis?.emphasis ?? null,
        contextUnits: (p.postAnalysis?.contextUnits ?? []).length,
      } : { error: 'post not in store', count: all.length }
    } catch (e) { return { error: String(e) } }
  })()

  // Every element whose own text is exactly the target, plus the highlighted fragments inside it.
  const all = [...document.querySelectorAll('*')]
  for (const t of targets.texts) {
    const hits = all.filter(el => (el.textContent || '').replace(/\\s+/g, ' ').trim() === t)
    const deepest = hits.length ? hits[hits.length - 1] : null
    const chain = []
    for (let el = deepest; el && chain.length < 5; el = el.parentElement) {
      chain.push({ tag: el.tagName.toLowerCase(), cls: el.className?.baseVal ?? String(el.className ?? ''),
        bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color })
    }
    // Any painted fragment (a span carrying classes) inside the sentence, to see what DID paint.
    const painted = deepest ? [...deepest.querySelectorAll('span,mark,em,u')].map(s => ({
      text: (s.textContent || '').slice(0, 40), cls: String(s.className ?? ''),
      bg: getComputedStyle(s).backgroundColor })) : []
    out.targets.push({
      text: t,
      inDom: hits.length > 0,
      exactMatches: hits.length,
      chain,
      painted,
      // Does the sentence appear anywhere at all, even split across nodes?
      inBodyText: (document.body.innerText || '').replace(/\\s+/g, ' ').includes(t),
    })
  }

  // The post body itself: find the container holding the drop text and dump its markup, so a
  // sentence that is "not on the page" can be told apart from one that is present but unpainted.
  // The drop is rendered into <pre class="post-text ...">. Anchor on that, not on a text match —
  // the analysis chips quote the same sentences and were mistaken for the body on the first pass.
  out.body = (() => {
    const host = [...document.querySelectorAll('pre.post-text, pre[class*="post-text"]')]
      .find(el => (el.innerText || '').includes(targets.bodyAnchor))
    if (!host) return { found: false, sample: (document.body.innerText || '').slice(0, 900) }
    // Every child element inside the drop, with what it actually paints.
    const spans = [...host.querySelectorAll('*')].map(el => ({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').slice(0, 46),
      cls: String(el.className ?? '').slice(0, 110),
      bg: getComputedStyle(el).backgroundColor,
    }))
    return { found: true, cls: String(host.className ?? ''), spanCount: spans.length, spans,
             html: host.innerHTML.slice(0, 3000) }
  })()

  // Is the drop text on the page at all? Anchored on strings unique to the body, so an analysis
  // chip that happens to quote the same sentence cannot be mistaken for the rendered drop.
  out.pageText = {
    innerTextLen: (document.body.innerText || '').length,
    marks: Object.fromEntries(targets.bodyMarks.map(m => [m, (document.body.innerText || '').includes(m)])),
    preLike: [...document.querySelectorAll('[class*=whitespace-pre],[class*=font-mono],pre,article')]
      .map(el => ({ tag: el.tagName.toLowerCase(), cls: String(el.className ?? '').slice(0, 70),
                    text: (el.innerText || '').split('\\n').join(' | ').slice(0, 180) })).slice(0, 6),
    first: (document.body.innerText || '').split('\\n').join(' | ').slice(0, 1200),
  }

  // Which highlight classes the page uses at all — proves the compositor ran.
  const classes = new Set()
  for (const el of all) { const c = String(el.className ?? ''); if (/bg-|ring-|decoration-/.test(c)) classes.add(c) }
  out.highlightClassesOnPage = [...classes].slice(0, 25)
  return JSON.stringify(out)
})()`

const POSTS = [
  { postNum: 2917, id: 2917, texts: ["Pure evil.", "The 'real' racist."], bodyAnchor: 'FAKE NEWS coverage', bodyMarks: ['#WakeUpAmerica', '5471677', 'youtube.com/watch'] },
  { postNum: 570, id: 570, texts: ['PURE EVIL.', 'THEY NEVER THOUGHT SHE WOULD LOSE.'], bodyAnchor: 'Will SESSIONS drop the hammer', bodyMarks: ['1 of 22.', 'Sessions', 'rogue_ops'] },
]

console.log(`\nCLAIM RENDER DIAGNOSIS — ${URL_BASE}\n`)
for (const p of POSTS) {
  const raw = await evaluate(`${URL_BASE}/post/${p.id}`, probe(p))
  let r
  try { r = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { r = { error: String(raw).slice(0, 500) } }
  console.log(`\n─── #${p.postNum} ${'─'.repeat(50)}`)
  if (r.error) { console.log('  ERROR:', r.error); continue }
  console.log(`  url: ${r.url}`)
  console.log(`  IndexedDB: ${JSON.stringify(r.store).slice(0, 400)}`)
  for (const t of r.targets) {
    console.log(`\n  "${t.text}"`)
    console.log(`    in DOM as own element : ${t.inDom} (${t.exactMatches} exact match(es))`)
    console.log(`    text present on page  : ${t.inBodyText}`)
    for (const c of t.chain) console.log(`      <${c.tag}> bg=${c.bg} cls=${c.cls.slice(0, 90)}`)
    if (t.painted.length) {
      console.log('    painted fragments inside:')
      for (const s of t.painted) console.log(`      ${JSON.stringify(s.text)} bg=${s.bg} cls=${s.cls.slice(0, 80)}`)
    } else console.log('    painted fragments inside: none')
  }
  console.log(`\n  PAGE TEXT: innerText ${r.pageText?.innerTextLen} chars`)
  console.log(`    body markers: ${JSON.stringify(r.pageText?.marks)}`)
  for (const e of r.pageText?.preLike ?? []) console.log(`    <${e.tag}> ${e.cls}\n         ${e.text}`)
  console.log(`    page text: ${String(r.pageText?.first ?? '').slice(0, 800)}`)

  console.log(`\n  POST BODY: found=${r.body?.found}`)
  if (r.body?.found) {
    console.log(`    container cls: ${String(r.body.cls).slice(0, 130)}`)
    console.log(`    elements inside the drop: ${r.body.spanCount}`)
    for (const s of r.body.spans ?? []) console.log(`      <${s.tag}> bg=${s.bg}  ${JSON.stringify(s.text)}
           cls=${s.cls}`)
    console.log('    innerHTML:')
    console.log(String(r.body.html).split('><').join('>\n<').split('\n').map(l => '      ' + l).join('\n'))
  } else {
    console.log('    body anchor NOT in the DOM. Page text sample:')
    console.log('      ' + String(r.body?.sample ?? '').replace(/\n/g, ' | ').slice(0, 800))
  }
}

try { process.kill(-proc.pid) } catch { try { proc.kill() } catch { /* gone */ } }
console.log('')
