// STEP 3B-1 — the 945-row conflict queue, clustered by root cause.
//
//   node scripts/taxonomize-step3b1-conflicts.mjs
//
// REPORTS ONLY. Writes audit/step3b1-conflict-taxonomy.json and prints the summary. Nothing in
// public/data is read for anything but evidence, and nothing is written there.
//
// The point of this pass is to find out whether 945 rows are 945 judgements or a much smaller
// number of repeated defects wearing 945 costumes. Every row is enriched with what the bundle
// actually says now — not with what the queue said when it was written — and then placed in one
// of five lanes:
//
//   A DETERMINISTIC_RESOLUTION   evidence fixes it, and the same fix serves the whole cluster
//   B HUMAN_SEMANTIC_REVIEW      what Q meant has to be decided
//   C STRUCTURAL_DATA_DEFECT     the record is wrong about the text, not about the meaning
//   D CURRENT_STATE_ALREADY_CORRECT  the queue calls it a conflict; the bundle is fine
//   E OTHER
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sentencesFor, occurrencesOfSpan } from './lib/sentenceLedger.mjs'
import { runtimeText } from './lib/runtimeText.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')

/** RFC4180 enough for this file: quoted fields, doubled quotes, embedded newlines. */
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === String.fromCharCode(10)) { row.push(cur); rows.push(row); row = []; cur = '' }
    else if (c !== String.fromCharCode(13)) cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows
}

// --rebuilt taxonomises the queue MEASURED FROM THE CURRENT BUNDLE rather than the frozen CSV.
// Same clustering, same lanes, so the two runs are directly comparable.
const useRebuilt = process.argv.includes('--rebuilt')
let conflicts
if (useRebuilt) {
  const q = JSON.parse(fs.readFileSync(path.join(OUT, 'step3b1-conflict-queue-rebuilt.json'), 'utf8'))
  conflicts = q.rows.map(r => ({ ...r, aliasesAttempted: '', sourceDisposition: 'q_authored',
    alsoDuplicateKey: 'false', postContext: '' }))
  console.log(`taxonomising the REBUILT queue: ${conflicts.length} rows measured from the current bundle
`)
} else {
  const csv = parseCsv(fs.readFileSync(path.join(ROOT, 'STEP3B1-DRYRUN', '10-CONFLICTS-HELD.csv'), 'utf8').trim())
  const head = csv[0]
  conflicts = csv.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
  if (conflicts.length !== 945) { console.error(`[X] expected 945 conflict rows, read ${conflicts.length}`); process.exit(1) }
}

const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'))
const entitiesDoc = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))
const ledger = JSON.parse(fs.readFileSync(path.join(OUT, 'occurrence-ledger.json'), 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))

// TWO LOOKUPS, BECAUSE THE DIFFERENCE BETWEEN THEM IS THE FINDING.
//
// canonicalOnly is what build-occurrence-ledger.mjs actually does: alias forms are fetched by
// CANONICAL name. But postAnalysis.namedEntities does not only store canonicals — it stores the
// identity the section recorded, and "Hussein" is an ALIAS of "Barack Obama", "Sessions" of
// "Jeff Sessions", "Mueller" of "Robert Mueller". None of those has a key in a canonical-keyed
// map, so the alias fallback never runs and the entity is reported unlocatable.
//
// groupForms accepts ANY registered form as the key and returns every form in that identity's
// group, which is what the ledger's own comment says the fallback is for.
const canonicalOnly = new Map()
const groupForms = new Map()
// How many registry GROUPS claim a given spelling. Two means the same person is registered twice —
// "Wray" is its own canonical with the single alias "Wray", and "WRAY" is an alias of "Christopher
// Wray". A lookup cannot pick between them without deciding which identity the drop meant, so it
// takes the first registration and this counter names the ones that need a registry ruling.
const groupsClaiming = new Map()
for (const e of entitiesDoc.entities ?? []) {
  const forms = [...new Set([e.canonical, ...(e.aliases ?? []).map(a => a.text)].filter(Boolean))]
  canonicalOnly.set(String(e.canonical).toLowerCase(), forms)
  const seenHere = new Set()
  for (const f of forms) {
    const k = String(f).toLowerCase()
    if (!groupForms.has(k)) groupForms.set(k, new Set())
    for (const g of forms) groupForms.get(k).add(g)
    if (!seenHere.has(k)) { seenHere.add(k); groupsClaiming.set(k, (groupsClaiming.get(k) ?? 0) + 1) }
  }
}
const liveKeys = new Set(ledger.records.map(r => r.key))
const qByLiteral = new Map()
for (const q of questions) if (q.literal) qByLiteral.set(`${q.postNum}|${q.literal}`, q)

