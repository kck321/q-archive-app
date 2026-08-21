// Recover the quoted content behind every ">>NNNNNNN" pointer.
//
// Our `references` field was destroyed at ingest — every entry is the literal string
// "[object Object]", in Firestore too, so re-exporting cannot bring it back. 1,586 pointers
// across 1,547 drops currently render as bare numbers; 211 drops are NOTHING BUT a pointer
// and show as blank rows.
//
// The original boards can't supply it: 8ch.net is gone and 8kun.top 302s every one of those
// old thread ids to its index. qalerts.app, however, server-renders the quoted post inside
// the drop's card — author, tripcode, device ID, board link, text and images — so a single
// page fetch per referencing drop recovers the lot.
//
// Writes JSONL incrementally and skips anything already captured, so an interrupted run just
// picks up where it stopped.
//
//   node scripts/scrape-references.mjs [--limit N] [--force]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const POSTS = path.join(ROOT, 'public', 'data', 'posts.json')
const OUT = path.join(ROOT, 'scripts', '.cache', 'references.jsonl')

const CONCURRENCY = 4          // polite: qalerts is one person's archive, not a CDN
const DELAY_MS = 120
const RETRIES = 3

const args = process.argv.slice(2)
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity
const force = args.includes('--force')

// ── HTML → text ────────────────────────────────────────────────────────────────
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#039': "'" }
function decode(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (ENTITIES[e.toLowerCase()] !== undefined) return ENTITIES[e.toLowerCase()]
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return m
  })
}
/** Strip markup but keep the text, including link hrefs which qalerts renders as their URL. */
function toText(html) {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/\r/g, '').trimEnd()
}

// ── card parsing ───────────────────────────────────────────────────────────────
/** Slice out balanced <div>…</div> starting at the opening tag at `from`. */
function sliceDiv(html, from) {
  const tag = /<\/?div\b[^>]*>/gi
  tag.lastIndex = from
  let depth = 0, m
  while ((m = tag.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1
    if (depth === 0) return html.slice(from, tag.lastIndex)
  }
  return null
}

function parseReferences(html, postNum) {
  const cardStart = html.indexOf(`id="postcard${postNum}"`)
  if (cardStart === -1) return null                       // page didn't render this drop
  const footer = html.indexOf(`id="footer${postNum}"`, cardStart)
  const card = html.slice(cardStart, footer === -1 ? undefined : footer)

  const refs = []
  // Each quoted post is a nested card carrying a `secondary-card-header`.
  const headerRe = /<div class="card-header secondary-card-header">/g
  let hm
  while ((hm = headerRe.exec(card))) {
    // Walk back to the nested card's own opening <div>, then take the whole block.
    // The trailing space matters: `card-header` would otherwise match and we'd slice the
    // header we just found instead of the card wrapping it.
    const openIdx = card.lastIndexOf('<div class="card ', hm.index)
    const block = openIdx === -1 ? null : sliceDiv(card, openIdx)
    if (!block) continue

    const header = sliceDiv(block, block.indexOf('<div class="card-header secondary-card-header">')) ?? ''
    const bodyIdx = block.indexOf('<div class="card-body secondary-card-body')
    const body = bodyIdx === -1 ? '' : (sliceDiv(block, bodyIdx) ?? '')

    const linkM = header.match(/href="(https?:\/\/[^"]*#(\d+))"/i)
    const nameM = header.match(/<strong[^>]*title="Name"[^>]*>([^<]*)<\/strong>/i)
    const tripM = header.match(/title="Trip Code"[^>]*>([^<]*)</i)
    const idM = header.match(/title="User Device ID"[^>]*>\s*ID:\s*([^<]*)</i)
      ?? header.match(/ID:\s*([0-9a-f]{6})\s*</i)
    const timeM = header.match(/<div>([A-Z][a-z]{2} \d{1,2}, \d{4}[^<]*)<\/div>/)

    // The quoted text sits in the pre-wrap div; anything after it is media markup.
    const textM = body.match(/<div style="white-space:pre-wrap"[^>]*>([\s\S]*?)<\/div>/)
    const media = [...block.matchAll(/<a href="(\/media\/[^"]+)"[^>]*>\s*<img/g)].map(m => ({
      url: `https://qalerts.app${m[1]}`,
      filename: decodeURIComponent(m[1].split('/').pop() ?? ''),
    }))

    const text = textM ? toText(textM[1]) : ''
    if (!text && !media.length) continue

    refs.push({
      boardId: linkM?.[2] ?? '',
      link: linkM?.[1] ?? '',
      name: nameM ? decode(nameM[1]).trim() : '',
      trip: tripM ? decode(tripM[1]).trim() : '',
      userId: idM ? idM[1].trim() : '',
      time: timeM ? timeM[1].trim() : '',
      text,
      media,
    })
  }
  return refs
}

