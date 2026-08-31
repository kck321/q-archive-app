// A REVIEW LIST MAY NOT VETO A RELEASE, AND MAY NOT GO STALE EITHER.
//
// backfill-analysis.mjs offers questions its hole-detector found; one the registry does not know
// gets no identity and no row, and is recorded in audit/question-identity-proposals.jsonl instead.
// Two things have to stay true about that file. It must never dirty the working tree — preflight
// reads `git status --porcelain`, which counts untracked files, so an unignored review list turns
// the first honest export into a deploy that refuses to publish. And it must be rebuilt from
// nothing every run: a run that proposes none must DELETE it, or a stale list of questions nobody
// is proposing any more sits there looking like work.
//
// Gate 2's live exports recorded 54 proposals. Deploys had been going out under SKIP_EXPORT — the
// rebuild path, which proposes none — which is why the file had never been seen.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PROPOSALS_RELPATH, REGISTRY_RELPATH, createResolver } from './lib/questionIdentity.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const results = []
let pass = 0, fail = 0
const check = (label, ok, detail = '') => { results.push([label, ok, detail]); ok ? pass++ : fail++ }
const git = args => { try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim() } catch { return null } }

// ── the file can never dirty the tree, so it can never refuse a deploy ──────────────────────────
check('the review list is gitignored', git(['check-ignore', PROPOSALS_RELPATH]) !== null,
  PROPOSALS_RELPATH)
check('the review list is not a tracked artifact', git(['ls-files', PROPOSALS_RELPATH]) === '')
check('preflight still judges the tree by git status --porcelain, which counts untracked files',
  /git status --porcelain/.test(fs.readFileSync(path.join(ROOT, 'scripts/preflight-deploy.mjs'), 'utf8')))

// ── the writer's own contract: written when there is something, deleted when there is not ───────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qdrops-proposals-'))
try {
  fs.mkdirSync(path.join(tmp, path.dirname(REGISTRY_RELPATH)), { recursive: true })
  fs.copyFileSync(path.join(ROOT, REGISTRY_RELPATH), path.join(tmp, REGISTRY_RELPATH))
  const file = path.join(tmp, PROPOSALS_RELPATH)

  // a run that proposes nothing removes a list an earlier run left
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '{"stale":"from an earlier run"}\n')
  createResolver(tmp, { step: 'test-proposals-artifact' }).writeProposals()
  check('a run that proposes nothing deletes the list an earlier run left', !fs.existsSync(file))

  // a run that proposes something writes one JSON line per proposal
  const r = createResolver(tmp, { step: 'test-proposals-artifact' })
  const unknown = [
    { postId: '999999', postNum: 999999, text: 'A wording no registry has ever issued, one.' },
    { postId: '999999', postNum: 999999, text: 'A wording no registry has ever issued, two.' },
  ]
  const ids = unknown.map(u => r.resolveProposal({ ...u, site: 'test' }))
  check('an unregistered proposal is given no identity at all', ids.every(id => id === null),
    JSON.stringify(ids))
  r.writeProposals()
  check('the proposals are recorded for review', fs.existsSync(file))
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n') : []
  check('one JSON line per proposal', lines.length === unknown.length, `${lines.length} line(s)`)
  const parsed = lines.map(l => { try { return JSON.parse(l) } catch { return null } })
  check('every recorded line is parseable JSON naming the step', parsed.every(p => p && p.step === 'test-proposals-artifact'))
  check('the record says the row was not written', parsed.every(p => p && /not written/.test(p.disposition ?? '')))
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}

// ── and the run has to SAY so, rather than leave the file to speak for itself ────────────────────
const backfill = fs.readFileSync(path.join(ROOT, 'scripts/backfill-analysis.mjs'), 'utf8')
check('the run reports what it declined to write', /were NOT written to questions\.json/.test(backfill))
check('the run names where it recorded them', /question-identity-proposals\.jsonl|PROPOSALS_RELPATH/.test(backfill))

console.log('\nPROPOSALS REVIEW ARTIFACT\n')
for (const [label, ok, detail] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(64)}${detail ? `  — ${detail}` : ''}`)
console.log(`\n  ${pass} passed, ${fail} failed`)
if (fail) { console.error('\n[X] the proposals review list can go stale, or can refuse a deploy.\n'); process.exit(1) }
console.log('')