/** Everything on a drop that is NOT Q's own body: the quoted posts behind its >>NNNN pointers. */
function quotedTextOf(p) {
  const parts = []
  for (const q of p.quotedPosts ?? []) {
    if (typeof q === 'string') parts.push(q)
    else if (q && typeof q === 'object') for (const v of Object.values(q)) if (typeof v === 'string') parts.push(v)
  }
  return parts.join(String.fromCharCode(10))
}

const rows = conflicts.map(c => {
  const postNum = Number(c.postNum)
  const p = byNum.get(postNum)
  const body = runtimeText(p?.text ?? '')
  const out = { conflictId: c.conflictId, reason: c.reason, postNum, heldKey: c.heldKey,
    certifiedValue: c.certifiedValue, alsoDuplicateKey: c.alsoDuplicateKey === 'true' }

  if (c.reason === 'UNLOCATED_SPAN') {
    // The queue row names an IDENTITY the section recorded on this drop, which no registered
    // spelling could be found for in Q's body. Three very different things look identical here,
    // and only evidence separates them:
    //   · the spelling Q used is missing from the alias registry            -> registry gap
    //   · the identity is present, but in QUOTED material, not Q's words     -> source attribution
    //   · the identity is nowhere on the drop in any form                    -> inference or defect
    const identity = c.detail || c.certifiedValue
    const key = String(identity).toLowerCase()
    const kind = (c.heldKey.match(/^UNLOCATED-\d+-(.+)$/) ?? [])[1] ?? 'namedEntities'
    const canonForms = canonicalOnly.get(key) ?? []
    const allForms = [...(groupForms.get(key) ?? [])].sort((a, b) => b.length - a.length)
    const hitCanonical = canonForms.find(f => occurrencesOfSpan(p?.text ?? '', f).length)
    const hitGroup = allForms.find(f => occurrencesOfSpan(p?.text ?? '', f).length)
    // Case is the thing. The drops write HUSSEIN, SESSIONS, MUELLER, GOD in caps; the certified
    // identity is title case; occurrencesOfSpan() is indexOf, which is case-sensitive.
    const hitCaseless = !hitGroup && allForms.find(f => body.toLowerCase().includes(String(f).toLowerCase()))
    const quoted = quotedTextOf(p ?? {})
    const hitQuoted = !hitGroup && !hitCaseless && allForms.find(f => f && quoted.includes(f))
    Object.assign(out, {
      identity, kind,
      registeredForms: allForms.length,
      reachableByCanonicalKeyedLookup: canonForms.length > 0,
      locatedUnder: hitGroup ?? null,
      locatedCaseInsensitivelyUnder: hitCaseless ?? null,
      locatedInQuotedPostUnder: hitQuoted ?? null,
      registryGroupsClaimingThisSpelling: groupsClaiming.get(key) ?? 0,
      subtype: (groupsClaiming.get(key) ?? 0) > 1 ? 'IDENTITY_SPLIT_ACROSS_TWO_REGISTRY_GROUPS'
        : hitGroup ? 'ALIAS_KEYED_IDENTITY_LOOKUP_MISS'
        : hitCaseless ? 'CASE_VARIANT_NOT_REGISTERED'
        : hitQuoted ? 'PRESENT_ONLY_IN_QUOTED_MATERIAL'
        : allForms.length <= 1 ? 'NO_ALIAS_EVER_REGISTERED'
        : 'ABSENT_FROM_DROP_IN_EVERY_REGISTERED_FORM',
    })
  }

  if (c.reason === 'BOUNDARY_CROSSING') {
    const [, kind, s, e] = c.heldKey.split('|')
    const start = Number(s), end = Number(e)
    const sentences = sentencesFor(p?.text ?? '', postNum)
    const touched = sentences.filter(x => x.start < end && start < x.end)
    const span = body.slice(start, end)
    const q = qByLiteral.get(`${postNum}|${span}`)
    // Which shape of crossing is it? These are not variations on one problem.
    const subtype =
      !liveKeys.has(c.heldKey) ? 'NO_LONGER_PRESENT'
      : q ? (q.recoveredFromSegmentationError ? 'OVER_EXTENDED_SEGMENTATION_RECOVERY' : 'QUESTION_LITERAL_SPANS_SENTENCES')
      : /https?:\/\//.test(span) ? 'CONTAINS_URL'
      : span.includes(String.fromCharCode(10)) ? 'MULTI_LINE_SPAN'
      : 'WITHIN_LINE_CROSSING'
    Object.assign(out, { kind, start, end, sentencesTouched: touched.length,
      sentenceIds: touched.map(x => x.sentenceId), stillLive: liveKeys.has(c.heldKey),
      questionId: q?.id ?? null, spanPreview: span.slice(0, 120), subtype })
  }

  if (c.reason === 'DUPLICATE_KEY_CONFLICTING_METADATA') {
    const [, kind] = c.heldKey.split('|')
    // The manifest already established what this population really is: one span claimed by two
    // canonical identities ("Arizona" and "AZ" over the same two characters). The CSV prints them
    // as `"AZ" vs "AZ"` because the ledger stores MATCHED characters, so both sides read the same.
    const m = c.detail.match(/^"(.*)" vs "(.*)"$/)
    const sameText = Boolean(m && m[1] === m[2])
    Object.assign(out, { kind, sameMatchedText: sameText, stillLive: liveKeys.has(c.heldKey),
      recordsAtKey: ledger.records.filter(r => r.key === c.heldKey).length,
      subtype: kind === 'namedEntities' ? 'TWO_IDENTITIES_ONE_SPAN' : 'DUPLICATE_RECORD' })
  }

  if (c.reason === 'SAME_CATEGORY_PARTIAL_OVERLAP') {
    const sid = (c.heldKey.match(/^OVERLAP-(p\d+-s\d+)$/) ?? [])[1] ?? null
    const stillOverlapping = (() => {
      if (!sid) return null
      const sentence = sentencesFor(p?.text ?? '', postNum).find(x => x.sentenceId === sid)
      if (!sentence) return null
      const prim = ledger.records.filter(r => r.postNum === postNum && r.layer === 'primary'
        && r.start < sentence.end && sentence.start < r.end)
      for (let i = 0; i < prim.length; i++) for (let j = i + 1; j < prim.length; j++) {
        const a = prim[i], b = prim[j]
        if (a.kind === b.kind && a.start < b.end && b.start < a.end && !(a.start === b.start && a.end === b.end)) return true
      }
      return false
    })()
    Object.assign(out, { sentenceId: sid, stillOverlapping, spanPreview: c.certifiedValue.slice(0, 120),
      subtype: stillOverlapping === false ? 'RESOLVED_BY_A_LATER_APPLY' : 'PARTIAL_OVERLAP_LIVE' })
  }
  return out
})

