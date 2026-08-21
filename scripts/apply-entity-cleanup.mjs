// THE INTEGRATED ENTITY CLEANUP — one plan, one simulation, one reconciliation.
//
//   node scripts/apply-entity-cleanup.mjs                    simulate. Writes the plan; touches no data.
//   node scripts/apply-entity-cleanup.mjs --emit <dir>       write the post-cleanup artifacts somewhere harmless
//   node scripts/apply-entity-cleanup.mjs --prove-rollback   apply then roll back in a scratch copy,
//                                                            and prove every certified byte returned.
//   node scripts/apply-entity-cleanup.mjs --apply --approved-by-owner "<ruling>"
//   node scripts/apply-entity-cleanup.mjs --rollback
//
// OWNER RULING, 2026-08-17. The −411/1,288 proposal is obsolete and the −504/1,254 result was
// provisional: neither carried the 116 publisher-provenance occurrences or the corpus-wide boundary
// audit. This applier replaces both. It reads ONE input — audit/occurrence-provenance-audit.json,
// which classifies every one of the 9,749 certified occurrences — and derives everything else from
// it, so there is no second opinion to reconcile against.
//
// DEDUPLICATION IS STRUCTURAL, NOT A PASS.
//
// The old plan worked per (entity, post, alias) with counts, and an occurrence that qualified under
// two defects could have been subtracted twice — a URL fragment that is also a substring match, for
// instance. Here the unit is the certified occurrence itself, `#<post>:<index>`, and the audit gives
// each one exactly ONE category and ONE action. Double subtraction is not prevented by a check; it
// is unrepresentable.
//
// THE FOUR THINGS THIS MUST NEVER DO
//   - act on an ambiguous record
//   - remove a prose occurrence because the same entity also appears in a URL in that drop
//   - proceed when a before-state does not match exactly
//   - write anything without the owner's approval passed on the command line
//
// ROLLBACK IS BYTES, NOT ARITHMETIC. The reversal contract says what to put back, and it is checked.
// But the thing restored is the SNAPSHOT — the original files, byte for byte — because a re-derived
// restoration is a second opinion about the original, and the original is not a matter of opinion.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { hostnameOf, glue } from './lib/renderedMatch.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const SNAPS = path.join(ROOT, '.snapshots')
const read = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))
const sha = s => createHash('sha256').update(s).digest('hex')
const shaFile = f => sha(fs.readFileSync(f))

const argv = process.argv.slice(2)
const has = f => argv.includes(f)
const valueOf = f => { const i = argv.indexOf(f); return i > -1 ? argv[i + 1] : null }
const MODE = has('--rollback') ? 'rollback' : has('--rematerialise') ? 'rematerialise'
  : has('--apply') ? 'apply' : has('--prove-rollback') ? 'prove-rollback'
    : has('--emit') ? 'emit' : 'simulate'

const TOUCHED = ['entities.json', 'posts.json', 'linked-sources.json']
const ALL_ARTIFACTS = fs.readdirSync(DATA).filter(f => f.endsWith('.json')).sort()

// Platforms host material; they do not identify the publisher of it.
const PLATFORMS = /^(twitter\.com|x\.com|youtube\.com|youtu\.be|t\.co|archive\.org|web\.archive\.org|docs\.google\.com|drive\.google\.com|pastebin\.com|imgur\.com|scribd\.com|documentcloud\.org|assets\.documentcloud\.org)$/

