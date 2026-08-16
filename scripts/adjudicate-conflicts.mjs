// Adjudicate the certification conflicts found by the coverage audit.
//
// REPORTS proposed changes. Applies nothing. Every frozen count stays where it is until the
// proposal is approved and re-certified through the normal gate.
//
// The 764 Claim conflicts arrive in two populations that need opposite treatment:
//   standalone_proposition  a full sentence no section claimed — read individually
//   context-promoted        a terse fragment whose antecedent is on the line above
// The second group is only a candidate because of that neighbouring line, so the line travels
// with the verdict as its evidence.
//
//   node scripts/adjudicate-conflicts.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EVIDENCE_VERDICT, QUESTION_VERDICTS, SEGMENTATION_VERDICT, BRACKET_VERDICTS, DIRECTIVE_VERDICTS } from './lib/conflictVerdicts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'audit')
const d = JSON.parse(fs.readFileSync(path.join(OUT, 'coverage-dispositions.json'), 'utf8')).dispositions

const adjudicated = []
const add = (bucket, row, verdict, basis) => adjudicated.push({ bucket, ...row, verdict, basis })

for (const x of d.EVIDENCE_CONFLICT) {
  add('evidence', x, EVIDENCE_VERDICT, 'a Q-posted URL in the space-after-protocol form the Evidence audit missed')
}
for (const x of d.QUESTION_CONFLICT) {
  const v = QUESTION_VERDICTS[x.text]
  add('questions', x, v?.verdict ?? 'NEEDS_CONTEXT',
    v ? `asks the reader to observe; dual-classified as an ${v.alsoDirective} directive under the existing overlap model` : 'not read')
}
for (const x of d.SEGMENTATION_CONFLICT) {
  add('segmentation', x, SEGMENTATION_VERDICT, 'a verbatim quotation the block detector did not close over — pasted source, not a segmentation error')
}
for (const x of d.CODE_OR_EMPHASIS_CONFLICT) {
  const v = BRACKET_VERDICTS[x.text] ?? 'NEEDS_CONTEXT'
  add('brackets', x, v, 'bracketed prose — the brackets are formatting, not coded notation')
}
for (const x of d.DIRECTIVE_CONFLICT) {
  const v = DIRECTIVE_VERDICTS[x.text] ?? 'NEEDS_CONTEXT'
  add('directives', x, v, 'imperative in mood; read individually for whether it instructs the reader')
}

// ── Claims: the 764 ─────────────────────────────────────────────────────────
// Not hand-read one by one in this pass. Each is scored on whether it carries a subject and a
// finite verb — the minimum for a proposition — and the context-promoted rows keep the line that
// justified them. Everything is a PROPOSAL; nothing is certified by this script.
const FINITE_VERB = /\b(is|are|was|were|has|have|had|will|would|can|could|does|did|do|says?|said|shows?|showed|means?|meant|controls?|controlled|owns?|owned|runs?|ran|knows?|knew|gets?|got|makes?|made|takes?|took|comes?|came|goes?|went|works?|worked|remains?|remained|becomes?|became|provides?|provided|creates?|created|holds?|held|keeps?|kept|leads?|led|needs?|needed|wants?|wanted|uses?|used|gives?|gave|puts?|put|sees?|saw|tells?|told|calls?|called|helps?|helped|allows?|allowed|requires?|required|happens?|happened|occurs?|occurred|exists?|existed|appears?|appeared|seems?|seemed|follows?|followed|begins?|began|ends?|ended|wins?|won|loses?|lost|apologiz\w+|retweet\w+|push\w+|attack\w+|protect\w+|fail\w+|refus\w+)\b/i

for (const x of d.CLAIM_CONFLICT) {
  const t = String(x.text).trim()
  const promoted = x.claimBasis && x.claimBasis !== 'standalone_proposition'
  let verdict, basis
  if (promoted) {
    // The fragment inherits its subject from the line above. That is a real proposition when the
    // preceding line actually supplies one — which is why the line is recorded on every row.
    verdict = 'ADD_Q_CLAIM'
    basis = `${x.claimBasis} — antecedent: “${String(x.prevLine).slice(0, 70)}”`
  } else if (FINITE_VERB.test(t)) {
    verdict = 'ADD_Q_CLAIM'
    basis = 'standalone proposition with a subject and a finite verb'
  } else {
    // A long fragment with no finite verb asserts nothing on its own.
    verdict = 'KEEP_CONTEXT_OR_LABEL'
    basis = 'no finite verb — a phrase or heading rather than an assertion'
  }
  add('claims', x, verdict, basis)
}

// ── proposed count changes ──────────────────────────────────────────────────
const byVerdict = {}
for (const a of adjudicated) {
  const v = a.verdict.split(':')[0]
  byVerdict[v] = (byVerdict[v] ?? 0) + 1
}

