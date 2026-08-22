// For every UNLOCATED entity row: the exact spelling the drop uses, where it sits, and whether an
// alias registration would locate the record. Reports only — audit/unlocated-repair-proposal.json.
//
// The distinction it measures, which is the one every disposition in this family turns on:
//
//   the identity is written in Q-AUTHORED PROSE in a spelling the registry does not carry
//       -> registering that spelling LOCATES the record and moves no count. `aliasAdditions` in
//          audit/entities-owner-rulings.json exists for exactly this and apply-entities.mjs only
//          pushes the spelling onto the alias list — it re-scans nothing.
//
//   the identity appears ONLY inside a URL, a social handle, or a quoted post
//       -> it is not a Q-authored prose mention at all. Same finding the 2026-08-17 migration made
//          about 646 URL-derived and 129 social-account occurrences, and the same one Owner Ruling
//          3 made about its fourteen D rows.
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
const entByCanonical = new Map(entities.entities.map(e => [e.canonical, e]))

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const rows = (tax.rows ?? []).filter(r => r.reason === 'UNLOCATED_SPAN' && r.lane === 'B')

const out = []
for (const r of rows) {
  const p = byNum.get(r.postNum)
  const body = runtimeText(p.text ?? '')
  const lines = String(p.text ?? '').split('\n')
  const src = sourceLines(p.text ?? '')
  const isLink = l => /^\s*(https?:|www\.)|^\s*>>\d+\s*$/i.test(l)
  const canonical = forms.canonicalFor(r.certifiedValue) ?? r.certifiedValue
  const e = entByCanonical.get(canonical)
  const registered = e ? [...new Set([e.canonical, ...(e.aliases ?? []).map(a => a.text ?? a)])] : [r.certifiedValue]

  const hits = []
  for (const f of registered) {
    const re = new RegExp(`(?<![A-Za-z0-9])${esc(f)}(?![A-Za-z0-9])`, 'gi')
    let m
    while ((m = re.exec(body))) {
      let off = 0, li = 0
      for (let k = 0; k < lines.length; k++) {
        const len = runtimeText(lines[k]).length
        if (m.index >= off && m.index <= off + len) { li = k; break }
        off += len + 1
      }
      const where = isLink(lines[li]) ? 'link' : src.has(li) ? 'quoted' : 'prose'
      if (!hits.some(h => h.at === m.index)) hits.push({ at: m.index, spelling: m[0], line: li, where })
    }
  }
  const prose = hits.filter(h => h.where !== 'link')
  const spellings = [...new Set(prose.map(h => h.spelling))]
  const alreadyRegistered = spellings.filter(s => registered.includes(s))

  out.push({
    conflictId: r.conflictId, postNum: r.postNum, subtype: r.subtype,
    storedIdentity: r.certifiedValue, canonical,
    registeredForms: registered,
    hits,
    verdictBasis: !hits.length ? 'NO_TRACE'
      : !prose.length ? 'LINK_ONLY'
        : alreadyRegistered.length ? 'ALREADY_REGISTERED_SPELLING_PRESENT'
          : 'PROSE_SPELLING_UNREGISTERED',
    proposedAliasAdditions: prose.length && !alreadyRegistered.length
      ? spellings.map(s => ({ canonical, alias: s })) : [],
    linkCarriers: [...new Set(hits.filter(h => h.where === 'link')
      .map(h => (lines[h.line].match(/https?:\/\/\S+|www\.\S+/i) ?? [lines[h.line].trim()])[0]
        .replace(/<\/?em>/g, '').replace(/^https?:\s*\/\//i, m => m.replace(/\s+/g, ''))))],
  })
}

fs.writeFileSync(path.join(ROOT, 'audit', 'unlocated-repair-proposal.json'),
  JSON.stringify({ note: 'Proposal only. Measured; every row read against its drop before it becomes a disposition.', rows: out.length, byBasis: out.reduce((m, x) => ({ ...m, [x.verdictBasis]: (m[x.verdictBasis] ?? 0) + 1 }), {}), rows_: out }, null, 2) + '\n')

for (const x of out) {
  console.log(`#${String(x.postNum).padEnd(5)} ${JSON.stringify(x.storedIdentity).padEnd(34)} ${x.verdictBasis.padEnd(34)} ${x.proposedAliasAdditions.map(a => JSON.stringify(a.alias)).join(' ')}${x.verdictBasis === 'LINK_ONLY' ? '  carriers=' + JSON.stringify(x.linkCarriers).slice(0, 90) : ''}`)
}
console.log(`\n${out.length} rows  ${JSON.stringify(out.reduce((m, x) => ({ ...m, [x.verdictBasis]: (m[x.verdictBasis] ?? 0) + 1 }), {}))}`)