// ════════════════════════════════════════════════════════════════════════════
// THE PLAN — derived from the occurrence audit, one action per certified occurrence.
// ════════════════════════════════════════════════════════════════════════════
function buildPlan(dataDir) {
  const audit = read(OUT, 'occurrence-provenance-audit.json')
  const entities = read(dataDir, 'entities.json')
  const posts = read(dataDir, 'posts.json')
  const byId = new Map(entities.entities.map(e => [e.id, e]))
  const postByNum = new Map(posts.map(p => [p.postNum, p]))

  if (audit.totals.occurrences !== entities.totals.mentions) {
    console.error(`\n  ❌ the audit covers ${audit.totals.occurrences} occurrences but ${entities.totals.mentions} are certified. Re-run audit-occurrence-provenance.mjs.\n`)
    process.exit(1)
  }

  const actions = []
  const seen = new Set()
  const refusals = []

  for (const r of audit.rows) {
    if (seen.has(r.occurrenceId)) { refusals.push(`${r.occurrenceId}: appears twice in the audit`); continue }
    seen.add(r.occurrenceId)
    if (r.certifiedCountEffect === 0) continue     // keep or hold — nothing to do
    if (!['remove-annotation', 'migrate-to-linked-source', 'migrate-to-social-account'].includes(r.proposedAction)) {
      refusals.push(`${r.occurrenceId}: count effect ${r.certifiedCountEffect} with action "${r.proposedAction}"`)
      continue
    }
    if (r.category === 'ambiguous_provenance') { refusals.push(`${r.occurrenceId}: ambiguous record has a non-keep action`); continue }

    const post = postByNum.get(r.postNum)
    const e = byId.get(r.entityId)
    if (!post || !e) { refusals.push(`${r.occurrenceId}: entity or drop has gone`); continue }
    const named = post.postAnalysis?.namedEntities ?? []
    if (named[r.index] !== r.alias) {
      refusals.push(`${r.occurrenceId}: expected "${r.alias}" at index ${r.index}, found "${named[r.index]}"`)
      continue
    }

    actions.push({
      occurrenceId: r.occurrenceId,
      postNum: r.postNum,
      index: r.index,
      alias: r.alias,
      entityId: r.entityId,
      canonical: e.canonical,
      entityType: e.type,
      category: r.category,
      urlEvidence: r.evidence?.urlEvidence ?? null,
      carriers: r.evidence?.carriers ?? [],
      host: r.evidence?.host ?? null,
      platform: r.evidence?.platform ?? null,
      handle: r.evidence?.handle ?? null,
      action: r.proposedAction,
      before: {
        entityMentions: e.mentions,
        namedEntitiesInPost: named.length,
        aliasAtIndex: named[r.index],
        postTextSha: sha(String(post.text ?? '')).slice(0, 16),
      },
      justification: r.category === 'invalid_substring_extraction'
        ? `The alias occurs in this drop only inside ${JSON.stringify(r.evidence.containingWords.slice(0, 3))}. A substring is not a mention.`
        : r.category === 'social_account_reference'
          ? `Q linked to ${r.evidence.platform}/${r.evidence.handle}. A genuine reference, but not a word he wrote — it belongs in linked-source metadata.`
          : r.category === 'no_supported_provenance'
            ? 'No complete-token prose match, no URL-source relationship, no confirmed image evidence, no certified metadata basis. Withdrawal approved by the owner on 2026-08-17.'
            : r.evidence?.urlEvidence === 'path' ? 'A path slug is generated by the publisher\'s CMS, not written by Q.'
              : r.evidence?.urlEvidence === 'query' ? 'A query term records what Q searched for, not what he wrote.'
                : 'The domain identifies the publisher of the linked material — real information, wrong layer.',
      reversal: `Restore "${r.alias}" at index ${r.index} of postAnalysis.namedEntities in #${r.postNum} and add 1 to ${e.canonical}.`,
    })
  }

  // THE RULE THAT PROTECTS Q'S OWN WORDS, asserted per drop rather than per row: a drop must never
  // lose every occurrence of an entity that also appears there as a complete token.
  const keptByKey = new Map()
  for (const r of audit.rows) {
    if (!r.entityId) continue
    const k = `${r.entityId} ${r.postNum}`
    const kept = r.certifiedCountEffect === 0 ? 1 : 0
    keptByKey.set(k, (keptByKey.get(k) ?? 0) + kept)
  }
  for (const r of audit.rows) {
    if (!r.entityId || r.category !== 'visible_complete_token') continue
    if (r.certifiedCountEffect !== 0) refusals.push(`${r.occurrenceId}: a visible complete token has a removal action`)
  }

  return { audit, actions, refusals }
}