// ── fetching ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchPost(postNum) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(`https://qalerts.app/?n=${postNum}`, {
        headers: { 'User-Agent': 'q-archive-app/1.0 (personal research archive)' },
        signal: AbortSignal.timeout(30000),
      })
      if (res.status === 429 || res.status >= 500) throw new Error(`http ${res.status}`)
      if (!res.ok) return { postNum, error: `http ${res.status}` }
      return { postNum, refs: parseReferences(await res.text(), postNum) }
    } catch (err) {
      if (attempt === RETRIES) return { postNum, error: String(err?.message ?? err) }
      await sleep(1000 * attempt * attempt)
    }
  }
}

// ── run ────────────────────────────────────────────────────────────────────────
const posts = JSON.parse(fs.readFileSync(POSTS, 'utf8'))
// THE POINTER IS NOT ALWAYS A LITERAL '>>'.
//
// This matched /(^|\s|>)>>\d+/ only, and 41 drops store the pointer HTML-ENCODED as "&gt;&gt;".
// They were never targeted, so they were never fetched, so apply-references.mjs had nothing to
// restore and their quoted post stayed missing. Eleven of them are NOTHING BUT a pointer, which is
// why #4862 rendered as a bare ">>11070453" while qalerts served the full drop — the "dead post".
// The other thirty show a naked reference number in the middle of otherwise normal prose.
//
// Decode first and match once, so a future encoding variant fails loudly as a missing drop rather
// than silently narrowing the target set.
const pointerRx = /(?:^|\s|>)>>\d+/
const hasPointer = t => pointerRx.test(String(t ?? '').replace(/&gt;/gi, '>'))
const targets = posts.filter(p => hasPointer(p.text)).map(p => p.postNum)

fs.mkdirSync(path.dirname(OUT), { recursive: true })
const done = new Set()
if (fs.existsSync(OUT) && !force) {
  for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { const r = JSON.parse(line); if (!r.error) done.add(r.postNum) } catch { /* partial line */ }
  }
} else if (force && fs.existsSync(OUT)) {
  fs.rmSync(OUT)
}

// --only 2124 — fetch one drop and dump what was parsed, for checking the selectors.
if (args.includes('--only')) {
  const n = Number(args[args.indexOf('--only') + 1])
  console.log(JSON.stringify(await fetchPost(n), null, 1))
  process.exit(0)
}

const queue = targets.filter(n => !done.has(n)).slice(0, limit)
console.log(`drops with >> pointers : ${targets.length}`)
console.log(`already captured       : ${done.size}`)
console.log(`fetching               : ${queue.length}  (concurrency ${CONCURRENCY})`)
if (!queue.length) { console.log('nothing to do'); process.exit(0) }

const out = fs.createWriteStream(OUT, { flags: 'a' })
let completed = 0, failed = 0, refCount = 0
const started = Date.now()

async function worker(items) {
  for (const n of items) {
    const r = await fetchPost(n)
    if (r.error || r.refs === null) failed++
    else refCount += r.refs.length
    out.write(JSON.stringify(r) + '\n')
    completed++
    if (completed % 25 === 0 || completed === queue.length) {
      const rate = completed / ((Date.now() - started) / 1000)
      const eta = Math.round((queue.length - completed) / Math.max(rate, 0.01))
      process.stdout.write(
        `\r  ${completed}/${queue.length}  refs ${refCount}  failed ${failed}  ` +
        `${rate.toFixed(1)}/s  eta ${Math.floor(eta / 60)}m${String(eta % 60).padStart(2, '0')}s   `
      )
    }
    await sleep(DELAY_MS)
  }
}

const lanes = Array.from({ length: CONCURRENCY }, (_, i) => queue.filter((_, j) => j % CONCURRENCY === i))
await Promise.all(lanes.map(worker))
out.end()
console.log(`\n\ncaptured ${refCount} references across ${completed - failed} drops (${failed} failed)`)
console.log(`→ ${path.relative(ROOT, OUT)}`)
console.log('next: node scripts/apply-references.mjs')
