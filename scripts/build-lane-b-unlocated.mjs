// LANE B FAMILY 4 — turn the reviewed UNLOCATED dispositions into the three things they need.
//
//   node scripts/build-lane-b-unlocated.mjs
//
// Writes:
//   audit/entities-owner-rulings.json          the B rows, appended to aliasAdditions
//   audit/occurrence-withdrawals-lane-b.json   the E rows, for apply-entity-cleanup.mjs
//   audit/step3b1-lb4-actions.jsonl            the two question withdrawals, for apply-step3b1.mjs
//
// It decides nothing. Every disposition, alias spelling and reason comes from the reviewed file;
// what this computes is the part that must not be typed — the occurrence index of each record in
// postAnalysis.namedEntities, and the carrier URL of each migration, both measured from the drop.
//
// THE B ROWS MOVE NO COUNT, and that is the whole reason they are aliasAdditions rather than
// aliasRulings. apply-entities.mjs pushes the spelling onto the alias list and re-scans nothing:
// a record a section already wrote can now find its own characters, and a drop that never
// recorded the identity gains nothing. Asserted below rather than assumed.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { runtimeText } from './lib/runtimeText.mjs'
import { buildEntityForms } from './lib/entityForms.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const DATA = path.join(ROOT, 'public', 'data')
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
const sha = b => crypto.createHash('sha256').update(b).digest('hex')

// TWO reviewed files, one builder. Family 5's remaining structural rows are the same three cases
// as family 4 — Q's own spelling, a URL-only trace, or genuinely unsettled — so they are built the
// same way rather than through a second mechanism with a second set of checks.
const DISPOSITION_FILES = [
  'audit/lane-b-dispositions-unlocated.json',
  'audit/lane-b-dispositions-structural.json',
]
const disp = { family: 'lane B — UNLOCATED and structural', rows: DISPOSITION_FILES.flatMap(f => rd(f).rows) }
const posts = rd('public/data/posts.json')
const entities = rd('public/data/entities.json')
const audit = rd('audit/occurrence-provenance-audit.json')
const rulingsPath = path.join(OUT, 'entities-owner-rulings.json')
const rulings = JSON.parse(fs.readFileSync(rulingsPath, 'utf8'))
const byNum = new Map(posts.map(p => [p.postNum, p]))
const forms = buildEntityForms(entities)
const entByCanonical = new Map(entities.entities.map(e => [e.canonical, e]))

const problems = []
const aliasRows = []
const withdrawals = []
const questionActions = []

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

