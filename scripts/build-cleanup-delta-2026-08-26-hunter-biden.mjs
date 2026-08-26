// Records the Hunter Biden ruling (see build-owner-rulings-2026-08-26-hunter-biden.mjs) as a
// postApprovalDeltas entry on the entity-cleanup rollback contract — an "upstream" delta, per the
// three kinds apply-entity-cleanup.mjs documents: it changed the tree BEFORE that step runs, so
// both its before-state and after-state move by the same amount and the cleanup itself is
// unchanged. Without this the guard refuses to re-materialise from the new (correct) tree.
//
//   node scripts/build-cleanup-delta-2026-08-26-hunter-biden.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTRACT_FILE = path.join(ROOT, 'audit/entity-cleanup-rollback-contract.json')
const dry = process.argv.includes('--dry')

const RULING = 'audit/entities-owner-rulings.json (2026-08-26: Hunter -> Hunter Biden)'
const doc = JSON.parse(fs.readFileSync(CONTRACT_FILE, 'utf8'))
doc.postApprovalDeltas ??= []
const existingIdx = doc.postApprovalDeltas.findIndex(d => d.ruling === RULING)

const entry = {
  ruling: RULING,
  ruledOn: '2026-08-26',
  what: 'Owner ruling: "Hunter is the alias for Hunter Biden or H. Biden so lets tie them together." '
    + 'Two duplicate canonical rows for one identity ("Hunter", 6 mentions, and "Hunter Biden", both '
    + 'adjudicated tail) are merged via mergeRulings, "H. Biden" is registered as a corpus-wide alias '
    + '(6 occurrences: #4888, #4891 x3, #4893, #4898), the wrong "Biden" -> Joe Biden match on those '
    + 'same 4 posts is withdrawn (6 occurrences), and a pre-existing false-positive "Hunter Biden" tail '
    + 'occurrence on #4888/#4893 sourced from a URL slug rather than drop text is withdrawn (2 '
    + 'occurrences). Net BEFORE this step runs: entityRows -1 (1838 -> 1837, the merge), mentions -2 '
    + '(10931 -> 10929: -2 URL-slug withdrawal +6 "H. Biden" alias -6 wrong-Biden withdrawal +0 merge, '
    + 'which only moves mentions already in the corpus).',
  entityRows: -1,
  mentions: -2,
  rendered: -2,
  afterOnly: {
    entityRows: 1,
    mentions: 2,
    rendered: 2,
    what: 'Hunter Biden. Before the merge, "Hunter Biden" stood alone with 10 mentions and every one '
      + 'of them was a source-link URL-slug artifact (url_source_provenance), so the approved cleanup '
      + 'plan withdrew all 10 and the row went dormant. The merge folds in "Hunter"\'s 6 genuine prose '
      + 'mentions (#3625/#4821/#4822/#4881/#4890/#4959, all visible_complete_token) plus the new "H. '
      + 'Biden" alias\'s 6 (#4888/#4891 x3/#4893/#4898) — 12 mentions the same withdrawal plan never '
      + 'touches, since none of them is URL-derived. The row is no longer empty after the same 10 '
      + 'withdrawals run, so it survives where it used to go dormant — the same shape as Rachel '
      + 'Maddow and Al Gore/Roseanne Barr above: the condition the row was retired under stopped '
      + 'being true. Verified by replaying the approved plan against the merged tree: it produces '
      + 'the same 1613/9926 as the original approval, meaning the plan itself withdraws exactly the '
      + 'same occurrences it always did — the 1 row / 2 mentions is that row surviving, not a change '
      + 'to what the cleanup step does.',
  },
  evidence: 'node scripts/apply-entities.mjs QA gate passed with the updated baselines (canonical '
    + 'entities 1837, resolved mentions 10929, core-registry 5697, adjudicated-tail 4017, tail '
    + 'occurrence rows 3436 — submetrics reconcile to the headline). node scripts/apply-entity-cleanup.mjs '
    + '--rematerialise replays to 1613/9926, matching the original approved after-state exactly once '
    + 'this afterOnly correction is in place.',
  why: 'The approval record above is left exactly as written. A delta is recorded beside it instead, '
    + 'so the guard still refuses an unrecognised tree while a later owner ruling does not read as drift.',
}

if (existingIdx === -1) doc.postApprovalDeltas.push(entry)
else doc.postApprovalDeltas[existingIdx] = entry

console.log(`\n${existingIdx === -1 ? 'recorded' : 'updated'} postApprovalDeltas entry: entityRows -1, mentions -2, rendered -2, afterOnly +1/+2/+2\n`)
if (dry) { console.log('--dry: nothing written\n'); process.exit(0) }
fs.writeFileSync(CONTRACT_FILE, JSON.stringify(doc, null, 1) + '\n')
console.log(`wrote ${path.relative(ROOT, CONTRACT_FILE)}\n`)
