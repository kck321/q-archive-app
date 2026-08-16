// One-time backfill of audit/resolution-first-seen.json from git history.
//
// Every queue row now shows the date it entered the Resolution Center, so a reader can tell a
// question raised this morning from one that has been open since the section was certified. The
// rows that were already queued predate the ledger, and stamping them all with today's date would
// be a lie that is impossible to detect later — so their dates are RECOVERED: for each row id,
// the earliest commit whose version of public/data/resolution-queue.json contained it.
//
// Run once. After this the ledger maintains itself inside build-resolution-queue.mjs.
//
//   node scripts/backfill-resolution-first-seen.mjs
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const QUEUE = 'public/data/resolution-queue.json'
const LEDGER = path.join(ROOT, 'audit', 'resolution-first-seen.json')

const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 5e8 }).toString()

// Oldest first, so the first commit to mention an id is the one that wins.
const commits = git('log', '--format=%H %ad', '--date=short', '--reverse', '--', QUEUE)
  .trim().split('\n').filter(Boolean).map(l => { const [sha, date] = l.split(' '); return { sha, date } })

console.log(`\nBACKFILL RESOLUTION FIRST-SEEN\n\n  ${commits.length} commits touch ${QUEUE}\n`)

const firstSeen = {}
for (const { sha, date } of commits) {
  let rows
  try {
    rows = JSON.parse(git('show', `${sha}:${QUEUE}`)).rows ?? []
  } catch { console.log(`  ${date} ${sha.slice(0, 7)}  unreadable, skipped`); continue }
  let added = 0
  for (const r of rows) if (r.id && !(r.id in firstSeen)) { firstSeen[r.id] = date; added++ }
  console.log(`  ${date} ${sha.slice(0, 7)}  ${String(rows.length).padStart(5)} rows, ${added} first seen here`)
}

// The working tree may hold rows not yet committed — they are entering the queue today.
const today = git('log', '-1', '--format=%ad', '--date=short').trim()
const current = JSON.parse(fs.readFileSync(path.join(ROOT, QUEUE), 'utf8')).rows ?? []
let uncommitted = 0
for (const r of current) if (r.id && !(r.id in firstSeen)) { firstSeen[r.id] = today; uncommitted++ }
if (uncommitted) console.log(`  ${today} (working tree)  ${uncommitted} first seen here`)

// Rows that have LEFT the queue keep their entry. A row can be owner-resolved and later re-opened,
// and re-stamping it with the reopen date would erase how long the question has actually been out.
const byDate = {}
for (const d of Object.values(firstSeen)) byDate[d] = (byDate[d] ?? 0) + 1

fs.writeFileSync(LEDGER, JSON.stringify({
  note: 'When each Resolution Center row first appeared in the queue. Written once by scripts/backfill-resolution-first-seen.mjs from git history, and maintained thereafter by build-resolution-queue.mjs, which stamps any id it has not seen before. Ids are never re-stamped: a row that is resolved and later re-opened keeps its original date, because the question is as old as it is.',
  backfilledFrom: `git history of ${QUEUE}`,
  totalIds: Object.keys(firstSeen).length,
  byDate,
  firstSeen,
}, null, 1))

console.log(`\n  ${Object.keys(firstSeen).length} ids dated`)
for (const [d, n] of Object.entries(byDate).sort()) console.log(`    ${d}  ${n}`)
console.log(`\n  wrote audit/resolution-first-seen.json\n`)
