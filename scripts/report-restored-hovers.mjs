// The 21 hover records the substring defect had wrongly quarantined.
//
//   node scripts/report-restored-hovers.mjs
//
// aliasLocation folded punctuation to spaces and then asked `includes`, so "US" was found inside
// "beca(us)e", "m(us)t" and "tr(us)ted". A record whose alias appeared in a URL and whose alias
// ALSO appeared as a phantom substring in the prose read as "in prose AND in URL" — which is the
// one combination the quarantine treats as undecidable. Padding both sides of the folded text
// makes the space itself the boundary and the phantom matches disappear.
//
// This changes no certified count. A hover record is editorial text ABOUT an occurrence; the
// occurrence itself was never in question.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { aliasLocation } from './lib/hoverValidation.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const read = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))

// The quarantine as it stood before the boundary fix.
const BEFORE_COMMIT = process.argv[2] ?? 'df3608a~1'
const oldQ = JSON.parse(execSync(`git show ${BEFORE_COMMIT}:audit/entity-hover-url-quarantine.json`, { cwd: ROOT, maxBuffer: 1e9 }).toString())
const newQ = read(OUT, 'entity-hover-url-quarantine.json')
const review = read(OUT, 'entity-hover-review-queue.json')
const hovers = read(DATA, 'entity-hovers.json')
const entities = read(DATA, 'entities.json')
const posts = read(DATA, 'posts.json')
const byId = new Map(entities.entities.map(e => [e.id, e]))
const postByNum = new Map(posts.map(p => [p.postNum, p]))

const stillQuarantined = new Set(newQ.records.map(r => r.auditOccurrenceId))
const inReview = new Set(review.records.map(r => r.auditOccurrenceId))
const left = oldQ.records.filter(r => !stillQuarantined.has(r.auditOccurrenceId))

// The old, defective test — kept here so the report can SHOW why each record was misclassified
// rather than merely assert that it was.
const substringFold = s => String(s).toLowerCase().replace(/%[0-9a-f]{2}/gi, ' ').replace(/[^a-z0-9]+/g, ' ').trim()

const records = []
for (const r of left) {
  const e = byId.get(r.entityId)
  const post = postByNum.get(r.postNum)
  const text = String(post?.text ?? '')
  const loc = aliasLocation(text, r.matchedAlias)

  // Where does the alias sit in the prose now that boundaries are respected?
  const esc = r.matchedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rx = new RegExp(`(^|[^A-Za-z0-9])(${esc})([^A-Za-z0-9]|$)`, 'i')
  const m = rx.exec(text)
  const exactMatch = m ? text.slice(Math.max(0, m.index), Math.min(text.length, m.index + m[0].length + 40)).replace(/\s+/g, ' ').trim() : null

  // Why the old detector was wrong: the folded prose contained the alias as a bare substring.
  const foldedProse = substringFold(text)
  const needle = substringFold(r.matchedAlias)
  const phantomHost = foldedProse.split(' ').find(w => w !== needle && w.includes(needle))

  const published = Boolean(hovers.byPost[r.entityId]?.[String(r.postNum)])
  records.push({
    auditOccurrenceId: r.auditOccurrenceId,
    postNum: r.postNum,
    entityId: r.entityId,
    canonical: e?.canonical ?? null,
    entityType: e?.type ?? null,
    alias: r.matchedAlias,
    exactProseMatch: exactMatch,
    completeTokenMatch: loc.inProse,
    whyPreviouslyMisclassified: phantomHost
      ? `The old detector matched substrings: "${r.matchedAlias}" was found inside the word "${phantomHost}", so the record read as prose-and-URL at once — the one combination the quarantine treats as undecidable.`
      : 'The old detector matched substrings across folded token boundaries, producing a prose match the text does not contain.',
    evidenceGrade: r.contextSupport,
    evidenceConfidence: r.evidenceConfidence,
    finalPublicSynopsis: published ? hovers.byPost[r.entityId][String(r.postNum)].s : null,
    outcome: published ? 'published' : inReview.has(r.auditOccurrenceId) ? 'private review' : 'unaccounted',
    certifiedCountChange: 'none — a hover is editorial text about an occurrence; the occurrence was never in question',
  })
}

const published = records.filter(r => r.outcome === 'published')
const routed = records.filter(r => r.outcome === 'private review')
const unaccounted = records.filter(r => r.outcome === 'unaccounted')

let publicHovers = 0
for (const bp of Object.values(hovers.byPost)) publicHovers += Object.keys(bp).length

console.log('\nRESTORED HOVERS — the substring defect\n')
console.log(`  left quarantine        : ${records.length}`)
console.log(`    published            : ${published.length}`)
console.log(`    routed to review     : ${routed.length}`)
console.log(`    unaccounted          : ${unaccounted.length}`)
console.log(`  complete-token matches : ${published.filter(r => r.completeTokenMatch).length}/${published.length}`)
console.log(`  public hover total     : ${publicHovers}`)
console.log(`  entity totals          : ${entities.entities.length} rows / ${entities.totals.mentions} mentions (unchanged)`)

// THE 21 WERE NOT RESTORATIONS. Fixing the substring defect stopped them matching inside URLs,
// and they fell through to publish looking like records that had been wrongly held. They are not:
// none of them contains any spelling of its entity as a complete token anywhere in its drop —
// 16 have no textual basis at all, 5 have only an image. A tooltip over an invisible word is not
// a restored tooltip. All 22 are in private review, which is where they belong.
const problems = []
if (published.length !== 0) problems.push(`${published.length} record(s) reached the public bundle despite having no visible term`)
if (unaccounted.length) problems.push(`${unaccounted.length} record(s) landed nowhere`)
if (records.length !== 22) problems.push(`expected 22 records leaving quarantine, got ${records.length}`)

fs.writeFileSync(path.join(OUT, 'hover-restoration-report.json'), JSON.stringify({
  note: 'The hover records wrongly quarantined by substring alias matching, and where each one landed once boundaries were respected. No certified entity count changes: a hover is editorial text about an occurrence, not the occurrence.',
  defect: 'aliasLocation folded punctuation to spaces and then called includes(), so a short alias matched inside a longer word — "US" inside "because". Padding both sides of the folded text makes the space the boundary.',
  comparedAgainst: BEFORE_COMMIT,
  totals: { leftQuarantine: records.length, published: published.length, routedToReview: routed.length, publicHoversAfter: publicHovers },
  certifiedUnchanged: { entityRows: entities.entities.length, mentions: entities.totals.mentions },
  problems,
  records,
}, null, 1))

console.log(`\n  wrote audit/hover-restoration-report.json`)
console.log(`\n  ${problems.length ? `❌ ${problems.join(' · ')}` : '✅ all 22 routed to private review — none had a visible term; no certified count moved'}\n`)
process.exit(problems.length ? 1 : 0)