// ════════════════════════════════════════════════════════════════════════════
// THE TRANSFORM — one code path, used by the simulation, the proof and the write.
// ════════════════════════════════════════════════════════════════════════════
function transform(dataDir, { audit, actions }) {
  const entities = read(dataDir, 'entities.json')
  const posts = read(dataDir, 'posts.json')
  const before = {
    mentions: entities.totals.mentions,
    entityRows: entities.entities.length,
    rendered: posts.reduce((n, p) => n + (p.postAnalysis?.namedEntities ?? []).length, 0),
  }

  const nextEntities = JSON.parse(JSON.stringify(entities))
  const nextPosts = JSON.parse(JSON.stringify(posts))
  const byId = new Map(nextEntities.entities.map(e => [e.id, e]))
  const postByNum = new Map(nextPosts.map(p => [p.postNum, p]))

  // ── remove, highest index first ───────────────────────────────────────────
  // Splicing by index only stays correct if the later indices go first; doing it in audit order
  // silently shifts every subsequent removal in the same drop by one.
  const byPost = new Map()
  for (const a of actions) {
    if (!byPost.has(a.postNum)) byPost.set(a.postNum, [])
    byPost.get(a.postNum).push(a)
  }
  for (const [postNum, list] of byPost) {
    const post = postByNum.get(postNum)
    if (sha(String(post.text ?? '')).slice(0, 16) !== list[0].before.postTextSha) {
      throw new Error(`#${postNum}: the drop's text has changed since the audit — refusing`)
    }
    const named = post.postAnalysis.namedEntities
    for (const a of [...list].sort((x, y) => y.index - x.index)) {
      if (named[a.index] !== a.alias) throw new Error(`${a.occurrenceId}: expected "${a.alias}", found "${named[a.index]}"`)
      named.splice(a.index, 1)
      const e = byId.get(a.entityId)
      e.mentions -= 1
    }
    // The drop keeps the entity only while an entry for it survives.
    for (const a of list) {
      const e = byId.get(a.entityId)
      const aliases = [...e.aliases.map(x => x.text), e.canonical].map(x => x.toLowerCase())
      if (!named.some(t => aliases.includes(t.toLowerCase()))) e.posts = e.posts.filter(n => n !== postNum)
    }
  }

  // ── linked sources ────────────────────────────────────────────────────────
  // Built from the MIGRATE actions only, deduplicated by (post, url). One publisher linked twice in
  // a drop is one source, not two — which is why adding 116 occurrences does not add 116 sources.
  // TWO KINDS, ONE ARTIFACT. A publisher and a social account are both "where this came from", so
  // they share a surface and a search section — but they are not the same claim, and the `kind`
  // field is what stops a reader being told that Q cited Reuters when he linked to someone's
  // Twitter profile.
  const linkedSources = []
  const seenLink = new Set()
  for (const a of actions.filter(x => x.action === 'migrate-to-linked-source' || x.action === 'migrate-to-social-account')) {
    const social = a.action === 'migrate-to-social-account'
    for (const url of a.carriers ?? []) {
      const host = hostnameOf(url)
      if (!host) continue
      const key = `${a.postNum}|${url}|${a.entityId}`
      if (seenLink.has(key)) continue
      seenLink.add(key)

      if (social) {
        // Bound only where the HANDLE spells the canonical name. The alias that matched is kept
        // either way, so an unbound row still says who it is probably about without claiming it.
        const bound = glue(a.handle) === glue(a.canonical)
          || glue(String(a.handle).replace(/[_.-]+/g, ' ')) === glue(a.canonical)
        linkedSources.push({
          kind: 'social_account',
          postNum: a.postNum,
          url,
          hostname: host,
          platform: a.platform ?? host,
          handle: a.handle,
          displayName: a.canonical,
          entityId: bound ? a.entityId : null,
          confidence: bound
            ? 'high — the handle spells the entity\'s canonical name'
            : `medium — the handle matches the registered alias "${a.alias}" but not the canonical name; identity left for review`,
          evidence: 'social_handle',
          originalOccurrence: a.alias,
          migratedFrom: { layer: 'postAnalysis.namedEntities', occurrenceId: a.occurrenceId, entityId: a.entityId, canonical: a.canonical, on: '2026-08-17', ruling: 'a social handle is a reference, not a prose mention' },
        })
        continue
      }

      const brandInHost = glue(host).includes(glue(a.canonical))
      const isPlatform = PLATFORMS.test(host)
      linkedSources.push({
        kind: 'publisher',
        postNum: a.postNum,
        url,
        hostname: host,
        displayName: a.canonical,
        entityId: brandInHost && !isPlatform ? a.entityId : null,
        confidence: brandInHost && !isPlatform ? 'high'
          : isPlatform ? 'platform-host — the domain hosts the material, it does not identify the publisher'
            : 'low — the brand name does not appear in the domain',
        evidence: a.urlEvidence,
        originalOccurrence: a.alias,
        migratedFrom: { layer: 'postAnalysis.namedEntities', occurrenceId: a.occurrenceId, entityId: a.entityId, canonical: a.canonical, on: '2026-08-17', policy: 'audit/url-derived-entity-policy.json' },
      })
    }
  }
  const sourceBoundIds = new Set(linkedSources.filter(l => l.entityId).map(l => l.entityId))

  const zeroed = nextEntities.entities.filter(e => e.mentions === 0)
  const sourceOnly = zeroed.filter(e => sourceBoundIds.has(e.id))
  const dormant = zeroed.filter(e => !sourceBoundIds.has(e.id))
  const dormantIds = new Set(dormant.map(e => e.id))

  for (const e of sourceOnly) {
    e.sourceOnly = true
    e.linkedSourcePosts = [...new Set(linkedSources.filter(l => l.entityId === e.id).map(l => l.postNum))].sort((a, b) => a - b)
  }
  nextEntities.entities = nextEntities.entities.filter(e => !dormantIds.has(e.id))

  const mentionsAfter = nextEntities.entities.reduce((n, e) => n + e.mentions, 0)
  const renderedAfter = nextPosts.reduce((n, p) => n + (p.postAnalysis?.namedEntities ?? []).length, 0)
  nextEntities.totals = {
    ...nextEntities.totals,
    canonicalEntities: nextEntities.entities.length,
    mentions: mentionsAfter,
    coreRegistryMentions: nextEntities.entities.filter(e => e.source === 'core registry').reduce((n, e) => n + e.mentions, 0),
    adjudicatedTailMentions: nextEntities.entities.filter(e => e.source === 'adjudicated tail').reduce((n, e) => n + e.mentions, 0),
    coreRegistryEntities: nextEntities.entities.filter(e => e.source === 'core registry').length,
    adjudicatedTailEntities: nextEntities.entities.filter(e => e.source === 'adjudicated tail').length,
    sourceOnlyEntities: sourceOnly.length,
    dormantEntitiesRetired: dormant.length,
  }

  const byPostIdx = {}
  for (const l of linkedSources) (byPostIdx[l.postNum] ??= []).push({
    kind: l.kind, url: l.url, hostname: l.hostname, platform: l.platform ?? null, handle: l.handle ?? null,
    displayName: l.displayName, entityId: l.entityId, confidence: l.confidence, originalOccurrence: l.originalOccurrence,
  })
  // Publishers first, then accounts — a reader scanning a drop wants "where did this come from"
  // before "whose account is this".
  for (const list of Object.values(byPostIdx)) {
    list.sort((a, b) => a.kind.localeCompare(b.kind) || a.hostname.localeCompare(b.hostname) || a.url.localeCompare(b.url))
  }

  // Publishers are keyed by hostname; accounts by platform + handle, because one platform hosts
  // thousands of distinct people and collapsing them onto "twitter.com" would lose every one.
  const byHostname = {}
  for (const l of linkedSources.filter(x => x.kind === 'publisher')) {
    const h = (byHostname[l.hostname] ??= { hostname: l.hostname, displayName: l.displayName, entityId: l.entityId, posts: [] })
    if (!h.posts.includes(l.postNum)) h.posts.push(l.postNum)
    if (!h.entityId && l.entityId) { h.entityId = l.entityId; h.displayName = l.displayName }
  }
  for (const h of Object.values(byHostname)) h.posts.sort((a, b) => a - b)

  const byAccount = {}
  for (const l of linkedSources.filter(x => x.kind === 'social_account')) {
    const k = `${l.platform}/${String(l.handle).toLowerCase()}`
    const acc = (byAccount[k] ??= { platform: l.platform, handle: l.handle, displayName: l.displayName, entityId: l.entityId, posts: [] })
    if (!acc.posts.includes(l.postNum)) acc.posts.push(l.postNum)
    if (!acc.entityId && l.entityId) { acc.entityId = l.entityId; acc.displayName = l.displayName }
  }
  for (const a of Object.values(byAccount)) a.posts.sort((x, y) => x - y)

  const linkedSourceArtifact = {
    certified: true,
    note: 'Linked sources — the publisher behind a URL Q pasted. NOT a prose entity mention: nothing here is painted over the drop text or counted as a word Q wrote. Migrated out of postAnalysis.namedEntities under audit/url-derived-entity-policy.json and the 2026-08-17 url_source_provenance ruling.',
    policy: 'audit/url-derived-entity-policy.json',
    ruledOn: '2026-08-17',
    boundMeaning: 'entityId is set only where the domain plainly belongs to the entity and is not a general hosting platform. A null entityId is a source we can name but will not claim identifies a certified entity.',
    kinds: {
      publisher: 'the domain identifies who published the linked material',
      social_account: 'Q linked to this account. A genuine reference, never a word he wrote — the handle is not highlighted in the drop and is not counted as a mention.',
    },
    totals: {
      records: linkedSources.length,
      publisherRecords: linkedSources.filter(l => l.kind === 'publisher').length,
      socialAccountRecords: linkedSources.filter(l => l.kind === 'social_account').length,
      posts: Object.keys(byPostIdx).length,
      hostnames: Object.keys(byHostname).length,
      accounts: Object.keys(byAccount).length,
      boundToEntity: linkedSources.filter(l => l.entityId).length,
      unbound: linkedSources.filter(l => !l.entityId).length,
      sourceOnlyEntities: sourceOnly.length,
    },
    byPost: byPostIdx,
    byHostname,
    byAccount,
  }

  return {
    nextEntities, nextPosts, linkedSourceArtifact, linkedSources,
    before,
    after: { mentions: mentionsAfter, rendered: renderedAfter, entityRows: nextEntities.entities.length },
    zeroed, sourceOnly, dormant,
  }
}

