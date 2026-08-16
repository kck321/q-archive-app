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
  const { THEMES } = await import('./lib/themes.mjs')
  const themeByLabel = new Map(THEMES.map(t => [t.label, t]))
  const postByNum = new Map(posts.map(p => [p.postNum, p]))

  for (const a of themes.ambiguous) {
    // Theme rows shipped with NO context at all — a contributor saw a label, a post number and
    // nothing else, on the one kind that most needs the drop in front of it, because a theme is
    // inferred from the whole post rather than from a span. Show the lines whose vocabulary made
    // the signal fire, since the question being asked is whether those words are doing the work
    // the label claims. Falls back to the opening lines when no single line carries it.
    const post = postByNum.get(a.postNum)
    const lines = post ? clean(post.text ?? '').split('\n').map(l => l.trim()).filter(Boolean) : []
    const def = themeByLabel.get(a.token)
    const patterns = [...(def?.anchors ?? []), ...(def?.support ?? [])].filter(r => r instanceof RegExp)
    const hits = lines.filter(l => patterns.some(rx => { rx.lastIndex = 0; return rx.test(l) })).slice(0, 4)
    const context = hits.length ? hits : lines.slice(0, 4)

    rows.push({
      id: `theme-${a.postNum}-${a.token.replace(/\W+/g, '_')}`,
      kind: 'theme',
      token: a.token,
      postNum: a.postNum, postId: a.postId,
      sourceSpan: context[0] ?? '', context,
      lineIndex: -1, charIndex: -1,
      candidates: a.candidates ?? [],
      whyUnresolved: a.why,
      status: 'OPEN',
      provenance: 'Themes audit v1 — a context guard fired, so the signals are present but the words are doing something else',
      deepLink: `/post/${a.postId}`,
    })
  }
} catch { /* themes audit is optional; the entity queue stands on its own */ }

// ── Codes: recurring notation whose meaning the corpus does not establish ────
// A code can be genuine and still unresolved — that is the normal state here, not a defect.
// One-offs are not queued; only notation that recurs is worth community time.
try {
  const codes = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/codes-adjudicated.json'), 'utf8'))
  const codeAudit = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/codes-audit.json'), 'utf8'))
  // The id must survive normalisation. `[2]`, `[#2]` and `[+2]` are three DIFFERENT codes whose
  // keys all collapse to `code-_2_` once non-word characters become underscores, so three queue
  // rows shared one id and a community submission could have attached to the wrong code. The
  // index disambiguates without changing any certified key.
  let codeIdx = 0
  for (const d of codes.decisions) {
    if (d.outcome !== 'CERTIFIED_CODE_UNRESOLVED') continue
    const first = codeAudit.occurrences.find(o => o.normalizedKey === d.normalizedKey)
    rows.push({
      id: `code-${codeIdx++}-${d.normalizedKey.replace(/\W+/g, '_')}`,
      kind: 'code',
      token: d.sourceText,
      postNum: first?.postNum ?? 0, postId: first?.postId ?? null,
      // The span has to BE one of the context lines or the reader cannot see which line is in
      // question. context[1] is the middle line of the window and is usually right; when the
      // window is shorter it is undefined, which left one row with nothing highlighted.
      sourceSpan: first?.context?.[1] ?? first?.context?.[0] ?? '',
      context: first?.context ?? [],
      lineIndex: -1, charIndex: -1,
      candidates: [],
      whyUnresolved: `${d.why}. Appears ${d.recurrenceCount} times across ${d.posts} posts.`,
      status: 'OPEN',
      provenance: 'Codes & Brackets audit v1 — detected as notation, meaning not established by the corpus',
      deepLink: first?.postId ? `/post/${first.postId}` : '/brackets',
    })
  }
} catch { /* codes audit is optional */ }

// ── Emphasis: devices whose rhetorical function is arguable ─────────────────
// The distinction this queue exists for is repetition that EXISTS versus repetition used
// rhetorically. A run of related "What…" questions is a deliberate cascade; two unrelated
// questions opening on the same word are ordinary sentence structure. Where no structural test
// settles it, the honest outcome is to ask rather than to rule — so these are queued as
// classification questions instead of being forced into or out of the certified 5,251.
try {
  const emph = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/emphasis-borderline.json'), 'utf8'))
  const WHY = {
    QUESTION_SERIES_WITHOUT_EXTRA_EMPHASIS: 'The sequence is real, but extra rhetorical emphasis is not established — the lines share an opening word and change subject.',
    NEEDS_CONTEXT: 'A repeated frame that meets no structural test on its own. Whether it reads as deliberate parallel construction is a judgement call.',
    caps: 'This word is capitalised 80-89% of the time across the corpus, so the capitals here are weak contrast rather than clear emphasis.',
  }
  emph.items.forEach((it, i) => {
    rows.push({
      id: `emph-${it.postNum}-${i}`,
      kind: 'classification',
      token: String(it.sourceText).slice(0, 80),
      postNum: it.postNum, postId: it.postId ?? null,
      sourceSpan: String(it.line).slice(0, 200),
      context: [String(it.line).slice(0, 200)],
      lineIndex: -1, charIndex: -1,
      candidates: it.kind === 'caps'
        ? ['Emphasis — the capitals stand out here', 'Not emphasis — this is how the word is written']
        : ['Deliberate parallel construction', 'Ordinary sentence structure'],
      whyUnresolved: WHY[it.verdict] ?? WHY[it.kind] ?? 'Classification not established.',
      status: 'OPEN',
      provenance: 'Emphasis audit v1 — deliberately left out of the certified count',
      deepLink: it.postId ? `/post/${it.postId}` : '/emphasis',
    })
  })
} catch { /* emphasis audit is optional */ }