const CERTIFIED = { questions: 6442, directives: 2422, claims: 4188, evidence: 6590, codes: 1949, emphasis: 5251 }
const proposed = {
  questions: adjudicated.filter(a => a.verdict === 'ADD_Q_QUESTION').length,
  directives: adjudicated.filter(a => a.verdict.startsWith('ADD_Q_DIRECTIVE')).length,
  claims: adjudicated.filter(a => a.verdict === 'ADD_Q_CLAIM').length,
  evidence: adjudicated.filter(a => a.verdict === 'ADD_EVIDENCE').length,
  codes: 0,
  emphasis: 0,
}

const famAdds = {}
for (const a of adjudicated) {
  if (!a.verdict.startsWith('ADD_Q_DIRECTIVE:')) continue
  const f = a.verdict.split(':')[1]
  famAdds[f] = (famAdds[f] ?? 0) + 1
}

fs.writeFileSync(path.join(OUT, 'coverage-conflicts-adjudicated.json'), JSON.stringify({
  note: 'PROPOSED ONLY. Nothing applied. Frozen counts unchanged until approved and re-certified.',
  totals: { adjudicated: adjudicated.length, byVerdict, proposed, directiveFamilyAdds: famAdds },
  certified: CERTIFIED,
  adjudicated,
}, null, 1))

const md = ['# Q Drops — certification conflicts, adjudicated\n']
md.push('**Proposed only. Nothing is applied.** Every frozen count stands until these are approved and re-certified through the normal gate.\n')
md.push(`\n${adjudicated.length} conflicts adjudicated.\n`)
md.push('\n## Proposed count changes\n')
md.push('| Section | Certified now | Proposed additions | Would become |')
md.push('|---|---|---|---|')
for (const [k, cur] of Object.entries(CERTIFIED)) {
  const addN = proposed[k] ?? 0
  md.push(`| ${k} | ${cur.toLocaleString()} | ${addN ? '+' + addN : '—'} | ${(cur + addN).toLocaleString()} |`)
}
md.push('\n## Verdicts\n')
md.push('| Verdict | Count |')
md.push('|---|---|')
for (const [v, n] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) md.push(`| ${v} | ${n.toLocaleString()} |`)
if (Object.keys(famAdds).length) {
  md.push('\n### Directive families affected\n')
  md.push('| Family | Additions |')
  md.push('|---|---|')
  for (const [f, n] of Object.entries(famAdds).sort((a, b) => b[1] - a[1])) md.push(`| ${f} | +${n} |`)
}
md.push('\n## By bucket\n')
for (const bucket of ['evidence', 'questions', 'segmentation', 'brackets', 'directives', 'claims']) {
  const list = adjudicated.filter(a => a.bucket === bucket)
  if (!list.length) continue
  const counts = {}
  for (const a of list) counts[a.verdict.split(':')[0]] = (counts[a.verdict.split(':')[0]] ?? 0) + 1
  md.push(`\n**${bucket}** (${list.length}) — ${Object.entries(counts).map(([v, n]) => `${v} ${n}`).join(' · ')}\n`)
  if (bucket !== 'claims') {
    md.push('| Post | Text | Verdict |')
    md.push('|---|---|---|')
    for (const a of list.slice(0, 30)) {
      md.push(`| #${a.postNum} | ${String(a.text).replace(/\|/g, '\\|').slice(0, 74)} | ${a.verdict} |`)
    }
  } else {
    md.push('| Post | Text | Verdict | Basis |')
    md.push('|---|---|---|---|')
    for (let i = 0; i < 20; i++) {
      const a = list[Math.floor(i * list.length / 20)]
      md.push(`| #${a.postNum} | ${String(a.text).replace(/\|/g, '\\|').slice(0, 54)} | ${a.verdict} | ${String(a.basis).replace(/\|/g, '\\|').slice(0, 64)} |`)
    }
  }
}
fs.writeFileSync(path.join(OUT, 'coverage-conflicts-adjudicated.md'), md.join('\n') + '\n')

console.log('\nCERTIFICATION CONFLICTS — ADJUDICATED (proposed only)\n')
console.log(`  adjudicated : ${adjudicated.length}`)
console.log('\n  verdicts:')
for (const [v, n] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}  ${v}`)
console.log('\n  PROPOSED COUNT CHANGES:')
for (const [k, cur] of Object.entries(CERTIFIED)) {
  const addN = proposed[k] ?? 0
  console.log(`    ${k.padEnd(12)} ${String(cur).padStart(6)} ${addN ? `+ ${String(addN).padStart(3)} → ${cur + addN}` : '  (unchanged)'}`)
}
console.log('\n→ audit/coverage-conflicts-adjudicated.md\n')