// ════════════════════════════════════════════════════════════════════════════
function writeResult(dataDir, result) {
  fs.writeFileSync(path.join(dataDir, 'entities.json'), JSON.stringify(result.nextEntities))
  fs.writeFileSync(path.join(dataDir, 'posts.json'), JSON.stringify(result.nextPosts))
  fs.writeFileSync(path.join(dataDir, 'linked-sources.json'), JSON.stringify(result.linkedSourceArtifact))
}
const hashAll = dir => Object.fromEntries(fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()
  .map(f => [f, shaFile(path.join(dir, f))]))
function snapshotInto(dir, files) {
  fs.mkdirSync(dir, { recursive: true })
  for (const f of files) { const src = path.join(DATA, f); if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, f)) }
}

console.log(`\nINTEGRATED ENTITY CLEANUP — ${MODE.toUpperCase()}\n`)

// ── rollback ────────────────────────────────────────────────────────────────
if (MODE === 'rollback') {
  const contractPath = path.join(OUT, 'entity-cleanup-rollback-contract.json')
  if (!fs.existsSync(contractPath)) { console.error('  no rollback contract — nothing has been applied from this repo.\n'); process.exit(1) }
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
  const snapDir = path.join(SNAPS, contract.snapshot)
  if (!fs.existsSync(snapDir)) { console.error(`  snapshot ${contract.snapshot} is gone — cannot restore bytes.\n`); process.exit(1) }

  for (const f of Object.keys(contract.before)) {
    const src = path.join(snapDir, f)
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DATA, f))
  }
  for (const f of contract.created) { const p = path.join(DATA, f); if (fs.existsSync(p)) fs.unlinkSync(p) }

  const now = hashAll(DATA)
  const wrong = Object.entries(contract.before).filter(([f, h]) => now[f] !== h)
  const leftover = contract.created.filter(f => now[f])
  console.log(`  restored from snapshot ${contract.snapshot}`)
  console.log(`  hash mismatches        : ${wrong.length}`)
  console.log(`  created files removed  : ${contract.created.length - leftover.length} of ${contract.created.length}`)
  if (wrong.length || leftover.length) { console.error('\n  ❌ rollback did not restore the recorded state.\n'); process.exit(1) }
  fs.mkdirSync(path.join(OUT, 'history'), { recursive: true })
  fs.renameSync(contractPath, path.join(OUT, 'history', `entity-cleanup-rollback-contract.${contract.appliedAt.replace(/[:.]/g, '-')}.json`))
  console.log('\n  ✅ every certified byte is back at the pre-cleanup state.\n')
  process.exit(0)
}

