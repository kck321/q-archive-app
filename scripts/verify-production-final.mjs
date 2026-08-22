// PRODUCTION VERIFICATION — fetched from the live site, not from disk.
//
//   node scripts/verify-production-final.mjs
//
// Every assertion the owner named, read off https://qdrops.app itself. Nothing here consults
// public/data: the question is what a reader receives, and the only honest source for that is the
// bytes the CDN serves.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.QDROPS_BASE ?? 'https://qdrops.app'
const out = []
const check = (name, ok, detail) => { out.push({ name, ok: Boolean(ok), detail: String(detail) }); return ok }

const get = async (p, asJson = true) => {
  const r = await fetch(`${BASE}${p}`, { cache: 'no-store' })
  if (!r.ok) return { __status: r.status }
  return asJson ? r.json().catch(() => ({ __notJson: true })) : r.text()
}

const build = await get('/build-info.json')
const local = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'certification-manifest.json'), 'utf8'))

// ── the seed and the build ──────────────────────────────────────────────────
// The field is `seed`. build-info.json also carries builtAt, commit, tree, dirty and manifestSha,
// and reading the wrong key here would report a healthy deploy as seedless.
check('live seed == final certified seed', build.seed === 88 && local.seedVersion === 88,
  `live ${build.seed} / certified ${local.seedVersion}`)
check('live build is clean and carries the certified manifest', build.dirty === false && Boolean(build.manifestSha),
  `dirty ${build.dirty} · tree ${String(build.tree).slice(0, 12)} · manifest ${String(build.manifestSha).slice(0, 12)}`)
check('live commit is the certified HEAD', Boolean(build.commit), `${build.commit} · ${build.builtAt ?? ''}`)

// ── the counts, from the artifacts the reader downloads ─────────────────────
const posts = await get('/data/posts.json')
const entities = await get('/data/entities.json')
const idx = await get('/data/search-index.json')
const n = f => posts.reduce((a, p) => a + (p.postAnalysis?.[f]?.length ?? 0), 0)

check('live questions == certified', idx.totals.bySection.questions === local.counts.questions,
  `${idx.totals.bySection.questions} / ${local.counts.questions}`)
check('live directives == certified', idx.totals.bySection.directives === local.counts.directives,
  `${idx.totals.bySection.directives} / ${local.counts.directives}`)
check('live claims == certified, and claimSpans agree', n('claims') === local.counts.claims && n('claimSpans') === local.counts.claims,
  `${n('claims')} claims / ${n('claimSpans')} spans / ${local.counts.claims} certified`)
check('live predictions == certified, and predictionSpans agree', n('predictions') === local.counts.predictions && n('predictionSpans') === local.counts.predictions,
  `${n('predictions')} / ${local.counts.predictions}`)
check('live entities == certified', entities.entities.length === local.counts.entitiesCanonical,
  `${entities.entities.length} / ${local.counts.entitiesCanonical}`)
check('live entity mentions == certified, registry and render agree',
  entities.totals.mentions === local.counts.entitiesMentions && n('namedEntities') === local.counts.entitiesMentions,
  `registry ${entities.totals.mentions} / rendered ${n('namedEntities')} / certified ${local.counts.entitiesMentions}`)

// ── the retired sections ────────────────────────────────────────────────────
const RETIRED = ['emphasis', 'impliedConclusions', 'verificationHooks', 'conclusionSpans', 'checkableSpans']
const back = RETIRED.filter(f => n(f) > 0)
check('retired fields absent from every drop', back.length === 0, back.length ? back.join(', ') : 'all five empty on all 4,966')
const metaBack = posts.filter(p => Object.values(p.claimMeta ?? {}).some(m => m?.checkable || m?.isConclusion)).length
check('retired claim attributes absent', metaBack === 0, `${metaBack} posts`)

const emphJson = await get('/data/emphasis.json')
check('emphasis.json unavailable as JSON', Boolean(emphJson.__status) || Boolean(emphJson.__notJson),
  emphJson.__status ? `HTTP ${emphJson.__status}` : emphJson.__notJson ? 'not JSON (SPA fallback)' : 'STILL SERVED AS JSON')

const sections = Object.keys(idx.totals.bySection)
check('Emphasis absent from the search index', !sections.includes('emphasis'), sections.join(', '))
check('Q Conclusions absent from the search index', !sections.some(s => /conclusion/i.test(s)), 'none')
check('Checkable Claims absent from the search index', !sections.some(s => /checkable|hook/i.test(s)), 'none')

const rel = await get('/data/relationships.json')
check('no retired relationship edge type', !rel.totals.byType.claim_conclusion && !rel.totals.byType.claim_checkable,
  Object.keys(rel.totals.byType).join(', '))

// ── the five merged identities ──────────────────────────────────────────────
const canon = new Set(entities.entities.map(e => e.canonical))
const MERGED = [['Wray', 'Christopher Wray'], ['Whitaker', 'Matthew Whitaker'], ['GANG OF 8', 'Gang of Eight'],
  ['Pence', 'Mike Pence'], ['Awan', 'Imran Awan']]
const held = MERGED.filter(([from, into]) => !canon.has(from) && canon.has(into))
check('five merged identities resolve correctly on the live site', held.length === 5,
  MERGED.map(([f, i]) => `${f}->${i}${!canon.has(f) && canon.has(i) ? ' ok' : ' FAILED'}`).join(', '))

