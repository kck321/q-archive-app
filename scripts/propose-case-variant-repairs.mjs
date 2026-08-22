// PHASE B1B — the case-variant entity family, sub-classified before anything is applied.
//
//   node scripts/propose-case-variant-repairs.mjs
//
// Reports only. Writes audit/step3b1-b1b-proposal.json.
//
// The population moved after B1A and the GOD ruling, so it is re-measured here rather than
// inherited. Each row is placed in one of five subgroups, and only A and B are proposed:
//
//   A EXPLICIT_ALIAS_REGISTRATION   the drop writes ONE casing of a registered identity, that
//                                   casing is unambiguous archive-wide, and registering it as an
//                                   exact alias resolves the row by exact matching — the GOD
//                                   mechanism, which needs no matching-rule change at all
//   B UNIQUE_SAFE_CASE_FOLD         a case-fold locates exactly one word-bounded occurrence and
//                                   no exact-case candidate competes with it
//   C AMBIGUOUS_OCCURRENCE          more than one word-bounded candidate, or exact and folded
//                                   disagree — the ordinal is a guess, so it is not made
//   D MID_WORD_OR_FALSE_POSITIVE    the only match is inside another word. Invariant 4.
//   E DIFFERENT_IDENTITY            the token is present but demonstrably not this identity
//
// A is preferred over B wherever it applies, because an explicit alias changes DATA the owner can
// read, while a case-fold changes BEHAVIOUR that silently applies everywhere for ever.
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

// Invariant 4 without a regex, and invariant 6: "+" counts as a word character.
const isWord = ch => ch !== undefined && /[A-Za-z0-9+]/.test(ch)
const bounded = (body, at, len) => !isWord(body[at - 1]) && !isWord(body[at + len])
function hitsExact(body, needle) {
  const out = []
  for (let i = 0; ;) {
    const at = body.indexOf(needle, i)
    if (at < 0) return out
    if (bounded(body, at, needle.length)) out.push(at)
    i = at + 1
  }
}
function hitsFolded(body, needle) {
  const lb = body.toLowerCase(), ln = String(needle).toLowerCase()
  const out = []
  for (let i = 0; ;) {
    const at = lb.indexOf(ln, i)
    if (at < 0) return out
    if (bounded(body, at, ln.length)) out.push(at)
    i = at + 1
  }
}
/** Every word-bounded casing of `form` that occurs anywhere in the archive. */
const castingCache = new Map()
function castingsOf(form) {
  const k = String(form).toLowerCase()
  if (castingCache.has(k)) return castingCache.get(k)
  const seen = new Map()
  for (const p of posts) {
    const body = runtimeText(p.text ?? '')
    for (const at of hitsFolded(body, form)) {
      const lit = body.slice(at, at + String(form).length)
      seen.set(lit, (seen.get(lit) ?? 0) + 1)
    }
  }
  castingCache.set(k, seen)
  return seen
}

const rows = tax.rows.filter(r => r.subtype === 'CASE_VARIANT_NOT_REGISTERED')
const out = []