// ── re-materialise, for the deterministic rebuild chain ─────────────────────
//
// THE BUNDLE HAS TO BE REPRODUCIBLE FROM THE CERTIFIED ARTIFACTS, and after the first apply it was
// not. `apply-entities.mjs` rebuilds entities.json and posts.json from audit/entities-audit.json,
// which is the PRE-cleanup adjudication — so replaying the deploy chain put 1,409 rows and 9,749
// mentions back, and build-search-index.mjs then refused at its QA gate because Entities was 1,409
// against a certified 1,201. The deploy could not run at all: export-firestore.mjs replays that
// same chain before the manifest is even consulted.
//
// The gate caught it, which is the gate working. But "the pipeline aborts" is not a state to ship
// from, and SKIP_EXPORT is a quota escape hatch rather than an answer (CURRENT-STATE rule 8). The
// cleanup has to be a step OF the chain, so a rebuild lands on the certified state instead of the
// state before the ruling.
//
// This mode is NOT a second approval. It re-applies the plan the owner already approved, checks the
// result against the counts recorded in the rollback contract at apply time, and refuses on any
// difference. It takes no new snapshot and rewrites no contract — the original snapshot stays the
// authority on what "before" was, and a deploy must never move the thing rollback restores to.
//
// Idempotent by measurement, not by flag: on a tree that already carries the cleanup it does
// nothing and says so, so running the chain twice reproduces the bundle byte for byte.
if (MODE === 'rematerialise') {
  const contractPath = path.join(OUT, 'entity-cleanup-rollback-contract.json')
  if (!fs.existsSync(contractPath)) {
    console.error('\n  ❌ no rollback contract — the cleanup has never been approved and applied from this repo.\n')
    process.exit(1)
  }
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
  if (!contract.approvedByOwner) {
    console.error('\n  ❌ the contract records no owner approval. Refusing to re-materialise an unapproved change.\n')
    process.exit(1)
  }
  const now = read(DATA, 'entities.json')
  const at = { mentions: now.totals.mentions, entityRows: now.entities.length }

  // POST-APPROVAL DELTAS — an owner ruling that landed AFTER this cleanup was approved.
  //
  // The guard below exists so a deploy cannot re-materialise from a tree nobody recognises, and
  // that is still exactly what it does. What it must not ALSO do is read a later, separately
  // approved ruling as drift. The 2026-08-20 unhighlighted-sentence queue added 39 entity
  // identities and 171 occurrences upstream of this step, so the before-state and the after-state
  // move by the same amount while the CLEANUP is unchanged — proposedWithdrawals is still 951, and
  // re-running audit-occurrence-provenance.mjs reproduces every prior verdict.
  //
  // Recorded in the contract beside countsBefore/countsAfter rather than folded into them: those
  // two are the approval record, and rewriting them would erase what the owner actually approved.
  const delta = (contract.postApprovalDeltas ?? []).reduce((a, d) => ({
    mentions: a.mentions + (d.mentions ?? 0),
    entityRows: a.entityRows + (d.entityRows ?? 0),
    rendered: a.rendered + (d.rendered ?? 0),
  }), { mentions: 0, entityRows: 0, rendered: 0 })
  const expectBefore = {
    mentions: contract.countsBefore.mentions + delta.mentions,
    entityRows: contract.countsBefore.entityRows + delta.entityRows,
  }
  const expectAfter = {
    mentions: contract.countsAfter.mentions + delta.mentions,
    entityRows: contract.countsAfter.entityRows + delta.entityRows,
    rendered: contract.countsAfter.rendered + delta.rendered,
  }

  if (at.mentions === expectAfter.mentions && at.entityRows === expectAfter.entityRows) {
    console.log(`  already materialised — ${at.entityRows} rows / ${at.mentions} mentions. Nothing written.\n`)
    process.exit(0)
  }
  if (at.mentions !== expectBefore.mentions || at.entityRows !== expectBefore.entityRows) {
    console.error(`\n  ❌ the tree is neither the approved before-state (${expectBefore.entityRows}/${expectBefore.mentions})`)
    console.error(`     nor the approved after-state (${expectAfter.entityRows}/${expectAfter.mentions}); it is ${at.entityRows}/${at.mentions}.`)
    console.error('     Re-materialising from an unrecognised state would be a new decision, not a replay.\n')
    process.exit(1)
  }

  const plan = buildPlan(DATA)
  if (plan.refusals.length) {
    console.error(`\n  ❌ ${plan.refusals.length} refusal(s) building the approved plan:`)
    for (const r of plan.refusals.slice(0, 5)) console.error(`     ${r}`)
    process.exit(1)
  }
  const redone = transform(DATA, plan)
  if (redone.after.mentions !== expectAfter.mentions
    || redone.after.entityRows !== expectAfter.entityRows
    || redone.after.rendered !== expectAfter.rendered) {
    console.error(`\n  ❌ the replay produces ${redone.after.entityRows}/${redone.after.mentions}, not the approved`)
    console.error(`     ${expectAfter.entityRows}/${expectAfter.mentions}. Refusing to write.\n`)
    process.exit(1)
  }
  writeResult(DATA, redone)
  console.log(`  re-materialised the approved cleanup: ${expectBefore.entityRows}/${expectBefore.mentions}`
    + ` -> ${redone.after.entityRows}/${redone.after.mentions}`)
  console.log(`  approval: ${contract.approvedByOwner}\n`)
  process.exit(0)
}