for (const row of disp.rows) {
  // ── the two question records: ordinary span-keyed withdrawals ─────────────
  if (row.questionWithdrawal) {
    const [n, kind, s, e] = row.questionWithdrawal.split('|')
    const p = byNum.get(Number(n))
    const body = runtimeText(p.text ?? '')
    const text = body.slice(Number(s), Number(e))
    if (!text.trim()) { problems.push(`${row.conflictId}: withdrawal span is blank`); continue }
    questionActions.push({
      postNum: Number(n), sentenceId: null, sourceDisposition: 'q_authored',
      oldOccurrenceKeys: [row.questionWithdrawal], oldCategories: [`${kind}@${s}..${e}`],
      proposedSecondarySemantics: [], proposedReviewDispositions: [],
      recordsWithdrawn: [row.questionWithdrawal], withdrawReason: row.reason,
      metadataTransferred: row.questionWithdrawal, relationshipsPreserved: '',
      confidence: 'HIGH', humanReviewRequired: false,
      actionId: `LB4-DROP-${n}-${kind}-${s}-${e}`,
      kind: 'WITHDRAW_RECORD',
      sentenceStart: Number(s), sentenceEnd: Number(e), sentenceText: text,
      proposedPrimaryCategory: null,
      // ONE SPAN, TWO RECORDS, AND ONLY ONE IS THE MISTAKE. #2971 and #4454 each carry a
      // segmentation-recovered question AND the 2026-08-20 queue ruling's record over the same
      // characters, so the key alone names two things. B3-NARROW already re-spanned the recovered
      // one; this withdraws the other, and says which by id.
      ...(row.targetQuestionId ? { targetQuestionId: row.targetQuestionId } : {}),
      ruleCode: 'LANEB_QUESTION_OVER_PASTED_MATERIAL',
      adjudication: 'E — WITHDRAW',
      adjudicationReason: row.reason,
      laneBDisposition: 'E', laneBFamily: disp.family,
      ...(row.flagForOwner ? { flaggedForOwner: true } : {}),
    })
    continue
  }
  if (row.disposition === 'A') continue
  // F and QUARANTINED are dispositions, not actions. They are recorded in the reviewed file and
  // reported by the final reconciliation; nothing is written to the bundle for them, which is the
  // whole point of both states.
  if (row.disposition === 'F' || row.disposition === 'QUARANTINED') continue
  // A row resolved through another door — the held-disposition file owns the two question records
  // whose spans are what held actions A-DUP-2971 and A-DUP-4454 were waiting on. Recorded here so
  // the family is complete on the page; applied there so it supersedes the held action rather than
  // adding a second action over the same characters.
  if (row.resolvedVia) continue

  const p = byNum.get(row.postNum)
  if (!p) { problems.push(`#${row.postNum}: no such drop`); continue }
  // PRESENCE IS CHECKED IN THE AUDIT'S COORDINATE SYSTEM, NOT THE FINISHED BUNDLE'S.
  //
  // The finished bundle no longer holds an occurrence this file has already withdrawn, so a
  // presence check against it passes on the first build and fails on every rebuild — which is a
  // property of when you ran it, not of whether the row is right. The audit is the fixed frame:
  // it must hold exactly one row for this (post, alias), and that row supplies the index.
  // apply-entity-cleanup.mjs then asserts `named[index] === alias` at apply time, against the
  // pre-cleanup tree where that assertion actually means something.
  // THE INDEX COMES FROM THE AUDIT, NOT FROM THE BUNDLE ON DISK.
  //
  // apply-entity-cleanup.mjs runs immediately after apply-entities.mjs has rebuilt posts.json from
  // the PRE-cleanup adjudication, so an occurrence's index there is the audit's index and not the
  // one it has in the finished bundle — the 951 approved removals have not happened yet at that
  // point. Reading indexOf() off the current tree produced three collisions (#1910, #2040, #4241)
  // where a post-cleanup index happened to name an occurrence the approved plan already acts on.
  const auditRows = audit.rows.filter(r => r.postNum === row.postNum && r.alias === row.identity)
  if (auditRows.length !== 1) {
    problems.push(`#${row.postNum}: the 2026-08-17 audit holds ${auditRows.length} rows for "${row.identity}" — cannot name one occurrence`)
    continue
  }
  const idx = auditRows[0].index
  const canonical = forms.canonicalFor(row.identity) ?? row.identity
  const e = entByCanonical.get(canonical)
  if (!e) { problems.push(`#${row.postNum}: "${row.identity}" resolves to no live identity`); continue }
  const body = runtimeText(p.text ?? '')

  // ── B: register the spelling Q used ───────────────────────────────────────
  if (row.disposition === 'B') {
    const spelling = row.registerAlias
    const re = new RegExp(`(?<![A-Za-z0-9])${esc(spelling)}(?![A-Za-z0-9])`)
    if (!re.test(body)) { problems.push(`#${row.postNum}: ${JSON.stringify(spelling)} is not word-bounded in the drop`); continue }
    // it must not already be registered to a DIFFERENT identity — that would be a second identity
    // wearing one spelling, which is the collision buildEntityForms refuses to decide silently.
    const other = entities.entities.find(x => x.canonical !== canonical
      && [x.canonical, ...(x.aliases ?? []).map(a => a.text ?? a)].some(f => String(f) === spelling))
    if (other) { problems.push(`#${row.postNum}: ${JSON.stringify(spelling)} is already registered to ${other.canonical}`); continue }
    aliasRows.push({ canonical, alias: spelling, postNum: row.postNum, reason: row.reason })
    continue
  }

  // ── E: withdraw or migrate the occurrence ─────────────────────────────────
  if (row.disposition === 'E') {
    const action = row.withdrawAction ?? 'remove-annotation'
    let carriers = []
    if (action !== 'remove-annotation') {
      // the carrier is the URL on the line that carries the trace, taken from the drop
      const lines = String(p.text ?? '').split('\n')
      const needle = row.handle ?? row.identity
      for (const l of lines) {
        const m = l.replace(/<\/?em>/g, '').match(/https?:\s*\/\/\s*\S+|www\.\S+/i)
        if (!m) continue
        const url = m[0].replace(/^(https?:)\s*\/\/\s*/i, '$1//')
        const hay = url.toLowerCase().replace(/[^a-z0-9]/g, '')
        const nd = String(needle).toLowerCase().replace(/[^a-z0-9]/g, '')
        if (hay.includes(nd)) carriers.push(url)
      }
      carriers = [...new Set(carriers)]
      // A row may name its carrier when the domain does not spell the identity — saraacarter.com
      // carries two a's, so no automatic match on "Sara Carter" can find it.
      if (row.carrierUrl) carriers = [row.carrierUrl]
      if (!carriers.length) { problems.push(`#${row.postNum}: ${action} but no carrier URL on the drop mentions ${JSON.stringify(needle)}`); continue }
    }
    withdrawals.push({
      occurrenceId: `#${row.postNum}:${idx}`,
      postNum: row.postNum, index: idx, alias: row.identity,
      entityId: e.id, canonical: e.canonical, entityType: e.type,
      originalCategory: 'unlocated_span',
      originalEvidence: { category: 'unlocated_span', note: 'no registered spelling of this identity is findable on the drop; the trace is a URL, a handle or nothing' },
      originalProposedAction: 'keep',
      originalCertifiedCountEffect: 0,
      adjudication: `E — ${action === 'remove-annotation' ? 'WITHDRAW' : 'MIGRATE — the reference is real, the layer was wrong'}`,
      reasonForWithdrawal: row.reason,
      ownerRuling: 'Lane B family 4 (2026-08-22), under the owner instruction of the same date: every human-semantic conflict row receives one explicit disposition, and E is "the record does not belong as Q-authored semantic paint".',
      overridesProtection: null,
      originalIdentityText: row.identity,
      originalPostText: String(p.text ?? ''),
      originalPostTextSha256: sha(String(p.text ?? '')),
      originalContext: body.slice(0, 240),
      rationaleCorrection: null,
      proposedAction: action,
      urlEvidence: row.urlEvidence ?? null,
      carriers,
      platform: row.platform ?? null,
      handle: row.handle ?? null,
      certifiedCountEffect: -1,
      reversal: `Restore "${row.identity}" at index ${idx} of postAnalysis.namedEntities in #${row.postNum} and add 1 to ${e.canonical}.`,
    })
    continue
  }
  problems.push(`#${row.postNum}: disposition ${row.disposition} is not buildable`)
}

