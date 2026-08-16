// Parse the 679-row reference audit into a structured artifact. READ-ONLY.
//
// Every decision is keyed to an exact queueRowId of the form TOKEN-POST-LINE-CHAR. The token can
// itself contain hyphens, dots and spaces ("D.C.-1553-0-223", "Betsy D-223-0-7", "General K-...",
// "RED_OCTOBER-395-5-0"), so the id is parsed from the RIGHT: the last three groups are the
// coordinates and everything before them is the token.
//
//   node scripts/parse-reference-audit.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = 'C:/Users/heath/OneDrive - BlueMist of SWFL/Desktop/reference_audit_679_complete.md'
const md = Buffer.from(fs.readFileSync(SRC, 'latin1'), 'latin1').toString('utf8')

const field = (block, label) => {
  const m = block.match(new RegExp(`^- \\*\\*${label}:?\\*\\*\\s*(.*)$`, 'm'))
  return m ? m[1].replace(/^`|`$/g, '').trim() : ''
}
const parseId = id => {
  const m = id.match(/^(.*)-(\d+)-(\d+)-(\d+)$/)
  return m ? { token: m[1], post: Number(m[2]), line: Number(m[3]), char: Number(m[4]) } : null
}

const rows = []
// Each decision is an "### R<n>." or "### U<n>." block.
const blocks = md.split(/\n(?=### [RU]\d+\. )/).filter(b => /^### [RU]\d+\. /.test(b))
for (const b of blocks) {
  const head = b.split('\n')[0]
  const id = field(b, 'Queue row')
  const coords = parseId(id)
  if (!coords) { console.error('UNPARSEABLE ID:', JSON.stringify(id), head.slice(0, 80)); continue }
  const isHeld = /^### U/.test(head)
  const decisionRaw = field(b, 'Decision')
  const decision = isHeld ? 'UNRESOLVED_REVIEW' : (decisionRaw.match(/^([A-Z_]+)/) ?? [])[1] ?? ''
  // "### R1. [Post #2](url) - AW -> Anthony Weiner". The token/canonical separator is a
  // RIGHT ARROW (U+2192), not the em dash that separates the post link. The file is CRLF.
  const arrow = head.trim().split(String.fromCharCode(32,8594,32))
  rows.push({
    ref: (head.match(/### ([RU]\d+)\./) ?? [])[1],
    id, ...coords, held: isHeld, decision,
    canonical: isHeld ? '' : (arrow[1] ?? '').trim(),
    topic: field(b, 'Topic/issue') || field(b, 'Likely reading'),
    typeConf: field(b, 'Type / confidence'),
    candidate: field(b, 'Exact source candidate'),
    why: field(b, 'Why') || field(b, 'Why still unresolved'),
    authorship: field(b, 'Authorship note'),
    sources: field(b, 'Supporting source(s)'),
    action: field(b, 'Action'),
  })
}

const by = {}
for (const r of rows) by[r.decision] = (by[r.decision] ?? 0) + 1
console.log(`blocks parsed : ${rows.length}   (expect 679)`)
console.log(`unique ids    : ${new Set(rows.map(r => r.id)).size}`)
for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)

// Cross-check against the live queue.
const Q = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/resolution-queue.json'), 'utf8')).rows.filter(r => r.kind === 'entity')
const qIds = new Set(Q.map(r => r.id))
const missing = rows.filter(r => !qIds.has(r.id))
const extra = Q.filter(r => !rows.some(x => x.id === r.id))
console.log(`\nqueue rows        : ${Q.length}`)
console.log(`audit -> queue    : ${rows.length - missing.length} matched, ${missing.length} not in queue`)
console.log(`queue -> audit    : ${Q.length - extra.length} covered, ${extra.length} unaddressed`)
if (missing.length) for (const m of missing.slice(0, 8)) console.log(`   NOT IN QUEUE ${m.ref} ${m.id}`)
if (extra.length) for (const e of extra.slice(0, 8)) console.log(`   UNADDRESSED  ${e.id}`)

// Canonicals that would need creating.
const ents = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8')).entities
const known = new Set(ents.map(e => e.canonical))
const refs = rows.filter(r => r.decision === 'RESOLVED_REFERENCE')
const canon = [...new Set(refs.map(r => r.canonical))]
const toCreate = canon.filter(c => !known.has(c))
console.log(`\ndistinct canonicals in RESOLVED_REFERENCE : ${canon.length}`)
console.log(`  already in the registry : ${canon.length - toCreate.length}`)
console.log(`  would need creating     : ${toCreate.length}`)
console.log('  ' + toCreate.slice(0, 30).join(' | '))

fs.writeFileSync(path.join(ROOT, 'audit/reference-audit-parsed.json'), JSON.stringify({ rows }, null, 1))
console.log('\nwrote audit/reference-audit-parsed.json')
