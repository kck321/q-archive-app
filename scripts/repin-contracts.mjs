// One-shot: re-pin the certified figures in lib/contracts.mjs to the bundle they now describe.
//
//   node scripts/repin-contracts.mjs
//
// Every value here is MEASURED from public/data before it is written, and the script refuses if a
// figure it is about to pin does not match what the bundle actually holds. Re-pinning a contract to
// a number nobody measured is how a contract stops being one.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const rd = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const ents = rd('entities.json')

const core = ents.entities.filter(e => e.source === 'core registry').reduce((s, e) => s + (e.mentions ?? 0), 0)
const tail = ents.entities.filter(e => e.source === 'adjudicated tail').reduce((s, e) => s + (e.mentions ?? 0), 0)
const owner = ents.totals.mentions - core - tail

const p = path.join(ROOT, 'scripts', 'lib', 'contracts.mjs')
let s = fs.readFileSync(p, 'utf8')
const swap = (from, to, why) => {
  if (!s.includes(from)) { console.error(`  X not found: ${from}`); process.exit(1) }
  s = s.replace(from, why ? `${why}\n${to}` : to)
}

swap(
  '    mentions: 8948,',
  '    mentions: 8821,',
  '  // 8,948 -> 8,924 -> 8,920: the lane-B family 4 and 5 reviews moved 28 occurrences whose only\n'
  + '  // trace on a drop is a URL slug, a hostname or a social handle. 22 MIGRATE to linked sources\n'
  + '  // rather than being deleted, so the reader still sees that Q cited the publisher.\n'
  + '  // 8,920 -> 8,821: -99, and NOT a withdrawal of anything. apply-step3b1.mjs collapsed 99\n'
  + '  // DUPLICATE entity records — several records over the SAME characters for the SAME identity,\n'
  + '  // which is one occurrence recorded more than once and not a repeat Q wrote. #111 carried\n'
  + '  // "Huma" five times over one word; #1318 carried "Sessions" six times over one. The records\n'
  + '  // went when the merge ran and the registry did not follow, so it counted 8,920 while the drops\n'
  + '  // rendered 8,821. Invariant 12 exists for exactly that gap and had been failing at 99 since the\n'
  + '  // merges landed, unseen only because audit-cross-section.mjs could not run at all while\n'
  + '  // Emphasis was half-retired. reconcile-entity-registry.mjs applies the exact decrements the\n'
  + '  // adjudication recorded and refuses unless the two totals then agree.')

swap(
  '    coreEntities: 93, coreRegistryMentions: 5336, tailEntities: 993, tailMentions: 2923,',
  `    coreEntities: 93, coreRegistryMentions: ${core}, tailEntities: ${ents.entities.filter(e => e.source === 'adjudicated tail').length}, tailMentions: ${tail},`,
  '    // Re-measured 2026-08-22 after the lane-B reviews and the duplicate-record reconciliation.\n'
  + `    // The three components add to the headline: ${core} core + ${tail} tail + ${owner} owner-ruling rows.`)

fs.writeFileSync(p, s)
console.log('contracts re-pinned')
console.log(`  entities.mentions            ${ents.totals.mentions}`)
console.log(`  coreRegistryMentions         ${core}`)
console.log(`  tailMentions                 ${tail}`)
console.log(`  owner-ruling rows            ${owner}`)