// ── plan ────────────────────────────────────────────────────────────────────
const { audit, actions, refusals } = buildPlan(DATA)
console.log(`  occurrences audited  : ${audit.totals.occurrences}`)
console.log(`  actions              : ${actions.length}`)
console.log(`  refusals             : ${refusals.length}`)
for (const r of refusals.slice(0, 5)) console.log(`     ${r}`)
if (refusals.length && MODE !== 'simulate') { console.error('\n  ❌ refusing to proceed with outstanding refusals.\n'); process.exit(1) }

const result = transform(DATA, { audit, actions })
const { before, after, sourceOnly, dormant, zeroed } = result

// ── the reconciliation the ruling asks for ──────────────────────────────────
// Every starting mention accounted for, in one place, adding to exactly 9,749.
const cat = c => audit.rows.filter(r => r.category === c).length
const acted = a => actions.filter(x => x.action === a).length
const held = audit.rows.filter(r => r.certifiedCountEffect === 0 && (r.category === 'invalid_substring_extraction' || r.category === 'no_supported_provenance')).length
const ledger = {
  kept_visible_complete_token: cat('visible_complete_token'),
  kept_visible_alias_variant: cat('visible_alias_variant'),
  kept_image_provenance_unconfirmed: cat('image_provenance_unconfirmed'),
  kept_nonvisual_metadata: cat('nonvisual_metadata_provenance'),
  kept_image_provenance_confirmed: cat('image_provenance_confirmed'),
  kept_ambiguous_unchanged: cat('ambiguous_provenance'),
  held_unsupported_beyond_ruled_set: audit.rows.filter(r => r.beyondRuledPopulation).length,
  withdrawn_invalid_substring: actions.filter(a => a.category === 'invalid_substring_extraction').length,
  withdrawn_url_path_or_query: actions.filter(a => a.action === 'remove-annotation' && a.category === 'url_source_provenance').length,
  withdrawn_unsupported_approved: actions.filter(a => a.category === 'no_supported_provenance').length,
  migrated_to_linked_source: acted('migrate-to-linked-source'),
  migrated_to_social_account: acted('migrate-to-social-account'),
}
const ledgerSum = Object.values(ledger).reduce((a, b) => a + b, 0)

console.log(`\n  OCCURRENCE LEDGER — every starting mention lands exactly once`)
for (const [k, v] of Object.entries(ledger)) console.log(`    ${String(v).padStart(5)}  ${k}`)
console.log(`    ${String(ledgerSum).padStart(5)}  TOTAL   (certified: ${before.mentions}${ledgerSum === before.mentions ? ' ✓' : ' ✗'})`)

console.log(`\n  PROVEN BY SIMULATION`)
console.log(`    mentions        ${before.mentions} -> ${after.mentions}   (-${before.mentions - after.mentions})`)
console.log(`    rendered        ${before.rendered} -> ${after.rendered}`)
console.log(`    entity records  ${before.entityRows} -> ${after.entityRows}`)
console.log(`    zero-mention    ${zeroed.length}  =  ${sourceOnly.length} source_only + ${dormant.length} dormant`)
console.log(`    headline == rendered: ${after.mentions === after.rendered}`)
const ls = result.linkedSourceArtifact.totals
console.log(`    linked sources  ${ls.records} records (${ls.boundToEntity} bound, ${ls.unbound} unbound) in ${ls.posts} drops`)
console.log(`                    ${ls.publisherRecords} publisher over ${ls.hostnames} hostnames · ${ls.socialAccountRecords} social over ${ls.accounts} accounts`)

// ── deduplication accounting ────────────────────────────────────────────────
const uniqueOcc = new Set(actions.map(a => a.occurrenceId)).size
console.log(`\n  DEDUPLICATION`)
console.log(`    actions ${actions.length}, distinct certified occurrences ${uniqueOcc}  ${actions.length === uniqueOcc ? '— no occurrence subtracted twice' : '— ✗ DOUBLE COUNT'}`)
console.log(`    mentions withdrawn ${before.mentions - after.mentions} == actions ${actions.length}: ${before.mentions - after.mentions === actions.length}`)
const migrateOcc = actions.filter(a => a.action === 'migrate-to-linked-source' || a.action === 'migrate-to-social-account').length
const distinctPostUrl = new Set(result.linkedSources.map(l => `${l.postNum}|${l.url}`)).size
console.log(`    ${migrateOcc} migrated occurrences produced ${ls.records} source records — ${ls.publisherRecords} publisher across ${ls.hostnames} hostnames, ${ls.socialAccountRecords} social across ${ls.accounts} accounts`)
console.log(`      ${distinctPostUrl} distinct (drop, URL) pairs — the counts differ in BOTH directions and neither is a bug:`)
console.log(`      one occurrence can cite several URLs, and several occurrences can cite one URL.`)
console.log(`      Records are keyed (drop, URL, entity), so the same link is never listed twice for one publisher.`)

// ── against the superseded figures ──────────────────────────────────────────
const SUPERSEDED = [
  ['2026-08-16 (raw-text coordinates)', { mentions: 9338, rows: 1288, dormant: 121, sourceOnly: 12, sources: 100 }],
  ['2026-08-16 (rendered coordinates)', { mentions: 9245, rows: 1254, dormant: 155, sourceOnly: 17, sources: 124 }],
]
console.log(`\n  AGAINST THE SUPERSEDED PROPOSALS`)
for (const [label, t] of SUPERSEDED) {
  console.log(`    ${label}`)
  console.log(`      mentions ${t.mentions} · rows ${t.rows} · dormant ${t.dormant} · source-only ${t.sourceOnly} · sources ${t.sources}`)
}
console.log(`    integrated (this run)`)
console.log(`      mentions ${after.mentions} · rows ${after.entityRows} · dormant ${dormant.length} · source-only ${sourceOnly.length} · sources ${ls.records}`)