for (const r of rows) {
  const p = byNum.get(r.postNum)
  const body = runtimeText(p?.text ?? '')
  const forms = EF.formsFor(r.identity)
  const canonical = EF.canonicalFor(r.identity)
  // Which registered form does this drop actually carry, and in what casing?
  let chosen = null
  for (const f of forms) {
    const folded = hitsFolded(body, f)
    if (!folded.length) continue
    const exact = hitsExact(body, f)
    chosen = { form: f, folded, exact, literal: body.slice(folded[0], folded[0] + String(f).length) }
    break
  }
  const base = { conflictId: r.conflictId, postNum: r.postNum, identity: r.identity, canonical,
    registeredForms: forms.length }

  if (!chosen) {
    // Folded match exists somewhere per the taxonomy, but not at a word boundary here.
    out.push({ ...base, group: 'D', groupName: 'MID_WORD_OR_FALSE_POSITIVE',
      why: 'no registered form occurs at a word boundary on this drop; the only matches are inside another word (invariant 4)' })
    continue
  }

  const { form, folded, exact, literal } = chosen
  const detail = { form, literalOnDrop: literal, wordBoundedHits: folded.length, exactCaseHits: exact.length }

  if (exact.length) {
    // Exact case already works — this row should have resolved. Report rather than repair.
    out.push({ ...base, ...detail, group: 'E', groupName: 'DIFFERENT_IDENTITY',
      why: 'an exact-case match already exists on this drop, so the unlocated report is not about casing' })
    continue
  }
  if (folded.length > 1) {
    out.push({ ...base, ...detail, group: 'C', groupName: 'AMBIGUOUS_OCCURRENCE',
      why: `${folded.length} word-bounded candidates and no exact-case anchor; choosing one is an ordinal guess` })
    continue
  }

  // One word-bounded candidate, no exact-case competitor. Now: is the CASING it uses unambiguous
  // across the archive, so registering it as an explicit alias is safe?
  const castings = castingsOf(form)
  const others = [...castings.keys()].filter(c => c !== literal)
  const strangers = []
  for (const p2 of posts) {
    const b2 = runtimeText(p2.text ?? '')
    if (!hitsExact(b2, literal).length) continue
    const ids = p2.postAnalysis?.namedEntities ?? []
    const claimsIt = ids.some(x => (EF.canonicalFor(x) ?? x) === canonical)
    if (!claimsIt) strangers.push(p2.postNum)
  }
  const shortForm = String(literal).length <= 3

  if (strangers.length === 0 && !shortForm) {
    out.push({ ...base, ...detail, group: 'A', groupName: 'EXPLICIT_ALIAS_REGISTRATION',
      castingsInArchive: [...castings.entries()], otherCastings: others,
      dropsUsingThisCastingWithoutTheIdentity: 0,
      why: `every drop in the archive containing word-bounded "${literal}" already records ${canonical}, so registering that exact casing captures nothing else` })
  } else if (strangers.length === 0 && shortForm) {
    out.push({ ...base, ...detail, group: 'C', groupName: 'AMBIGUOUS_OCCURRENCE',
      why: `"${literal}" is <= 3 characters; a short token gets no blanket exemption, and it needs an owner ruling like GOD did`,
      dropsUsingThisCastingWithoutTheIdentity: 0 })
  } else {
    out.push({ ...base, ...detail, group: 'E', groupName: 'DIFFERENT_IDENTITY',
      dropsUsingThisCastingWithoutTheIdentity: strangers.length,
      strangerPosts: strangers.slice(0, 10),
      why: `${strangers.length} drop(s) contain word-bounded "${literal}" without recording ${canonical}, so this casing is not a reliable marker of the identity` })
  }
}

const tally = (list, f) => {
  const t = {}
  for (const x of list) { const k = f(x); t[k] = (t[k] ?? 0) + 1 }
  return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]))
}
// The A group collapses to a small set of ALIAS REGISTRATIONS — that is the whole point of it.
const aliasSet = new Map()
for (const r of out.filter(x => x.group === 'A')) {
  const k = `${r.canonical}|${r.literalOnDrop}`
  if (!aliasSet.has(k)) aliasSet.set(k, { canonical: r.canonical, alias: r.literalOnDrop, rows: 0, posts: [] })
  const e = aliasSet.get(k); e.rows++; e.posts.push(r.postNum)
}

const doc = {
  note: 'PHASE B1B proposal. Nothing applied. A and B are deterministic; C, D and E are refused with evidence.',
  measuredRows: out.length,
  byGroup: tally(out, r => `${r.group} ${r.groupName}`),
  aliasRegistrationsProposed: [...aliasSet.values()].sort((a, b) => b.rows - a.rows),
  distinctAliasesProposed: aliasSet.size,
  rows: out,
}
fs.writeFileSync(path.join(OUT, 'step3b1-b1b-proposal.json'), JSON.stringify(doc, null, 1))

console.log(`case-variant rows re-measured: ${out.length}\n`)
for (const [k, v] of Object.entries(doc.byGroup)) console.log(`  ${String(v).padStart(4)}  ${k}`)
console.log(`\n${aliasSet.size} explicit alias registrations would cover the whole A group:`)
for (const a of doc.aliasRegistrationsProposed.slice(0, 30))
  console.log(`  ${String(a.rows).padStart(3)}  ${a.canonical}  <-  "${a.alias}"`)
console.log('\n-> audit/step3b1-b1b-proposal.json')