// ── Owner resolutions ────────────────────────────────────────────────────────
// A case the owner has settled must LEAVE the queue. This file is derived, so the resolution has
// to live outside it or the next rebuild puts the row straight back. Same overlay pattern as the
// other four sections. Resolving by ID, never by token: [R] is queued twice for unrelated reasons
// (#150's acrostic letter and #1277's "[R] = Renegade"), and clearing by token would resolve a
// case nobody looked at.
const RESOLVED = path.join(ROOT, 'audit', 'resolution-owner-resolved.json')
const ownerResolved = fs.existsSync(RESOLVED)
  ? new Set((JSON.parse(fs.readFileSync(RESOLVED, 'utf8')).resolved ?? []).map(r => r.id))
  : new Set()
// An owner ALIAS ruling resolves every queued row for that token: the queue is built from the
// unresolved-alias pass, which never sees a ruling applied later in apply-entities. US was ruled
// an alias of United States and its 277 rows still sat here asking what US refers to.
const ORULES = path.join(ROOT, 'audit', 'entities-owner-rulings.json')
// A ruling's `excludePosts` are the drops it deliberately did NOT answer — RC is Rachel Chandler
// everywhere except #2, where "all his funds in a RC" is not a person. Those rows stay queued:
// clearing by token alone would mark a question as answered that the ruling left open.
const aliasRulingList = fs.existsSync(ORULES) ? JSON.parse(fs.readFileSync(ORULES, 'utf8')).aliasRulings ?? [] : []
// SCOPE THE CLEARING THE SAME WAY THE COUNTING IS SCOPED.
//
// This cleared every row for a ruled TOKEN, minus excludePosts. When SC was ruled the Supreme
// Court in 24 named drops, all 86 SC rows disappeared — the 62 the owner had NOT ruled were
// neither counted as mentions nor left visible as work. A scoped ruling must clear only the posts
// it names, or the queue quietly loses the cases it exists to hold.
//
// The same failure repeats one level down. Post-level clearing is too coarse for a ruling that
// names individual OCCURRENCES: #1385 writes "SIS [FBI] > C_A" on line 1 and "SIS is good?" on
// line 5, and only line 1 was ruled. Clearing by post erased the line-5 row, which the audit
// deliberately holds open for its dual US/UK reading. Counting is occurrence-scoped in
// apply-entities; the clearing has to be scoped the same way or the queue loses the exact cases
// the occurrence scoping exists to preserve.
// One alias can carry SEVERAL rulings — SIS is MI6 in some drops and the FBI's Special
// Intelligence Service in others — so scopes are collected per alias as a LIST. Keying a Map by
// alias keeps only the last ruling and silently un-clears everything the earlier ones answered.
const resolvedTokens = new Map()
for (const r of aliasRulingList) {
  const scope = {
    exclude: new Set(r.excludePosts ?? []),
    include: r.includePosts ? new Set(r.includePosts) : null,
    occ: r.includeOccurrences
      ? new Map(Object.entries(r.includeOccurrences).map(([p, pairs]) => [Number(p), new Set(pairs.map(([l, c]) => `${l}|${c}`))]))
      : null,
  }
  if (!resolvedTokens.has(r.alias)) resolvedTokens.set(r.alias, [])
  resolvedTokens.get(r.alias).push(scope)
}
const answers = (scope, r) => {
  if (scope.exclude.has(r.postNum)) return false
  // An occurrence-scoped ruling answers only the coordinates it names.
  if (scope.occ) {
    const want = scope.occ.get(r.postNum)
    return want ? want.has(`${r.lineIndex}|${r.charIndex}`) : false
  }
  return scope.include ? scope.include.has(r.postNum) : true
}
const isRuled = r => {
  if (r.kind !== 'entity') return false
  const scopes = resolvedTokens.get(r.token)
  return scopes ? scopes.some(s => answers(s, r)) : false
}
const tokenCleared = rows.filter(isRuled).length
for (let i = rows.length - 1; i >= 0; i--) {
  if (isRuled(rows[i])) rows.splice(i, 1)
}
console.log(`  owner alias rulings cleared : ${tokenCleared}`)

const clearedCount = rows.filter(r => ownerResolved.has(r.id)).length
for (let i = rows.length - 1; i >= 0; i--) if (ownerResolved.has(rows[i].id)) rows.splice(i, 1)
console.log(`  owner-resolved rows removed : ${clearedCount}`)

// ── Owner notes on rows that STAY ─────────────────────────────────────────────
// The third state between "resolved" and "silent". SR is Seth Rich in nine drops and demonstrably
// NOT a person in four more (senior staffer, SR+MID+LOW, [SR 1-4]) — but "not Seth Rich" is not
// itself an answer, so those rows stay queued carrying the owner's reasoning. Notes never touch
// counts: attached after clearing, so a note can never remove a row.
const OWNER_NOTES_FILE = path.join(ROOT, 'audit', 'resolution-owner-notes.json')
const ownerNotes = fs.existsSync(OWNER_NOTES_FILE)
  ? new Map((JSON.parse(fs.readFileSync(OWNER_NOTES_FILE, 'utf8')).notes ?? []).map(n => [n.id, n]))
  : new Map()
let notesAttached = 0
for (const r of rows) {
  const n = ownerNotes.get(r.id)
  if (!n) continue
  r.ownerNote = n.ownerNote
  r.ownerNotedOn = n.notedOn
  notesAttached++
}
console.log(`  owner notes attached        : ${notesAttached} of ${ownerNotes.size}`)

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