if (problems.length) {
  console.error(`\n[X] ${problems.length} problem(s):`)
  for (const m of problems) console.error('   ' + m)
  process.exit(1)
}

// ── write the alias additions ───────────────────────────────────────────────
const existing = new Set((rulings.aliasAdditions ?? []).map(a => `${a.canonical}|${a.alias}`))
const grouped = new Map()
for (const a of aliasRows) {
  const k = `${a.canonical}|${a.alias}`
  if (!grouped.has(k)) grouped.set(k, { canonical: a.canonical, alias: a.alias, posts: [], reason: a.reason })
  grouped.get(k).posts.push(a.postNum)
}
let added = 0
for (const g of grouped.values()) {
  if (existing.has(`${g.canonical}|${g.alias}`)) continue
  rulings.aliasAdditions.push({
    canonical: g.canonical, alias: g.alias,
    ruledOn: '2026-08-22', batch: 'lane B family 4 — UNLOCATED review',
    reasoning: g.reason,
    posts: g.posts.sort((x, y) => x - y),
    affectedRows: g.posts.length,
    proof: 'Word-bounded in the drop, in Q-authored prose or in pasted material the archive already '
      + 'certifies entity mentions inside, and registered to no other identity. B1B refused these on '
      + 'the corpus test "do any drops carry this spelling WITHOUT recording the identity" — the right '
      + 'test for a rule that DERIVES occurrences, and not the test for this one.',
    movesNoCount: 'An alias only helps LOCATE an identity a section already recorded. apply-entities.mjs '
      + 'pushes the spelling onto the alias list and re-scans nothing. Entity mention totals are unchanged.',
  })
  added++
}
fs.writeFileSync(rulingsPath, JSON.stringify(rulings, null, 1) + '\n')

// ── write the occurrence withdrawals ────────────────────────────────────────
const byAction = withdrawals.reduce((m, w) => ({ ...m, [w.proposedAction]: (m[w.proposedAction] ?? 0) + 1 }), {})
const perEntity = new Map()
for (const w of withdrawals) perEntity.set(w.entityId, (perEntity.get(w.entityId) ?? 0) + 1)
const zeroed = []
for (const [id, n] of perEntity) {
  const e = entities.entities.find(x => x.id === id)
  if (e && e.mentions - n <= 0) zeroed.push({ entityId: id, canonical: e.canonical, mentionsBefore: e.mentions, withdrawn: n })
}
fs.writeFileSync(path.join(OUT, 'occurrence-withdrawals-lane-b.json'), JSON.stringify({
  note: 'Lane B family 4 — entity occurrences whose only trace on the drop is a URL, a social handle '
    + 'or nothing at all. Read by apply-entity-cleanup.mjs as an additional, separately-pinned action '
    + 'set, exactly as Owner Ruling 3 is. The 2026-08-17 audit and its approval record are not modified.',
  ruledOn: '2026-08-22',
  basis: disp.note,
  layerSplit: byAction,
  measuredAtBuildTime: {
    entityRows: entities.entities.length, mentions: entities.totals.mentions,
    entitiesWhoseLastMentionThisWithdraws: zeroed.length, zeroed,
  },
  withdrawals,
}, null, 2) + '\n')

// ── write the question withdrawals ──────────────────────────────────────────
const lb4 = path.join(OUT, 'step3b1-lb4-actions.jsonl')
fs.writeFileSync(lb4, questionActions.map(a => JSON.stringify(a)).join('\n') + (questionActions.length ? '\n' : ''))

const shaOf = f => sha(fs.readFileSync(path.join(OUT, f)))
console.log(`Lane B family 4`)
console.log(`  rows reviewed          : ${disp.rows.length}`)
console.log(`  alias additions        : ${added} new (${aliasRows.length} rows resolved)`)
console.log(`  occurrence withdrawals : ${withdrawals.length}  ${JSON.stringify(byAction)}`)
console.log(`  identities losing their last mention: ${zeroed.length}  ${zeroed.map(z => z.canonical).join(', ')}`)
console.log(`  question withdrawals   : ${questionActions.length}`)
console.log(`  audit/occurrence-withdrawals-lane-b.json  sha256 ${shaOf('occurrence-withdrawals-lane-b.json')}`)
console.log(`  audit/step3b1-lb4-actions.jsonl           sha256 ${shaOf('step3b1-lb4-actions.jsonl')}`)