// ── lanes ───────────────────────────────────────────────────────────────────────────────────
const LANE = {
  // Located under a registered spelling now, or no longer present: the bundle answers it.
  NO_LONGER_PRESENT: 'D', RESOLVED_BY_A_LATER_APPLY: 'D',
  // One lookup defect, 424 rows. The identity IS registered and IS on the drop; the ledger's
  // alias map is keyed by canonical and these identities are aliases.
  ALIAS_KEYED_IDENTITY_LOOKUP_MISS: 'A',
  // The same person registered as two canonical identities. A lookup may not choose between them.
  IDENTITY_SPLIT_ACROSS_TWO_REGISTRY_GROUPS: 'C',
  // Same defect one layer down: the drop writes the identity in caps and the caps form is not a
  // registered alias, so even a group-aware lookup misses it. indexOf is case-sensitive.
  CASE_VARIANT_NOT_REGISTERED: 'A',
  // A record whose span is wrong about the text — repairable from evidence, same fix per cluster.
  OVER_EXTENDED_SEGMENTATION_RECOVERY: 'A', CONTAINS_URL: 'A',
  TWO_IDENTITIES_ONE_SPAN: 'A',
  // Wrong data, but the right repair needs a decision per record.
  NO_ALIAS_EVER_REGISTERED: 'C', DUPLICATE_RECORD: 'C',
  // Genuine meaning calls.
  PRESENT_ONLY_IN_QUOTED_MATERIAL: 'B', ABSENT_FROM_DROP_IN_EVERY_REGISTERED_FORM: 'B',
  QUESTION_LITERAL_SPANS_SENTENCES: 'B', MULTI_LINE_SPAN: 'B', WITHIN_LINE_CROSSING: 'B',
  PARTIAL_OVERLAP_LIVE: 'B',
}
for (const r of rows) r.lane = LANE[r.subtype] ?? 'E'

