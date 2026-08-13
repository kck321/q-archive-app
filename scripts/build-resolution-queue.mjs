// Build the Resolution Center queue: one row per UNRESOLVED OCCURRENCE.
//
// Occurrence-level, not token-level, and that is the whole point. "BO" means Barack Obama in
// some drops and the Board Owner in others; a queue keyed by token would invite someone to
// resolve all 77 at once and would reintroduce exactly the global-alias mistake the audit
// spent three passes avoiding. Resolving one occurrence must never redefine the token.
//
// Each row carries what a reader needs to judge it without leaving the page: the exact
// Q-authored span, several surrounding lines, the post number, and any interpretations the
// audit already considered and rejected as unproven.
//
// SAFETY: this writes only public/data/resolution-queue.json. Community submissions go to a
// separate Firestore collection and NEVER touch a certified artifact. Approved resolutions
// re-enter through the normal audit → materialise → QA → apply → deploy chain.
//
//   node scripts/build-resolution-queue.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clean } from './lib/segment.mjs'
import { CONTEXT_RESOLVE } from './lib/entityVerdicts.mjs'
import { CONTEXT_DEPENDENT as CD_CORE, CODED_ALIASES } from './lib/entities.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const entities = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))
const ctx = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/entities-context-resolved.json'), 'utf8'))

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Occurrences the context pass already resolved are OUT of the queue — they are answered.
const resolvedAt = new Set(ctx.resolutions.map(r => `${r.token}|${r.postNum}|${r.line}`))

// Known-but-unproven readings, shown so a contributor starts from what was already considered.
const CANDIDATES = {}
for (const [tok, list] of Object.entries(CONTEXT_RESOLVE)) CANDIDATES[tok] = list.map(c => c.canonical)
for (const tok of Object.keys(CD_CORE)) CANDIDATES[tok] ??= []
for (const [tok, v] of Object.entries(CODED_ALIASES)) if (v.likely) CANDIDATES[tok] = [v.likely]

const NOTES = { ...CD_CORE }

// The queue is for genuine ambiguous REFERENCES, not for every string the tail rejected.
// Taking the unresolved list wholesale put years ("2016", "2020"), ordinary words ("NO",
// "Democratic") and URL fragments ("thehill") in front of contributors, which wastes the
// goodwill of anyone who shows up to help. A token qualifies if it is curated shorthand, a
// coded alias, or looks like initials.
const SHORTHAND_SHAPE = /^([A-Z]{2,5}|[A-Z]+_[A-Z_]+|[A-Z]\.[A-Z]\.?|[A-Z][a-z]+ [A-Z])$/
// Ordinary English words that Q's all-caps style turns into apparent initials, plus concept
// words that belong to Themes. "IT", "OR" and "SWAMP" are not references anyone can resolve.
const NOT_A_REFERENCE = /^(19|20)\d{2}$|^\d+$|^(NO|YES|ALL|NEW|OLD|THE|AND|NOT|WHO|WHY|HOW|OUR|WAR|LAW|ACT|KEY|TOP|BIG|END|ONE|TWO|SEE|USE|IT|OR|IF|AT|BE|BY|DO|GO|IN|ON|SO|TO|UP|WE|AN|ME|MY|OF|HE|IS|AM|ARE|WAS|SWAMP|TRUTH|POWER|PLAN|GAME|NEWS|MEDIA|PEOPLE|LEFT|RIGHT|DEEP|FAKE|REAL|GOOD|EVIL|LIGHT|DARK)$/
const curated = new Set([...Object.keys(CD_CORE), ...Object.keys(CONTEXT_RESOLVE), ...Object.keys(CODED_ALIASES)])
const tokens = new Set(entities.unresolvedAliases
  .map(u => u.sourceText)
  .filter(t => t && !NOT_A_REFERENCE.test(t) && (curated.has(t) || SHORTHAND_SHAPE.test(t))))

