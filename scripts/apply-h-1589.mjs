// "H" in #1589 line 12 — Hillary Clinton, that occurrence only.
//
// Owner ruling 2026-08-16, stated at ~90% confidence and recorded as contextual rather than
// decoded. The drop lays out a communication chain — RR to LL, LL to H, JC to LL — and the next
// line names the same set explicitly: "LL IS KEY TO CONNECTING TO WH / HRC/BC/JC/SP/EH". HRC in
// that list is Hillary Rodham Clinton, which is what puts H beside her rather than beside Huma
// Abedin (Q writes HA or HUMA) or Barack Obama (Q writes HUSSEIN).
//
// SCOPED TO ONE OCCURRENCE, by the owner's explicit instruction: "Do not treat every standalone H
// across the archive as Hillary." A single letter is the most over-matchable token there is, and
// the evidence here is the chain in THIS drop, not a property of the letter. Note that the same
// post contains WH and /EH — the line/char scope is what keeps those untouched.
//
//   node scripts/apply-h-1589.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const P = path.join(ROOT, 'audit/entities-owner-rulings.json')
const j = JSON.parse(fs.readFileSync(P, 'utf8'))
if (j.aliasRulings.some(r => r.alias === 'H' && r.canonical === 'Hillary Clinton')) {
  console.log('already ruled — nothing to do')
  process.exit(0)
}
j.aliasRulings.push({
  alias: 'H', canonical: 'Hillary Clinton', recount: true, ruledOn: '2026-08-16',
  includePosts: [1589],
  includeOccurrences: { 1589: [[12, 6]] },
  reasoning: 'Owner ruling at ~90% confidence: in #1589 the chain "RR to LL / LL to H / JC to LL" is decoded by the following line, "LL IS KEY TO CONNECTING TO WH / HRC/BC/JC/SP/EH" — HRC is Hillary Rodham Clinton. Q writes HA or HUMA for Huma Abedin and HUSSEIN for Barack Obama, which is what rules those out.',
  readerNote: 'Hillary Clinton. The identification is strongly contextual, not explicitly decoded by Q: it rests on the communication chain in this drop and on HRC appearing in the connected list on the next line.',
  retrieval: 'ONE occurrence — #1589 line 12, "LL to H". Deliberately not generalised: a standalone H elsewhere in the archive is not ruled to be Hillary, and even inside this drop WH and /EH are untouched.',
  renderNote: 'RENDERING_PROVENANCE_RULE: the renderer highlights the token, the form Q wrote.',
})
fs.writeFileSync(P, JSON.stringify(j, null, 2) + '\n')
console.log('H -> Hillary Clinton written, scoped to #1589 line 12 char 6')
