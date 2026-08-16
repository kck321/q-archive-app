// DIRECTIVES-ONLY MIGRATION to the v5 final adjudication.
//
// This is the ONE script in the project that opts a consumer into sourceSpansV2(). It does so for
// Q Directives and nothing else: the other 14 consumers keep importing sourceLines() from
// scripts/lib/quotedBlocks.mjs, which this migration does not touch, and neither does
// scripts/audit-cross-section.mjs.
//
//   node scripts/migrate-directives-v5.mjs            dry run — writes the diff, changes nothing
//   node scripts/migrate-directives-v5.mjs --apply    snapshots, then writes posts.json
//
// What "remove" means here: the occurrence leaves `post.actionRequests`, and nothing else. Q's
// post text, Religion & Spirituality assignments, questions, claims, predictions, quoted-source
// evidence, attached-image evidence and the audit history are all untouched.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceSpansV2 } from './lib/sourceSpansV2.mjs'      // <- Directives opts in, alone

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit/source-spans-v2')
const APPLY = process.argv.includes('--apply')
const rd = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

const posts = rd('public/data/posts.json')
const v5 = rd('audit/source-spans-v2/directives-adjudication-v5-final.json')
const byId = new Map(v5.rows.map(r => [r.stableOccurrenceId, r]))

const esc = s => `"${String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
const csv = (cols, rows) => [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
const norm = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

const KEEP = new Set(['KEEP_Q_DIRECTIVE', 'KEEP_DIRECTIVE_AND_RELIGIOUS_THEME', 'SPLIT_MIXED_SENTENCE'])

// ── refuse to run against a moved baseline ───────────────────────────────────
{
  let mapped = 0
  for (const p of posts) (p.actionRequests ?? []).forEach((a, i) => {
    const r = byId.get(`${p.postNum}#${i}`)
    if (r && norm(a) === norm(r.storedPhrase)) mapped++
  })
  if (mapped !== v5.rows.length) {
    console.error(`ABORT: ${mapped} of ${v5.rows.length} stable occurrence IDs map to the current posts.json.`)
    console.error('The canonical Directive inputs changed since v5 was adjudicated. Re-run the adjudication first.')
    process.exit(1)
  }
  console.log(`stable-ID check: ${mapped}/${v5.rows.length} map cleanly`)
}

// ── build the plan ───────────────────────────────────────────────────────────
const plan = []
for (const p of posts) {
  const reqs = p.actionRequests ?? []
  reqs.forEach((a, i) => {
    const id = `${p.postNum}#${i}`
    const r = byId.get(id)
    if (!r) return
    const keep = KEEP.has(r.ruling)
    const expanded = r.sentenceExpanded === 'true' && keep
    const split = r.ruling === 'SPLIT_MIXED_SENTENCE'
    plan.push({
      stableOccurrenceId: id, postNum: p.postNum,
      oldRuling: r.v4Ruling, finalRuling: r.ruling,
      oldSentenceText: norm(a),
      newFullSentenceText: keep ? r.fullSentence : '',
      directivePhrase: r.directivePhrase,
      directiveSegments: r.directiveSegments,
      religiousSegment: r.religiousSegment,
      themes: r.themes,
      authorshipState: r.authorshipState,
      sourceType: r.sourceType,
      dataAction: !keep ? 'REMOVE_FROM_DIRECTIVES'
        : split ? 'KEEP_AND_SPLIT_SEGMENTS'
        : expanded ? 'KEEP_AND_EXPAND_TO_FULL_SENTENCE'
        : 'KEEP',
      reason: r.reason,
    })
  })
}

const actions = {}
for (const q of plan) actions[q.dataAction] = (actions[q.dataAction] ?? 0) + 1
console.log('\nMIGRATION PLAN')
for (const [k, v] of Object.entries(actions).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`)

const migCols = ['stableOccurrenceId', 'postNum', 'oldRuling', 'finalRuling', 'oldSentenceText', 'newFullSentenceText',
  'directivePhrase', 'directiveSegments', 'religiousSegment', 'themes', 'authorshipState', 'sourceType', 'dataAction', 'reason']
fs.writeFileSync(path.join(OUT, 'directives-migration-diff-final.csv'), csv(migCols, plan))
fs.writeFileSync(path.join(OUT, 'directives-migration-diff-final.json'), JSON.stringify({ final: true, actions, plan }, null, 1))

// ── apply ────────────────────────────────────────────────────────────────────
if (!APPLY) {
  console.log('\nDRY RUN — nothing written to public/data. Re-run with --apply.')
  console.log('wrote audit/source-spans-v2/directives-migration-diff-final.{csv,json}')
  process.exit(0)
}

// snapshot first; restore is never the destructive step
const stamp = v5.rows.length + '-' + plan.filter(q => q.dataAction === 'REMOVE_FROM_DIRECTIVES').length
const backupDir = path.join(ROOT, 'audit/backups')
fs.mkdirSync(backupDir, { recursive: true })
const backup = path.join(backupDir, `posts.pre-directives-v5.${stamp}.json`)
if (!fs.existsSync(backup)) fs.copyFileSync(path.join(ROOT, 'public/data/posts.json'), backup)
console.log(`\nbackup: ${path.relative(ROOT, backup)}`)

let removed = 0, expandedN = 0, metaWritten = 0, postsEmptied = 0
for (const p of posts) {
  const reqs = p.actionRequests ?? []
  if (!reqs.length) continue
  const next = []
  const meta = {}
  reqs.forEach((a, i) => {
    const r = byId.get(`${p.postNum}#${i}`)
    if (!r) { next.push(a); return }
    if (!KEEP.has(r.ruling)) { removed++; return }
    const text = r.sentenceExpanded === 'true' ? r.fullSentence : a
    if (r.sentenceExpanded === 'true') expandedN++
    next.push(text)
    // Segment metadata lives beside the displayed sentence, never in place of it.
    const key = norm(text).toLowerCase()
    meta[key] = {
      stableOccurrenceId: r.stableOccurrenceId,
      directiveSegments: r.directiveSegments,
      ...(r.religiousSegment ? { religiousSegment: r.religiousSegment } : {}),
      ...(r.themes ? { themes: r.themes.split('|') } : {}),
      authorshipState: r.authorshipState,
      sourceType: r.sourceType,
      ...(r.alsoQuotedInPayload === 'true' ? { alsoQuotedInPayload: true } : {}),
      ...(r.referencedPostNum ? { referencedPostNum: Number(r.referencedPostNum) } : {}),
      ...(r.fragmentRepaired === 'true' ? { fragmentRepaired: true } : {}),
    }
    metaWritten++
  })
  p.actionRequests = next
  if (!next.length) { p.hasRequests = false; postsEmptied++; delete p.directiveMeta }
  else { p.hasRequests = true; p.directiveMeta = meta }
}

fs.writeFileSync(path.join(ROOT, 'public/data/posts.json'), JSON.stringify(posts, null, 1))

console.log(`\nAPPLIED`)
console.log(`  occurrences removed from Directives : ${removed}`)
console.log(`  display spans expanded to sentence  : ${expandedN}`)
console.log(`  directiveMeta entries written       : ${metaWritten}`)
console.log(`  posts left with no Directives       : ${postsEmptied}`)
console.log(`  remaining raw occurrences           : ${posts.reduce((n, p) => n + (p.actionRequests?.length ?? 0), 0)}`)
console.log('\nsourceLines() and its 14 other consumers are untouched.')