const rows = []
for (const p of posts) {
  const lines = clean(p.text ?? '').split('\n')
  lines.forEach((line, i) => {
    for (const token of tokens) {
      if (!token || token.length < 2) continue
      const rx = new RegExp(`(?<![A-Za-z0-9_])${esc(token)}(?![A-Za-z0-9_])`, 'g')
      let hit
      while ((hit = rx.exec(line)) !== null) {
        if (resolvedAt.has(`${token}|${p.postNum}|${i}`)) continue
        rows.push({
          id: `${token}-${p.postNum}-${i}-${hit.index}`,
          kind: 'entity',
          token,
          postNum: p.postNum,
          postId: p.id,
          // The exact Q-authored line, and the window a reader needs to judge it.
          sourceSpan: line.trim(),
          context: lines.slice(Math.max(0, i - 3), i + 4).map(l => l.trim()).filter(Boolean),
          lineIndex: i,
          charIndex: hit.index,
          candidates: CANDIDATES[token] ?? [],
          whyUnresolved: NOTES[token] ?? 'The surrounding post does not identify the referent.',
          status: 'OPEN',
          // Which audit decided to leave this unresolved, and where it lives in the app. Both
          // travel with the row so a contributor can always get back to the source.
          provenance: 'Entities audit — context pass found no evidence in the surrounding lines',
          deepLink: `/post/${p.id}`,
        })
      }
    }
  })
}

// ── Themes: the genuine context-guard ambiguities join the same hub ──────────
// Only the 251 guard cases. The 4,242 legacy-only tags stay out: the coverage audit found
// them 57% extractor noise and 19% style labels that are not subjects at all, and queuing
// them would bury the real cases under more than twice the entity queue.
try {
  const themes = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/themes-audit.json'), 'utf8'))
  for (const a of themes.ambiguous) {
    rows.push({
      id: `theme-${a.postNum}-${a.token.replace(/\W+/g, '_')}`,
      kind: 'theme',
      token: a.token,
      postNum: a.postNum, postId: a.postId,
      sourceSpan: '', context: [],
      lineIndex: -1, charIndex: -1,
      candidates: a.candidates ?? [],
      whyUnresolved: a.why,
      status: 'OPEN',
      provenance: 'Themes audit v1 — a context guard fired, so the signals are present but the words are doing something else',
      deepLink: `/post/${a.postId}`,
    })
  }
} catch { /* themes audit is optional; the entity queue stands on its own */ }

// Cap the shipped queue so the page stays fast; the full set stays in the audit trail.
const byToken = {}
for (const r of rows) byToken[r.token] = (byToken[r.token] ?? 0) + 1

const out = {
  generated: 'scripts/build-resolution-queue.mjs',
  certifiedDataUnaffected: true,
  statuses: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'INSUFFICIENT_EVIDENCE', 'DISPUTED'],
  // Every kind the hub will ever hold, declared now so the filters exist before the sections
  // that populate them. Themes, Codes and later audits feed the same queue rather than
  // stranding their unresolved items in an audit file.
  kinds: ['entity', 'theme', 'code', 'source_reference', 'classification', 'other'],
  totals: {
    occurrences: rows.length,
    tokens: Object.keys(byToken).length,
    byToken,
    byKind: rows.reduce((a, r) => { a[r.kind] = (a[r.kind] ?? 0) + 1; return a }, {}),
    byStatus: rows.reduce((a, r) => { a[r.status] = (a[r.status] ?? 0) + 1; return a }, {}),
  },
  rows,
}
fs.writeFileSync(path.join(DATA, 'resolution-queue.json'), JSON.stringify(out))

console.log('\nRESOLUTION QUEUE\n')
console.log(`  unresolved occurrences : ${rows.length.toLocaleString()}`)
console.log(`  distinct tokens        : ${Object.keys(byToken).length.toLocaleString()}`)
console.log('\n  largest queues:')
for (const [t, n] of Object.entries(byToken).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`    ${String(n).padStart(4)}  ${t}`)
console.log(`\nwrote public/data/resolution-queue.json (${(fs.statSync(path.join(DATA, 'resolution-queue.json')).size / 1048576).toFixed(2)} MB)\n`)
