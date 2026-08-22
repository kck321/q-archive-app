// THE 38 NO_ALIAS_EVER_REGISTERED ROWS — reviewed one at a time, against the drop.
//
//   node scripts/review-unregistered-entities.mjs
//
// Reports only. Writes audit/step3b1-entity-review.json.
//
// The owner's instruction is explicit: "Do NOT bulk-create aliases for these 38. Review every row
// individually." So nothing here proposes an alias because a family looks alike; each row is
// classified from what the drop actually contains.
//
//   A  EXPLICIT_ENTITY_MISSING_FROM_REGISTRY   Q named it; the registry has no such entity
//   B  EXISTING_ENTITY_ALIAS_MISSING           the canonical exists; register the form Q wrote
//   C  INFERRED_NOT_EXPLICIT                   the analyzer inferred it; Q did not name it
//   D  QUOTED_OR_PASTED_MATERIAL               the match belongs to source material, not Q
//   E  WRONG_IDENTITY                          the attribution is wrong; repair it
//   F  GENUINELY_UNRESOLVED                    the evidence does not settle it
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'
import { buildEntityForms } from './lib/entityForms.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const entitiesDoc = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))
const tax = JSON.parse(fs.readFileSync(path.join(OUT, 'step3b1-conflict-taxonomy-rebuilt.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const EF = buildEntityForms(entitiesDoc)

const isWord = ch => ch !== undefined && /[A-Za-z0-9+]/.test(ch)
function boundedHits(hay, needle, fold) {
  const h = fold ? hay.toLowerCase() : hay
  const n = fold ? String(needle).toLowerCase() : String(needle)
  const out = []
  if (!n) return out
  for (let i = 0; ;) {
    const at = h.indexOf(n, i)
    if (at < 0) return out
    if (!isWord(hay[at - 1]) && !isWord(hay[at + n.length])) out.push(at)
    i = at + 1
  }
}
/** Everything on a drop that is NOT Q's own body. */
function quotedTextOf(p) {
  const parts = []
  for (const q of p.quotedPosts ?? []) {
    if (typeof q === 'string') parts.push(q)
    else if (q && typeof q === 'object') for (const v of Object.values(q)) if (typeof v === 'string') parts.push(v)
  }
  return parts.join(String.fromCharCode(10))
}
/** Is the line carrying this offset pasted source rather than Q's own prose? */
const looksQuoted = (body, at) => {
  const s = body.lastIndexOf(String.fromCharCode(10), at) + 1
  const line = body.slice(s, body.indexOf(String.fromCharCode(10), at) + 1 || undefined)
  return /^\s*(?:>|&gt;)/.test(line) || /https?:\/\//.test(line)
}

const rows = tax.rows.filter(r => r.subtype === 'NO_ALIAS_EVER_REGISTERED')
const out = []

for (const r of rows) {
  const p = byNum.get(r.postNum)
  const body = runtimeText(p?.text ?? '')
  const identity = r.identity
  const forms = EF.formsFor(identity)
  const quoted = quotedTextOf(p ?? {})

  // 1 — is any registered form of this identity present at a word boundary, in any casing?
  let present = null
  for (const f of forms) {
    const exact = boundedHits(body, f, false)
    const folded = boundedHits(body, f, true)
    if (exact.length) { present = { form: f, at: exact[0], casing: 'exact' }; break }
    if (folded.length) { present = { form: f, at: folded[0], casing: 'folded', literal: body.slice(folded[0], folded[0] + f.length) }; break }
  }

  // 2 — is a DISTINCTIVE part of the name present? "Agnes Nixon" -> "Agnes", "Nixon".
  //     Two letters or fewer is not distinctive and is not considered.
  const parts = String(identity).split(/[\s.]+/).filter(w => w.length >= 4)
  const partHits = parts.map(w => ({ word: w, hits: boundedHits(body, w, true).length })).filter(x => x.hits)

  // 3 — quoted material only?
  const inQuoted = forms.some(f => f && quoted.includes(f))

  let verdict, reason, proposed
  // A CANNOT APPLY TO THIS FAMILY, and saying otherwise was a classification error worth naming.
  // NO_ALIAS_EVER_REGISTERED means the identity IS in the registry, carrying exactly one form. So
  // "the registry has no such entity" is impossible here by construction; what can be missing is
  // the SPELLING Q used, which is B.
  const wordsInIdentity = String(identity).split(/\s+/).length
  const looksLikeASentence = wordsInIdentity > 6 || /[.?!]$/.test(String(identity).trim())

  if (looksLikeASentence) {
    verdict = 'E'
    reason = `the stored identity is a whole sentence, not an entity name (${wordsInIdentity} words). A sentence cannot be a named entity; the record is malformed.`
    proposed = { withdrawOccurrence: `#${r.postNum} namedEntities`, why: 'malformed entity record' }
  } else if (present && present.casing === 'exact') {
    verdict = 'F'
    reason = `a registered form ("${present.form}") IS present in exact case at ${present.at}; this row should not be unlocatable and the cause is elsewhere`
  } else if (present && present.casing === 'folded') {
    verdict = 'B'
    reason = `the canonical exists and the drop writes it as "${present.literal}", a casing the registry does not carry`
    proposed = { registerAlias: present.literal, onCanonical: EF.canonicalFor(identity) ?? identity }
  } else if (partHits.length) {
    const at = boundedHits(body, partHits[0].word, true)[0]
    const literal = body.slice(at, at + partHits[0].word.length)
    if (looksQuoted(body, at)) {
      verdict = 'D'
      reason = `the only trace of it is "${literal}", and that sits on a quoted or link line — not Q-authored body text`
      proposed = { withdrawOccurrence: `#${r.postNum} namedEntities "${identity}"`, why: 'source material, not a Q-authored mention' }
    } else {
      // A PARTIAL NAME IS NOT EVIDENCE THAT Q NAMED THE ENTITY, and the first pass of this review
      // proved how badly that goes: it proposed registering "Paris" as Paris Hilton, "2020" as the
      // 2020 Presidential Election, "Daily" as the Daily Beast and "Senate" as US Senate — the last
      // colliding head-on with the separately certified `Senate` identity. That is the invariant-4
      // failure in a new costume.
      //
      // Two things must hold before a fragment can become an alias: it has to be most of the name,
      // and it must not already belong to somebody else.
      const canonicalName = EF.canonicalFor(identity) ?? identity
      const coverage = literal.length / String(canonicalName).length
      const claimedByAnother = EF.formsFor(literal).length
        && (EF.canonicalFor(literal) ?? '') !== canonicalName
      if (coverage >= 0.6 && !claimedByAnother) {
        verdict = 'B'
        reason = `Q writes "${literal}" in his own body text — ${Math.round(coverage * 100)}% of the canonical "${canonicalName}", claimed by no other identity — and the registry is missing that spelling`
        proposed = { registerAlias: literal, onCanonical: canonicalName }
      } else {
        verdict = 'F'
        reason = claimedByAnother
          ? `only "${literal}" appears, and that spelling is already a registered form of "${EF.canonicalFor(literal)}" — registering it here would make one token name two identities`
          : `only "${literal}" appears — ${Math.round(coverage * 100)}% of "${canonicalName}". A fragment that short is not evidence Q named this entity; which form to register, if any, is an owner ruling`
        proposed = { needsOwnerRuling: `is "${literal}" on #${r.postNum} a reference to ${canonicalName}?` }
      }
    }
  } else if (inQuoted) {
    verdict = 'D'
    reason = 'the identity appears only in quoted post content, not in Q-authored body text'
    proposed = { withdrawOccurrence: `#${r.postNum} namedEntities "${identity}"`, why: 'quoted material' }
  } else {
    verdict = 'C'
    reason = 'no registered form and no distinctive part of the name appears anywhere on the drop; the identity was inferred rather than named'
    proposed = { withdrawOccurrence: `#${r.postNum} namedEntities "${identity}"`, why: 'inferred, not explicit' }
  }

  out.push({
    conflictId: r.conflictId, postNum: r.postNum, identity,
    canonical: EF.canonicalFor(identity) ?? null,
    registeredAliases: forms,
    literallyPresent: Boolean(present), presentAs: present ?? null,
    distinctivePartsPresent: partHits,
    presentOnlyInQuotedMaterial: inQuoted,
    verdict, reason, proposed,
    context: (() => {
      const at = present?.at ?? (partHits.length ? boundedHits(body, partHits[0].word, true)[0] : 0)
      return body.slice(Math.max(0, at - 60), at + 70).replace(/\n/g, ' | ')
    })(),
  })
}

const tally = {}
for (const r of out) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1
fs.writeFileSync(path.join(OUT, 'step3b1-entity-review.json'), JSON.stringify({
  note: 'The 38 NO_ALIAS_EVER_REGISTERED rows, reviewed individually. Report only — nothing applied.',
  reviewed: out.length, byVerdict: tally, rows: out,
}, null, 1))

const NAME = { A: 'EXPLICIT_ENTITY_MISSING_FROM_REGISTRY', B: 'EXISTING_ENTITY_ALIAS_MISSING',
  C: 'INFERRED_NOT_EXPLICIT', D: 'QUOTED_OR_PASTED_MATERIAL', E: 'WRONG_IDENTITY', F: 'GENUINELY_UNRESOLVED' }
console.log(`reviewed ${out.length} rows\n`)
for (const [k, v] of Object.entries(tally).sort()) console.log(`  ${k}  ${String(v).padStart(3)}  ${NAME[k]}`)
console.log('\nper row:')
for (const r of out) console.log(`  ${r.verdict}  #${String(r.postNum).padEnd(5)} ${String(r.identity).padEnd(24)} ${r.reason.slice(0, 96)}`)
console.log('\n-> audit/step3b1-entity-review.json')