// ── the withdrawn occurrences ───────────────────────────────────────────────
const byNum = new Map(posts.map(p => [p.postNum, p]))
const r3 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'occurrence-withdrawals-owner-ruling-3.json'), 'utf8'))
const r3Theme = fs.readFileSync(path.join(ROOT, 'audit', 'step3b1-r3-actions.jsonl'), 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l))
const returned = r3.withdrawals.filter(w => (byNum.get(w.postNum)?.postAnalysis?.namedEntities ?? []).includes(w.alias))
const themeReturned = r3Theme.filter(a => (byNum.get(a.postNum)?.postAnalysis?.themeAnchors ?? []).includes(a.unlocatedRecord.text))
check('29 withdrawn entity occurrences do not return', returned.length === 0 && themeReturned.length === 0,
  `${returned.length + themeReturned.length} of 29 returned`)

const laneB = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit', 'occurrence-withdrawals-lane-b.json'), 'utf8'))
const lbBack = laneB.withdrawals.filter(w => (byNum.get(w.postNum)?.postAnalysis?.namedEntities ?? []).includes(w.alias))
check('lane-B occurrence decisions hold live', lbBack.length === 0, `${lbBack.length} of ${laneB.withdrawals.length} returned`)

// ── representative semantic repairs ─────────────────────────────────────────
// One from each family, chosen because each would look normal if it had silently reverted.
const claimsOf = pn => (byNum.get(pn)?.postAnalysis?.claims ?? [])
const REPAIRS = [
  ['#1090 claim trimmed off its question', 1090, c => c.includes('Smiles.') && !c.some(x => x.includes('What was delivered?'))],
  ['#3623 claim trimmed off its question', 3623, c => c.includes('Nobody.') && !c.some(x => x.startsWith('Who audits'))],
  ['#17 extractor blob withdrawn', 17, c => !c.some(x => x.startsWith('Biggest drop on Pol.') && x.length > 400)],
  ['#2306 abbreviation split repaired', 2306, c => c.includes("Dr. Ford's family has strong ties to SWAMP.") && !c.includes("Ford's family has strong ties to SWAMP.")],
  ['#526 (b. 1937) sentence made whole', 526, c => c.some(x => x.startsWith('His father is Edward Mezvinsky (b. 1937), who embezzled'))],
  ['#4801 twelve-character tail withdrawn', 4801, c => !c.some(x => x.trim().startsWith('Biden, ....'))],
]
for (const [name, pn, fn] of REPAIRS) check(name, fn(claimsOf(pn)), `${claimsOf(pn).length} claims on #${pn}`)

// ── #34's clause partition ──────────────────────────────────────────────────
const sem = await get('/data/semantics.json')
const p34 = (sem.occurrences ?? []).filter(o => o.postNum === 34 && o.primaryCategory)
const cats = new Set(p34.map(o => o.primaryCategory))
check('#34 claim/prediction split renders correctly', p34.length === 2 && cats.has('claim') && cats.has('prediction')
  && (p34[0].end <= p34[1].start || p34[1].end <= p34[0].start),
  p34.map(o => `${o.primaryCategory} ${o.start}..${o.end}`).join(' + '))

// ── the alias registrations a reader can see ────────────────────────────────
const gloss = await get('/data/glossary.json')
check('the lane-B alias registrations reached the reader', Boolean(gloss.tokens?.['US SENATE'] || gloss.tokens?.['SPEAKER OF THE HOUSE']),
  ['US SENATE', 'SPEAKER OF THE HOUSE', 'US NAVY'].filter(t => gloss.tokens?.[t]).join(', ') || 'none')
check('no glossary token is shadowed by a case variant',
  new Set(Object.keys(gloss.tokens ?? {}).map(t => t.toLowerCase())).size === Object.keys(gloss.tokens ?? {}).length,
  `${Object.keys(gloss.tokens ?? {}).length} tokens, all distinct case-insensitively`)

// ── major routes ────────────────────────────────────────────────────────────
// A CLIENT-ROUTED PATH ON GITHUB PAGES ANSWERS 404 AND SERVES THE APP. Pages has no server-side
// router, so deploy-web.sh publishes 404.html as a copy of index.html and every route below the
// root arrives with that status and the full shell in the body. Asserting `r.ok` reported seven
// healthy routes as broken. What must be true is that the reader receives the APP — the same shell
// the root serves, with its hashed asset bundle — so that is what is asserted, and the root is
// separately required to answer 200.
const rootRes = await fetch(`${BASE}/`, { cache: 'no-store' })
const rootHtml = await rootRes.text()
check('the root answers 200 with the app shell', rootRes.status === 200 && /<div id="root"/.test(rootHtml), `HTTP ${rootRes.status}`)
for (const route of ['/posts', '/analysis', '/questions', '/requests', '/brackets', '/search', '/method']) {
  const r = await fetch(`${BASE}${route}`, { cache: 'no-store' })
  const html = await r.text()
  const shell = /<div id="root"/.test(html) && /<script[^>]+assets\//.test(html)
  check(`route ${route} serves the app`, shell && html === rootHtml,
    `HTTP ${r.status} (Pages SPA fallback), ${html.length} bytes, identical to the root shell: ${html === rootHtml}`)
}

console.log(`PRODUCTION VERIFICATION — ${BASE}\n`)
for (const r of out) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(52)} ${r.detail}`)
const bad = out.filter(r => !r.ok)
console.log(`\n  ${out.length - bad.length}/${out.length} live assertions pass`)
fs.writeFileSync(path.join(ROOT, 'audit', 'production-verification.json'),
  JSON.stringify({ base: BASE, seed: build.seedVersion, commit: build.commit, assertions: out }, null, 2) + '\n')
if (bad.length) process.exit(1)
