// The UNLOCATED entity/anchor rows, with the evidence each one needs. Reports only.
//
//   node scripts/review-unlocated.mjs --family CASE_VARIANT_REFUSED_E_DIFFERENT_IDENTITY
//
// For each row: the identity and every form registered for it, whether any of those forms appears
// on the drop under some other casing, where, whether that position is Q-authored prose or a link
// or quoted material, whether another registered identity also claims that spelling, and — the
// question the refusals turned on — how many OTHER drops carry the same spelling without
// recording this identity, which is what makes a corpus-wide alias unsafe and a scoped one safe.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import { buildEntityForms } from './lib/entityForms.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
const tax = rd('audit/step3b1-conflict-taxonomy-rebuilt.json')
const posts = rd('public/data/posts.json')
const entities = rd('public/data/entities.json')
const byNum = new Map(posts.map(p => [p.postNum, p]))
const forms = buildEntityForms(entities)
const argv = process.argv.slice(2)
const val = f => { const i = argv.indexOf(f); return i > -1 ? argv[i + 1] : null }

const family = val('--family')
let rows = (tax.rows ?? []).filter(r => r.reason === 'UNLOCATED_SPAN')
if (family) rows = rows.filter(r => r.subtype === family)
const from = Number(val('--from') ?? 0)
rows = rows.slice(from, from + Number(val('--count') ?? rows.length))

const wb = s => new RegExp(`(?<![A-Za-z0-9])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'g')
const entByCanonical = new Map(entities.entities.map(e => [e.canonical, e]))

// how many drops carry this spelling word-bounded, and how many of those record the identity
function corpusReach(spelling, canonical) {
  let carry = 0, record = 0
  for (const p of posts) {
    const t = runtimeText(p.text ?? '')
    if (!wb(spelling).test(t)) continue
    carry++
    if ((p.postAnalysis?.namedEntities ?? []).some(x => forms.canonicalFor(String(x)) === canonical || String(x) === canonical)) record++
  }
  return { carry, record }
}

for (const [i, r] of rows.entries()) {
  const p = byNum.get(r.postNum)
  const body = runtimeText(p.text ?? '')
  const e = entByCanonical.get(r.identity ?? r.certifiedValue)
  const registered = e ? [e.canonical, ...(e.aliases ?? []).map(a => a.text ?? a)] : [r.certifiedValue]
  const src = sourceLines(p.text ?? '')
  const lines = String(p.text ?? '').split('\n')
  const isLink = l => /^\s*(https?:|www\.)|^\s*>>\d+\s*$/i.test(l)

  console.log('-'.repeat(96))
  console.log(`[${from + i}] #${r.postNum}  ${JSON.stringify(r.certifiedValue)}  (${r.subtype})`)
  console.log(`  registered forms: ${JSON.stringify(registered)}`)
  console.log(`  refusedBecause  : ${r.refusedBecause ?? '-'}`)
  console.log(`  caseInsensitive : ${r.locatedCaseInsensitivelyUnder ?? 'none'}   quotedPost: ${r.locatedInQuotedPostUnder}   groupsClaiming: ${r.registryGroupsClaimingThisSpelling}`)

  // find every case-insensitive word-bounded hit of any registered form, and say where it sits
  const hits = []
  for (const f of registered) {
    const re = new RegExp(`(?<![A-Za-z0-9])${String(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'gi')
    let m
    while ((m = re.exec(body))) {
      // which line is that offset on
      let off = 0, li = 0
      for (let k = 0; k < lines.length; k++) {
        const len = runtimeText(lines[k]).length
        if (m.index >= off && m.index <= off + len) { li = k; break }
        off += len + 1
      }
      hits.push({ form: f, at: m.index, text: m[0], line: li,
        where: isLink(lines[li]) ? 'LINK' : src.has(li) ? 'QUOTED/PASTED' : 'Q prose',
        exact: m[0] === f })
    }
  }
  if (!hits.length) console.log('  NO word-bounded hit of any registered form, in any casing')
  for (const h of hits) console.log(`  hit ${JSON.stringify(h.text).padEnd(26)} @${String(h.at).padStart(5)} line ${String(h.line).padStart(2)} ${h.where.padEnd(14)} ${h.exact ? 'EXACT CASE' : 'case differs from "' + h.form + '"'}`)

  // the corpus question: is a scoped alias needed, or would a global one be safe
  const spell = hits.length ? hits[0].text : null
  if (spell && e) {
    const { carry, record } = corpusReach(spell, e.canonical)
    console.log(`  corpus: ${carry} drop(s) write ${JSON.stringify(spell)} word-bounded; ${record} of them record ${e.canonical}`)
    console.log(`          -> ${carry === record ? 'a corpus-wide alias would be SAFE' : `a corpus-wide alias would add this identity to ${carry - record} drop(s) that do not record it — scope with includePosts`}`)
  }
  // does another identity claim this spelling
  if (spell) {
    const claimants = entities.entities.filter(x => [x.canonical, ...(x.aliases ?? []).map(a => a.text ?? a)]
      .some(f => String(f).toLowerCase() === spell.toLowerCase()))
    if (claimants.length) console.log(`  spelling ${JSON.stringify(spell)} is registered to: ${claimants.map(x => x.canonical).join(' | ')}`)
  }
  const around = hits.length ? body.slice(Math.max(0, hits[0].at - 90), hits[0].at + 90) : ''
  if (around) console.log(`  context: ...${JSON.stringify(around)}...`)
}
console.log(`\n${rows.length} row(s)`)