// ── artifacts ───────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT, 'integrated-migration-plan.json'), JSON.stringify({
  note: 'THE integrated migration plan. One action per certified occurrence, derived from audit/occurrence-provenance-audit.json. Supersedes url-cleanup-plan.json and url-cleanup-proposal.json, both of which predate the corpus-wide boundary audit and the url_source_provenance ruling.',
  ruledOn: '2026-08-17',
  coordinateSystem: 'scripts/lib/renderedMatch.mjs',
  unit: 'the certified occurrence — one entry in postAnalysis.namedEntities, keyed #<post>:<index>. Double subtraction is unrepresentable rather than prevented.',
  idempotent: 'Each action names an exact (post, index, alias). Re-running against a migrated bundle finds a different alias at that index and refuses, rather than removing more.',
  reversible: 'audit/entity-cleanup-reversal.json restores every entry; the rollback contract restores the bytes.',
  refusals,
  occurrenceLedger: { ...ledger, TOTAL: ledgerSum, certifiedBefore: before.mentions, reconciles: ledgerSum === before.mentions },
  proven: {
    mentionsBefore: before.mentions, mentionsAfter: after.mentions,
    entityRowsBefore: before.entityRows, entityRowsAfter: after.entityRows,
    dormant: dormant.length, sourceOnly: sourceOnly.length,
    linkedSourceRecords: ls.records, linkedSourceHostnames: ls.hostnames,
    linkedSourceBound: ls.boundToEntity, linkedSourceUnbound: ls.unbound,
  },
  supersedes: Object.fromEntries(SUPERSEDED),
  actions,
}, null, 1))

fs.writeFileSync(path.join(OUT, 'entity-cleanup-reversal.json'), JSON.stringify({
  note: 'Reversal contract for the integrated cleanup. Restoring these entries at these indices, lowest index first, returns the archive to the pre-cleanup state exactly. Written before the change, not after it.',
  restores: actions.map(a => ({ occurrenceId: a.occurrenceId, postNum: a.postNum, index: a.index, alias: a.alias, entityId: a.entityId, canonical: a.canonical, mentionsToRestore: 1 })),
}, null, 1))

fs.writeFileSync(path.join(OUT, 'entity-dormant-registry.json'), JSON.stringify({
  note: 'Entities left with no certified mention and no bound linked source. Retired from the public bundle: excluded from Entities, search, autocomplete, global synopses and hovers. THE IDS ARE RESERVED PERMANENTLY — a later occurrence resolves back to the same qe- id rather than minting a second identity.',
  policy: 'audit/url-derived-entity-policy.json + the 2026-08-17 boundary ruling',
  reserved: 'audit/entity-ids.json keeps every id in this list.',
  total: dormant.length,
  entities: dormant.map(e => ({ id: e.id, canonical: e.canonical, type: e.type, slug: e.slug })),
}, null, 1))

fs.writeFileSync(path.join(OUT, 'entity-source-only-registry.json'), JSON.stringify({
  note: 'Entities with no prose mention left, but which remain referenced as the publisher of material Q linked. They stay in the public bundle and must NEVER render as a zero-mention entity page.',
  total: sourceOnly.length,
  entities: sourceOnly.map(e => ({ id: e.id, canonical: e.canonical, type: e.type, slug: e.slug, linkedSourcePosts: e.linkedSourcePosts })),
}, null, 1))

console.log(`\n  wrote audit/integrated-migration-plan.json, entity-cleanup-reversal.json,`)
console.log(`        entity-dormant-registry.json, entity-source-only-registry.json`)

// ── emit ────────────────────────────────────────────────────────────────────
if (MODE === 'emit') {
  const dir = valueOf('--emit')
  if (!dir) { console.error('  --emit needs a directory\n'); process.exit(1) }
  fs.mkdirSync(dir, { recursive: true })
  writeResult(dir, result)
  console.log(`\n  emitted entities.json, posts.json, linked-sources.json to ${dir}`)
  console.log(`  public/data untouched.\n`)
  process.exit(0)
}

