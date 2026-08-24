// Identities and splits for the ENTITY rulings in round 2 of the unhighlighted-sentence review.
//
//   -> audit/unhighlighted-entity-identities-2.json
//
// Same job as audit/unhighlighted-entity-identities.json does for round 1, and the same doctrine:
// the owner ruled that these spans ARE entities; a certified row also needs a canonical name and a
// type, and the review carries neither. What is NOT the same is the volume. Round 1 left 3 spans
// unresolved and they were named by hand. Round 2 leaves 458, and 245 of those are three LIST
// SHAPES Q pastes verbatim:
//
//   Country: Central Bank    #135-#138, the central-bank list        161 wordings
//   Outlet – Journalist      #1515, "THE BRIDGE: PODESTA GROUP"       55 wordings
//   Person - Party           #1319/#1850, the retiring-Congress list  29 wordings
//
// Each line names two things, and BOTH names are read off Q's own line rather than supplied: the
// country and its bank, the outlet and its reporter, the member and their party. That is a split,
// which is why this is generated rather than authored — a hand-written file of 245 rows saying
// "Bank of Albania is an organisation" carries no more judgement than the rule that produced it,
// and hides the rule.
//
// ANYTHING THAT IS NOT ONE OF THE THREE SHAPES IS LEFT ALONE. It stays held, is reported in the
// issues workbook, and waits for the owner — naming it here would be inventing a referent, which
// is the one thing the resolution order forbids.
//
//   node scripts/build-queue-entity-identities-2.mjs [--check]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeEntityResolver, stripSpan } from './lib/queueEntityResolve.mjs'
import { loadQueueRulings } from './lib/queueRulings.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/unhighlighted-entity-identities-2.json')
const check = process.argv.includes('--check')
const RULED_ON = '2026-08-24'

const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/entities.json'), 'utf8'))
const entityRows = Array.isArray(entities) ? entities : (entities.entities ?? entities.rows ?? [])
const round1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/unhighlighted-entity-identities.json'), 'utf8'))

// ── the three list shapes ───────────────────────────────────────────────────
// Each is anchored on the separator Q actually types, not on a guess about content.
const BANK = /^(.+?):\s*(.*\b(?:Bank|Banka|Banco|Monetary Authority|Bundesbank|Riksbank|Reserve)\b.*)$/
const OUTLET = /^([A-Z][A-Za-z0-9'&. ]{1,24}?)\s*[–—]\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})$/
const PARTY = /^(.+?)\s+[-–—]\s+(Republican|Democrat)\b(.*)$/

const resolver = makeEntityResolver(entityRows, round1)
const byName = new Map()
for (const e of entityRows) {
  byName.set(String(e.canonical).toLowerCase(), e)
  for (const a of e.aliases ?? []) byName.set(String(a.text ?? a).toLowerCase(), e)
}
const known = n => byName.get(stripSpan(n).toLowerCase()) ?? null

const identities = []
const splits = []
const seenIdentity = new Set()
const declare = (canonical, type, why) => {
  const k = canonical.toLowerCase()
  if (seenIdentity.has(k) || known(canonical)) return
  seenIdentity.add(k)
  identities.push({ canonical, type, spellings: [canonical], why })
}

// Every entity ruling that does not already resolve.
const held = []
for (const r of loadQueueRulings(ROOT, 'entities')) {
  if (resolver.resolve(r).heldWhy) held.push(r)
}

const stillHeld = []
const seenSplit = new Set()
for (const r of held) {
  const span = stripSpan(r.sourceText)
  const key = `${r.postNum}|${span.toLowerCase()}`
  let m
  if ((m = BANK.exec(span))) {
    const country = m[1].trim()
    // Q ANNOTATES SOME OF THESE LINES, AND HIS ASIDE IS NOT PART OF THE NAME.
    // "Central Bank of Libya (Their most recent conquest)" is one institution plus a remark. A
    // trailing parenthetical is dropped only when it reads as prose — a space and a lower-case
    // letter — so the acronym in "Central Bank of West African States (BCEAO)" is kept, because
    // that one IS how the bank is named.
    const aside = /\s*\(([^)]*[a-z][^)]*\s[^)]*)\)\s*$/
    // One line names two institutions: "United States: Federal Reserve, Federal Reserve Bank of
    // New York". A comma between two bank names is a list, and each is its own organisation.
    const banks = m[2].trim().replace(aside, '').split(/,\s*(?=(?:The\s+)?(?:Federal|Central|National|Reserve|Bank|Banco|Banka)\b)/)
      .map(b => b.trim()).filter(Boolean)
    for (const bank of banks) {
      declare(bank, 'organization', `Named in Q's central-bank list (#135-#138) as ${country}'s central bank. The name is Q's own line, not supplied.`)
    }
    if (!known(country)) declare(country, 'country', `Named in Q's central-bank list (#135-#138) as the country whose bank the same line names.`)
    if (!seenSplit.has(key)) { seenSplit.add(key); splits.push({ spelling: span, postNum: r.postNum, into: [country, ...banks], why: 'A country and its central bank on one line of the list Q pasted.' }) }
  } else if ((m = OUTLET.exec(span))) {
    const outlet = m[1].trim(), person = m[2].trim()
    if (!known(outlet)) declare(outlet, 'media_organization', `Named in #1515's "THE BRIDGE: PODESTA GROUP" list as the outlet a journalist on the same line writes for.`)
    declare(person, 'person', `Named in #1515's "THE BRIDGE: PODESTA GROUP" list as a journalist at ${outlet}. The name is Q's own line.`)
    if (!seenSplit.has(key)) { seenSplit.add(key); splits.push({ spelling: span, postNum: r.postNum, into: [outlet, person], why: 'An outlet and one of its journalists on one line of the list Q pasted.' }) }
  } else if ((m = PARTY.exec(span))) {
    const person = m[1].trim(), party = m[2].trim()
    declare(person, 'person', `Named in Q's list of retiring members of Congress (#1319, #1850). The name is Q's own line.`)
    declare(party, 'political_group', `The party named beside each member in Q's retiring-Congress list. Folded onto the certified plural where one exists.`)
    if (!seenSplit.has(key)) { seenSplit.add(key); splits.push({ spelling: span, postNum: r.postNum, into: [person, party], why: 'A member of Congress and their party on one line of the list Q pasted.' }) }
  } else {
    stillHeld.push({ spelling: r.sourceText, postNum: r.postNum })
  }
}

