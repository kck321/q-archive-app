// One-shot: hoist the rollback-contract read out of the `if (applied)` block. Three checks in
// group 10c now consult it and two of them sit outside that block, so it has to be read once for
// the group rather than three times in three scopes.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(ROOT, 'scripts', 'audit-cross-section.mjs')
let s = fs.readFileSync(p, 'utf8')
const swap = (a, b) => {
  if (!s.includes(a)) { console.error(`  X not found:\n${a.slice(0, 120)}`); process.exit(1) }
  s = s.replace(a, b)
}

// remove the in-block declaration
swap(
`      const contractPath = path.join(OUT, 'entity-cleanup-rollback-contract.json')
      const contract = fs.existsSync(contractPath) ? JSON.parse(fs.readFileSync(contractPath, 'utf8')) : { postApprovalDeltas: [] }
      const d = (contract.postApprovalDeltas ?? []).reduce`,
`      const d = (contract.postApprovalDeltas ?? []).reduce`)

// declare it once for the whole group
swap(
`  const t = group('10c. Integrated entity cleanup')`,
`  const t = group('10c. Integrated entity cleanup')
  // THE RUNNING RECORD OF EVERY DECISION SINCE THE 2026-08-17 APPROVAL, read once for the group.
  // Three checks below consult it: what the applied totals should now be, what state the audit was
  // run against, and whether a moved input is explained. It is the file the approval guard itself
  // uses, so all four agree by construction rather than by three separate copies of the arithmetic.
  const contractPath = path.join(OUT, 'entity-cleanup-rollback-contract.json')
  const contract = fs.existsSync(contractPath)
    ? JSON.parse(fs.readFileSync(contractPath, 'utf8'))
    : { postApprovalDeltas: [], countsBefore: { mentions: 0, entityRows: 0 } }`)

fs.writeFileSync(p, s)
console.log('contract read hoisted to the group')