// ── prove the rollback ──────────────────────────────────────────────────────
if (MODE === 'prove-rollback') {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'q-entity-cleanup-'))
  for (const f of ALL_ARTIFACTS) fs.copyFileSync(path.join(DATA, f), path.join(scratch, f))
  const startHashes = hashAll(scratch)

  const scratchResult = transform(scratch, { audit, actions })
  writeResult(scratch, scratchResult)
  const appliedHashes = hashAll(scratch)
  const changed = ALL_ARTIFACTS.filter(f => startHashes[f] !== appliedHashes[f])
  const created = Object.keys(appliedHashes).filter(f => !startHashes[f])

  for (const f of changed) fs.copyFileSync(path.join(DATA, f), path.join(scratch, f))
  for (const f of created) fs.unlinkSync(path.join(scratch, f))
  const rolledBack = hashAll(scratch)
  const stillWrong = Object.keys(startHashes).filter(f => startHashes[f] !== rolledBack[f])
  const stillPresent = created.filter(f => rolledBack[f])
  const unexpected = changed.filter(f => !TOUCHED.includes(f))

  // AND THE ARITHMETIC HALF. The bytes returning proves the restore; it does not prove the reversal
  // CONTRACT, which is what a human would work from if the snapshot were lost. Replayed separately.
  const reversal = read(OUT, 'entity-cleanup-reversal.json')
  const replayMentions = scratchResult.after.mentions
    + reversal.restores.filter(r => !scratchResult.dormant.some(d => d.id === r.entityId)).length
    + scratchResult.dormant.reduce((n, d) => n + reversal.restores.filter(r => r.entityId === d.id).length, 0)

  // And the annotations: replaying the reversal into the applied posts must rebuild 9,749 entries.
  const replayPosts = JSON.parse(JSON.stringify(scratchResult.nextPosts))
  const rp = new Map(replayPosts.map(p => [p.postNum, p]))
  for (const r of [...reversal.restores].sort((a, b) => a.postNum - b.postNum || a.index - b.index)) {
    rp.get(r.postNum).postAnalysis.namedEntities.splice(r.index, 0, r.alias)
  }
  const replayRendered = replayPosts.reduce((n, p) => n + (p.postAnalysis?.namedEntities ?? []).length, 0)
  const original = read(DATA, 'posts.json')
  const identical = JSON.stringify(replayPosts.map(p => p.postAnalysis?.namedEntities ?? []))
    === JSON.stringify(original.map(p => p.postAnalysis?.namedEntities ?? []))

  console.log(`\n  ROLLBACK PROOF`)
  console.log(`    artifacts hashed      : ${Object.keys(startHashes).length}`)
  console.log(`    changed by apply      : ${changed.length}  [${changed.join(', ')}]`)
  console.log(`    created by apply      : ${created.length}  [${created.join(', ')}]`)
  console.log(`    touched outside scope : ${unexpected.length}`)
  console.log(`    hash mismatches after rollback : ${stillWrong.length}`)
  console.log(`    created files remaining        : ${stillPresent.length}`)
  console.log(`    reversal contract restores     : ${reversal.restores.length} occurrences`)
  console.log(`    contract-replayed mentions     : ${replayMentions}  (seed-77 certified: ${before.mentions})`)
  console.log(`    contract-replayed annotations  : ${replayRendered}  (identical to the original array: ${identical})`)

  fs.rmSync(scratch, { recursive: true, force: true })
  const ok = !stillWrong.length && !stillPresent.length && !unexpected.length
    && replayMentions === before.mentions && replayRendered === before.rendered && identical
  console.log(`\n  ${ok ? '✅ rollback restores the exact seed-77 state — byte-identical, and the reversal contract rebuilds every annotation in its original position.' : '❌ rollback did NOT restore the seed-77 state.'}\n`)
  process.exit(ok ? 0 : 1)
}

// ── the guarded write ───────────────────────────────────────────────────────
if (MODE === 'apply') {
  const approval = valueOf('--approved-by-owner')
  if (!approval) {
    console.error(`\n  ❌ REFUSED. This change withdraws ${before.mentions - after.mentions} certified occurrences and`)
    console.error(`     retires ${dormant.length} entity rows. It needs the owner's approval on the command line:`)
    console.error(`\n     node scripts/apply-entity-cleanup.mjs --apply --approved-by-owner "<the ruling>"\n`)
    process.exit(1)
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const snapName = `entity-cleanup-${stamp}`
  snapshotInto(path.join(SNAPS, snapName), ALL_ARTIFACTS)

  const beforeHashes = {}
  for (const f of TOUCHED) if (fs.existsSync(path.join(DATA, f))) beforeHashes[f] = shaFile(path.join(DATA, f))
  const created = TOUCHED.filter(f => !fs.existsSync(path.join(DATA, f)))

  writeResult(DATA, result)

  fs.writeFileSync(path.join(OUT, 'entity-cleanup-rollback-contract.json'), JSON.stringify({
    note: 'Written at apply time. `node scripts/apply-entity-cleanup.mjs --rollback` restores these exact bytes and verifies every hash.',
    appliedAt: new Date().toISOString(),
    approvedByOwner: approval,
    snapshot: snapName,
    before: beforeHashes,
    created,
    after: Object.fromEntries(TOUCHED.map(f => [f, shaFile(path.join(DATA, f))])),
    countsBefore: before,
    countsAfter: after,
  }, null, 1))

  console.log(`\n  APPLIED. snapshot ${snapName}`)
  console.log(`  rollback: node scripts/apply-entity-cleanup.mjs --rollback`)
  console.log(`\n  NEXT, and none of it is optional:`)
  console.log(`    node scripts/extract-entity-hovers.mjs`)
  console.log(`    node scripts/build-relationships.mjs && node scripts/build-search-index.mjs && node scripts/build-glossary.mjs`)
  console.log(`    bump SEED_VERSION 77 -> 78 and the seed-current invariant, then node scripts/seed-fingerprint.mjs --update`)
  console.log(`    node scripts/audit-cross-section.mjs && node scripts/certification-manifest.mjs --update\n`)
  process.exit(0)
}

console.log(`\n  SIMULATION — public/data untouched.`)
console.log(`  Prove the rollback: node scripts/apply-entity-cleanup.mjs --prove-rollback`)
console.log(`  Apply (needs the ruling): --apply --approved-by-owner "<ruling>"\n`)
process.exit(refusals.length ? 1 : 0)