// The plural forms the registry already carries, so "Republican" folds onto "Republicans" rather
// than standing up a second row for the same body.
for (const id of identities) {
  const plural = known(id.canonical + 's')
  if (plural) { id.canonical = plural.canonical; id.type = plural.type }
}

const byWording = new Map()
for (const h of stillHeld) {
  const k = String(h.spelling).trim()
  if (!byWording.has(k)) byWording.set(k, [])
  byWording.get(k).push(h.postNum)
}

const out = {
  note: 'Canonical identity and type for the ROUND 2 entity rulings that do not resolve to an already-certified entity, and to the identities round 1 declared. Generated from three list shapes Q pastes verbatim; anything outside them is left held rather than named.',
  generatedBy: 'scripts/build-queue-entity-identities-2.mjs',
  resolutionOrder: round1.resolutionOrder,
  typeVocabulary: 'Only types already present in public/data/entities.json are used. No new type is introduced by this batch.',
  shapes: {
    'Country: Central Bank': 'audit line from #135-#138 — the country and its central bank, split, both named by Q',
    'Outlet – Journalist': 'audit line from #1515 — the outlet and its reporter, split, both named by Q',
    'Person - Party': 'audit line from #1319/#1850 — the member and their party, split, both named by Q',
  },
  ruledOn: RULED_ON,
  totals: {
    entityRulings: loadQueueRulings(ROOT, 'entities').length,
    unresolvedBeforeThisFile: held.length,
    identitiesDeclared: identities.length,
    splitsDeclared: splits.length,
    stillHeld: stillHeld.length,
    stillHeldWordings: byWording.size,
  },
  identities,
  splits,
  held: [...byWording.entries()].map(([spelling, posts]) => ({
    spelling,
    postNum: posts[0],
    posts,
    why: 'Outside the three list shapes. The owner ruled it an Entity; naming the referent is a separate decision and is not guessed here.',
  })),
}

if (check) { console.log(JSON.stringify(out.totals, null, 1)); process.exit(0) }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
console.log('\nQUEUE ENTITY IDENTITIES — ROUND 2\n')
for (const [k, v] of Object.entries(out.totals)) console.log(`  ${k.padEnd(26)}: ${String(v).padStart(6)}`)
console.log('\nwrote audit/unhighlighted-entity-identities-2.json\n')
