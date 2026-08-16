// Certify "Q+" as an alias of Donald Trump.
//
// Q+ was never adjudicated as an entity. It existed ONLY in aliases.json — the owner's
// search-synonym registry — where it is listed under "potus". That is why the entity page
// advertised Q+ as one of POTUS's other names while not one of the 36 drops containing it ever
// lit up: a term can be DISPLAYED as an alias without ever being MATERIALISED as one, and the
// display registry has no occurrences to render.
//
// TWO OWNER RULINGS, 2026-08-16:
//
//   1. Q+ certifies under DONALD TRUMP, the person, joining Trump / TRUMP / DONALD J. TRUMP /
//      DJT. POTUS stays the office. The search registry still connects Q+ to POTUS, which is
//      correct for SEARCH — the man and the office are the same human — but the entity registry
//      names the man.
//
//   2. ALL 36 OCCURRENCES COUNT, SIGN-OFFS INCLUDED. This deliberately DIVERGES from the bare-Q
//      rule set a day earlier, and the divergence is the point. Bare Q signs ~4,000 drops, so
//      highlighting the signature would drown the 10 body references that actually say something.
//      Q+ signs 36. At that size WHICH drops Q chose to sign "Q+" is itself the information —
//      the + is the claim that the President is present at the signing — so the signature is
//      evidence here rather than noise. Same structural fact, opposite editorial answer, because
//      the scale is what made the bare-Q signature worthless.
//
// Only 3 of the 36 are body references (#2401 "(((Q+)))", #2565 "Q 0 = Q+", #2567
// "AF1 Code Change > Q 0 > Q+"); the other 33 are terminal sign-offs.
//
//   node scripts/apply-qplus.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/posts.json'), 'utf8'))

// Match on clean() — the same text the materialiser and the renderer see. #2401 carries a
// <span class="detected"> wrapper and #2567 carries &gt;, so a raw-text count would disagree
// with what is rendered.
const rx = /\bQ\+(?![A-Za-z0-9])/g
const hits = []
let occ = 0
for (const p of posts) {
  const t = clean(p.text ?? '')
  rx.lastIndex = 0
  const lines = t.split('\n')
  let sigLine = -1
  for (let i = lines.length - 1; i >= 0; i--) { if (lines[i].trim()) { sigLine = i; break } }
  let n = 0, body = 0
  lines.forEach((line, li) => {
    rx.lastIndex = 0
    let m
    while ((m = rx.exec(line)) !== null) { n++; if (!(li === sigLine && line.trim() === 'Q+')) body++ }
  })
  if (n) { hits.push({ postNum: p.postNum, n, body }); occ += n }
}
hits.sort((a, b) => a.postNum - b.postNum)

console.log(`Q+ occurrences: ${occ} across ${hits.length} posts`)
console.log(`  body references : ${hits.filter(h => h.body).map(h => '#' + h.postNum).join(' ')}`)
console.log(`  terminal sign-offs: ${hits.filter(h => !h.body).length} posts`)
if (process.argv.includes('--dry')) process.exit(0)

const P = path.join(ROOT, 'audit/entities-owner-rulings.json')
const j = JSON.parse(fs.readFileSync(P, 'utf8'))
if (j.aliasRulings.some(r => r.alias === 'Q+')) { console.log('already ruled — nothing to do'); process.exit(0) }
j.aliasRulings.push({
  alias: 'Q+', canonical: 'Donald Trump', recount: true, ruledOn: '2026-08-16',
  includePosts: hits.map(h => h.postNum),
  reasoning: 'Owner ruling: Q+ is the coded designation for Donald J. Trump — Q "plus one", the President present with Q. Certified on the PERSON entity beside DJT, not on POTUS, which is the office. It had never been adjudicated at all: aliases.json listed Q+ as a search synonym of POTUS, so the app named it as an alias while having no occurrences to highlight.',
  readerNote: 'Q+ is Q\'s designation for President Donald J. Trump. Q signed 36 drops with it instead of the usual bare "Q" — the "+" asserting that the President was present.',
  retrieval: `${occ} occurrences across ${hits.length} posts. Sign-offs INCLUDED, unlike the bare-Q signature: Q+ signs 36 drops, not thousands, so which drops carry it is itself the record. 3 are body references (#2401, #2565, #2567); 33 are terminal sign-offs.`,
  renderNote: 'RENDERING_PROVENANCE_RULE: the renderer highlights the token, the form Q wrote.',
})
fs.writeFileSync(P, JSON.stringify(j, null, 2) + '\n')
console.log('Q+ ruling written -> Donald Trump')
