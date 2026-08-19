// Browser proof: a URL in a drop is ONE link carrying the WHOLE address.
//
// The annotation layer splits post text at every span boundary, and `url` sits low in the
// priority table — so a term classified inside a link took that sub-interval for itself and the
// address came out in pieces. #2166 rendered theverge.com/2018/9/12/17847186/reddit-qanon-... as
// three nodes: an anchor holding the part before `reddit`, the word as a plain mark, then a
// fragment. The visible link went to a truncated URL, which is worse than no link — it looks like
// it worked. This asserts the whole address is one anchor, and that the marks inside it survive.
import { launch } from './lib/browser.mjs'
import fs from 'node:fs'

const BASE = process.env.QDROPS_BASE ?? 'http://localhost:5173'
const D = { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false, touch: false }
const fail = m => { console.error(`FAIL: ${m}`); process.exitCode = 1 }
const ok = m => console.log(`ok: ${m}`)
const b = await launch()
console.log(`browser on :${b.port} (${b.reused ? 'warm' : 'cold'}) against ${BASE}`)

const posts = JSON.parse(fs.readFileSync('public/data/posts.json', 'utf8'))
const URL_RX = /https?:\/\/[^\s<>"')\]]+/g
// A spread across the archive, plus #2166 which is the case this gate exists for.
const withUrls = posts.filter(p => (p.text || '').match(URL_RX))
const pick = ['2166', ...withUrls.filter((_, i) => i % Math.max(1, Math.floor(withUrls.length / 14)) === 0).map(p => p.id).slice(0, 14)]
const seen = new Set()
let checked = 0, broken = 0, marksInside = 0, sourcesOk = 0, sourcesBad = 0
const canonUrl = u => String(u).replace(/[.,;:!?)]+$/, '').replace(/\/+$/, '').toLowerCase()

for (const id of pick) {
  if (seen.has(id)) continue
  seen.add(id)
  const post = posts.find(p => String(p.id) === String(id))
  // Post text stores HTML entities (&amp;) but the rendered href is decoded, so compare decoded.
  const decode = u => u.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  const full = ((post?.text || '').match(URL_RX) || []).map(decode)
  if (!full.length) continue
  const p = await b.page(`${BASE}/post/${id}`, D)
  await p.waitFor(`document.querySelector('.post-text') !== null`, { timeout: 60000 })
  await new Promise(s => setTimeout(s, 1200))
  const hrefs = String(await p.evaluate(`[...document.querySelectorAll('.post-text a')].map(a => a.getAttribute('href')).join('|||')`))
    .split('|||').filter(h => h && /^https?:/.test(h))
  marksInside += Number(await p.evaluate(`[...document.querySelectorAll('.post-text a mark')].length`))
  checked++
  const truncated = hrefs.map(decode).filter(h => !full.includes(h))
  if (truncated.length) { broken++; fail(`#${id}: anchor href is not a complete URL — ${truncated[0].slice(0, 80)}`) }

  // EVERY link in the drop is accounted for in "Sources linked in this drop". That section is
  // built from the certified URL cleanup, which was never a complete list — #2166 carried two
  // links and listed one, because only theverge.com had been adjudicated. The uncovered ones are
  // now listed beside the certified rows, marked as links the archive has not identified.
  const listed = String(await p.evaluate(`(() => {
    const h = [...document.querySelectorAll('h3')].find(x => /Sources linked/i.test(x.textContent || ''))
    if (!h) return ''
    return [...h.closest('section').querySelectorAll('a')].map(a => a.getAttribute('href') || '').join('|||')
  })()`)).split('|||').filter(Boolean).map(decode)
  const missingFromSources = [...new Set(full)].filter(u => !listed.some(l => canonUrl(l) === canonUrl(u)))
  if (missingFromSources.length) {
    sourcesBad++
    fail(`#${id}: ${missingFromSources.length} link(s) in the drop are absent from Sources — ${missingFromSources[0].slice(0, 70)}`)
  } else sourcesOk++

  // Close EVERY page. Leaving one open keeps the harness socket alive, the gate never exits, and
  // validate.mjs waits on it forever — which is exactly how this file hung a full run for 18
  // minutes after printing its own GREEN verdict.
  await p.close()
}

if (checked === 0) fail('no posts with URLs were checked')
else if (broken === 0) ok(`every anchor carries a complete URL across ${checked} drops`)
// The whole point of wrapping rather than suppressing: classifications inside a link still show.
if (sourcesBad === 0 && sourcesOk > 0) ok(`every link in the drop is listed in "Sources linked in this drop" (${sourcesOk} drops)`)
if (marksInside > 0) ok(`classifications inside links still render (${marksInside} mark(s) nested in anchors)`)
else console.log('   note: no sampled drop had a classified term inside a URL')

console.log(process.exitCode ? '\nURL INTEGRITY PROOF: FAILED' : '\nURL INTEGRITY PROOF: GREEN')