const LANE_NAME = { A: 'A DETERMINISTIC_RESOLUTION', B: 'B HUMAN_SEMANTIC_REVIEW',
  C: 'C STRUCTURAL_DATA_DEFECT', D: 'D CURRENT_STATE_ALREADY_CORRECT', E: 'E OTHER' }

const tally = (list, f) => {
  const t = {}
  for (const x of list) { const k = f(x); t[k] = (t[k] ?? 0) + 1 }
  return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]))
}

// The question the owner actually asked: how many ROOT-CAUSE PATTERNS, not how many rows.
const signature = r => `${r.reason}::${r.subtype}`
const clusters = Object.entries(tally(rows, signature)).map(([sig, count]) => {
  const members = rows.filter(r => signature(r) === sig)
  return { signature: sig, count, lane: members[0].lane,
    posts: new Set(members.map(m => m.postNum)).size,
    identities: members[0].reason === 'UNLOCATED_SPAN'
      ? Object.entries(tally(members, m => m.identity)).slice(0, 12) : undefined,
    examples: members.slice(0, 3).map(m => ({ postNum: m.postNum, heldKey: m.heldKey,
      value: (m.spanPreview ?? m.identity ?? m.certifiedValue ?? '').slice(0, 100) })) }
}).sort((a, b) => b.count - a.count)

const repeatedText = Object.entries(tally(rows.filter(r => r.reason === 'UNLOCATED_SPAN'), r => r.identity))
const doc = {
  note: 'Step 3B-1 conflict-queue taxonomy. Report only — nothing applied, nothing withdrawn.',
  totalRows: rows.length,
  measuredFrom: useRebuilt ? 'current bundle (rebuilt)' : 'STEP3B1-DRYRUN/10-CONFLICTS-HELD.csv (frozen)',
  distinctConflictIds: new Set(rows.map(r => r.conflictId)).size,
  distinctHeldKeys: new Set(rows.map(r => r.heldKey)).size,
  distinctPosts: new Set(rows.map(r => r.postNum)).size,
  byReason: tally(rows, r => r.reason),
  bySourceLayer: tally(rows, r => r.kind ?? '(n/a)'),
  byLane: tally(rows, r => LANE_NAME[r.lane]),
  rootCausePatterns: clusters.length,
  clusters,
  repeatedIdentityClusters: repeatedText.filter(([, n]) => n > 1).length,
  singletonIdentities: repeatedText.filter(([, n]) => n === 1).length,
  largestIdentityClusters: repeatedText.slice(0, 20),
  rows,
}
fs.writeFileSync(path.join(OUT, useRebuilt ? 'step3b1-conflict-taxonomy-rebuilt.json' : 'step3b1-conflict-taxonomy.json'), JSON.stringify(doc, null, 1))

console.log(`${rows.length} conflict rows  ->  ${clusters.length} root-cause patterns` + String.fromCharCode(10))
console.log('by reason        :', JSON.stringify(doc.byReason))
console.log('by source layer  :', JSON.stringify(doc.bySourceLayer))
console.log('distinct heldKeys:', doc.distinctHeldKeys, ' posts:', doc.distinctPosts)
console.log('\nBY LANE')
for (const [k, v] of Object.entries(doc.byLane)) console.log(`  ${String(v).padStart(4)}  ${k}`)
console.log('\nCLUSTERS')
for (const c of clusters) {
  console.log(`  ${String(c.count).padStart(4)}  [${c.lane}]  ${c.signature}   (${c.posts} posts)`)
  for (const e of c.examples) console.log(`          #${e.postNum}  ${JSON.stringify(e.value.slice(0, 78))}`)
}
console.log(`\nrepeated identity clusters: ${doc.repeatedIdentityClusters}   singleton identities: ${doc.singletonIdentities}`)
console.log('largest:', JSON.stringify(doc.largestIdentityClusters.slice(0, 10)))
console.log('\n-> audit/step3b1-conflict-taxonomy.json')
