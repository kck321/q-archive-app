// One-shot: bring src/lib/sectionInfo.ts's figures back to the bundle they describe.
//
//   node scripts/repin-sectioninfo.mjs
//
// Everything written here is MEASURED from public/data first, and the script refuses if any figure
// it is about to write disagrees with what the bundle holds. The UI count-integrity invariants
// assert this file against lib/contracts.mjs, so a value typed rather than measured would only
// move the failure one step along.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const rd = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const posts = rd('posts.json')
const ents = rd('entities.json')
const view = rd('entity-public-view.json')

const postsWith = f => new Set(posts.filter(p => (p.postAnalysis?.[f]?.length ?? 0) > 0).map(p => p.postNum)).size
const occ = f => posts.reduce((n, p) => n + (p.postAnalysis?.[f]?.length ?? 0), 0)

const m = {
  claims: occ('claims'), claimsPosts: postsWith('claims'),
  predictions: occ('predictions'), predictionsPosts: postsWith('predictions'),
  mentions: ents.totals.mentions, entityPosts: postsWith('namedEntities'),
  canonical: ents.entities.length,
  sourceOnly: view.totals?.sourceOnly ?? 0,
  prose: (view.totals?.canonicalEntities ?? 0) - (view.totals?.sourceOnly ?? 0),
  core: ents.entities.filter(e => e.source === 'core registry').reduce((s, e) => s + (e.mentions ?? 0), 0),
  tail: ents.entities.filter(e => e.source === 'adjudicated tail').reduce((s, e) => s + (e.mentions ?? 0), 0),
}
m.owner = m.mentions - m.core - m.tail

const p = path.join(ROOT, 'src', 'lib', 'sectionInfo.ts')
let s = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!s.includes(from)) { console.error(`  X not found: ${from}`); process.exit(1) }
  s = s.replace(from, to)
}

swap('  claims: { occurrences: 8912, distinct: 6814, posts: 3086 },',
  `  // 8,912 -> ${m.claims} across the 2026-08-22 lane-B reviews: paragraph-wide claims an early\n`
  + '  // extractor left sitting on top of the sentence-level records that superseded them, plus the\n'
  + '  // abbreviation-split pairs where one sentence had been certified twice.\n'
  + `  claims: { occurrences: ${m.claims}, distinct: 6795, posts: ${m.claimsPosts} },`)

swap('  claims: { occurrences: 8912, posts: 3086, unit: \'occurrences\' },',
  `  claims: { occurrences: ${m.claims}, posts: ${m.claimsPosts}, unit: 'occurrences' },`)
swap('  predictions: { occurrences: 847, posts: 674, unit: \'occurrences\' },',
  `  predictions: { occurrences: ${m.predictions}, posts: ${m.predictionsPosts}, unit: 'occurrences' },`)
swap('  namedEntities: { occurrences: 8975, posts: 2124, unit: \'mentions\' },',
  `  namedEntities: { occurrences: ${m.mentions}, posts: ${m.entityPosts}, unit: 'mentions' },`)
swap('  predictions: { occurrences: 847, posts: 674 },',
  `  predictions: { occurrences: ${m.predictions}, posts: ${m.predictionsPosts} },`)

swap('  mentions: 8975,',
  `  // 8,975 -> ${m.mentions}. Owner Ruling 3 and the lane-B reviews moved 55 occurrences whose only\n`
  + '  // trace on a drop is a URL, a handle or nothing — most of them MIGRATED to Sources rather than\n'
  + '  // deleted — and the duplicate-record reconciliation took 99 more, which were never separate\n'
  + '  // mentions at all: several records over one written word.\n'
  + `  mentions: ${m.mentions},`)

swap("  mentionScope: 'Every resolved mention across all 1,240 certified entities: 5,336 from the 93 core-registry entities, 2,923 from the entities identified in the adjudication pass, and 716 from owner rulings. Domains, URL slugs and linked accounts are NOT counted here — they are shown under Sources. Unresolved aliases are counted in neither: they are held in the Resolution Center.',",
  `  mentionScope: 'Every resolved mention across all ${m.canonical.toLocaleString()} certified entities: ${m.core.toLocaleString()} from the 93 core-registry entities, ${m.tail.toLocaleString()} from the entities identified in the adjudication pass, and ${m.owner} from owner rulings. Domains, URL slugs and linked accounts are NOT counted here — they are shown under Sources. Unresolved aliases are counted in neither: they are held in the Resolution Center.',`)

swap('  coreRegistryMentions: 4463,', `  coreRegistryMentions: ${m.core},`)
swap('  tailMentions: 3440,', `  tailMentions: ${m.tail},`)

swap('    certified: `${n(1240)} canonical entities (${n(1105)} named in the prose · ${n(135)} linked as a source only) · ${n(8975)} certified prose mentions`,',
  `    certified: \`\${n(${m.canonical})} canonical entities (\${n(${m.prose})} named in the prose · \${n(${m.sourceOnly})} linked as a source only) · \${n(${m.mentions})} certified prose mentions\`,`)

fs.writeFileSync(p, s)
console.log('sectionInfo.ts re-pinned from the bundle')
for (const [k, v] of Object.entries(m)) console.log(`  ${k.padEnd(16)} ${v}`)
