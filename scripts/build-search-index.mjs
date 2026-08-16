// The global search index — assembled from certified artifacts, never re-parsed.
//
// THE RULE: search does not decide what anything IS. Every record is copied from a section that
// already certified it, carrying that section's own metadata for filtering. A search-time parser
// would be a tenth classifier with no audit behind it, and it would disagree with the sections
// the first time Q wrote something unusual.
//
// So each record states, in the data, WHY it can match: exact Q wording, an entity alias, a
// theme, a code, a URL, an unresolved token — or an editorial normalisation, which is searchable
// precisely because a reader half-remembers a question in cleaned-up form, and which therefore
// has to be labelled as editorial everywhere it appears.
//
// Raw post text is NOT duplicated here. The app already holds all 4,966 drops, and shipping the
// 8.5 MB of post text a second time to search it would be a self-inflicted wound.
//
//   node scripts/build-search-index.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { key } from './lib/segment.mjs'
import { CANONICAL } from './lib/contracts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const dry = process.argv.includes('--dry')

const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const posts = read('posts.json')
const questions = read('questions.json')
const evidence = read('evidence.json')
const entities = read('entities.json')
const themes = read('themes.json')
const codes = read('codes.json')
const emphasis = read('emphasis.json')
const queue = read('resolution-queue.json')

const nlower = s => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
const postById = new Map(posts.map(p => [p.postNum, p]))

/**
 * A record.
 *   s  section          which certified dataset this came from
 *   p  postNum          the drop
 *   i  postId           for the deep link
 *   t  text             what is displayed
 *   w  why              why this can match — shown on every result
 *   f  filters          the section's OWN metadata, copied not derived
 *   q  qAuthored        false ONLY for editorial rows, which must never read as Q's wording
 *   src sourceWording   for editorial rows: what Q actually wrote
 */
const rows = []
const add = r => rows.push({ q: true, ...r })

// ── Questions ────────────────────────────────────────────────────────────────
for (const qq of questions) {
  const editorial = Boolean(qq.editorialNormalization || qq.neverDisplayAsQ)
  if (editorial) {
    // Searchable, and unmistakable. A reader looking for "What is Manafort's background?" should
    // find the drop — and must never be shown a cleaned-up sentence as though Q wrote it.
    add({
      s: 'editorial', p: qq.postNum, i: qq.postId, t: qq.text,
      w: 'editorial normalisation — not Q’s literal wording',
      f: { editorial: true },
      q: false,
      src: qq.qAuthoredSource ?? null,
    })
    continue
  }
  if (qq.occurrences === undefined) continue
  add({
    s: 'questions', p: qq.postNum, i: qq.postId, t: qq.text,
    w: 'exact Q wording — certified question',
    f: { semanticFunction: qq.semanticFunction ?? null, grammaticalForm: qq.grammaticalForm ?? null,
      occurrences: qq.occurrences ?? 1, directiveWrapped: Boolean(qq.directiveSource) },
  })
}

// ── Directives, Claims, Predictions — stored on the post ─────────────────────
for (const p of posts) {
  const meta = p.claimMeta ?? {}
  const fams = p.directiveFamilies ?? {}

  ;(p.actionRequests ?? []).forEach(d => {
    const fam = fams[nlower(d)] ?? fams[key(d)]
    add({
      s: 'directives', p: p.postNum, i: p.id, t: d,
      w: 'exact Q wording — certified directive',
      f: { family: fam?.family ?? null, alsoQuestion: Boolean(fam?.alsoQuestion) },
    })
  })

  const attr = text => {
    const m = meta[nlower(text)] ?? meta[key(text)] ?? meta[text] ?? {}
    return { checkable: Boolean(m.checkable), sourceProvided: Boolean(m.sourceProvided),
      conclusion: Boolean(m.isConclusion), telegraphic: Boolean(m.telegraphic), confidence: m.confidence ?? null }
  }
  ;(p.postAnalysis?.claims ?? []).forEach(c => add({
    s: 'claims', p: p.postNum, i: p.id, t: c, w: 'exact Q wording — certified claim', f: attr(c),
  }))
  ;(p.postAnalysis?.predictions ?? []).forEach(c => add({
    s: 'predictions', p: p.postNum, i: p.id, t: c, w: 'exact Q wording — certified prediction', f: attr(c),
  }))

  // Editorial paraphrases: searchable, labelled, never Q's words.
  ;(p.editorialParaphrases ?? []).forEach(e => add({
    s: 'editorial', p: p.postNum, i: p.id, t: e.text,
    w: 'editorial paraphrase — not Q’s literal wording',
    f: { editorial: true }, q: false, src: e.provenance ?? null,
  }))
}

// ── Evidence ─────────────────────────────────────────────────────────────────
for (const i of evidence.items) {
  const p = postById.get(i.postNum)
  add({
    s: 'evidence', p: i.postNum, i: i.postId ?? p?.id ?? null, t: i.value ?? i.label ?? '',
    w: i.subtype === 'embedded_in_source_material'
      ? 'a URL inside pasted source material — present in the drop, not Q citing a source'
      : `certified reference — ${i.subtype ?? i.kind}`,
    f: { subtype: i.subtype ?? null, kind: i.kind ?? null, domain: i.domain ?? null, archived: Boolean(i.archived) },
  })
}

// ── Entities: one record per entity, carrying its aliases so a search for an alias hits ─────
for (const e of entities.entities) {
  add({
    s: 'entities', p: null, i: null, t: e.canonical,
    w: 'certified entity',
    f: { type: e.type, mentions: e.mentions, source: e.source,
      aliases: (e.aliases ?? []).map(a => a.text), posts: (e.posts ?? []).slice(0, 400) },
  })
}

// ── Themes ───────────────────────────────────────────────────────────────────
for (const [postNum, list] of Object.entries(themes.byPost ?? {})) {
  for (const t of list) {
    add({
      s: 'themes', p: Number(postNum), i: postById.get(Number(postNum))?.id ?? null, t: t.label,
      w: `certified theme — ${t.confidence}`,
      f: { theme: t.theme, confidence: t.confidence, anchors: t.evidence?.anchors ?? [] },
    })
  }
}

// ── Codes ────────────────────────────────────────────────────────────────────
for (const c of codes.codes) {
  add({
    s: 'codes', p: null, i: null, t: c.sourceTexts[0] ?? c.normalizedKey,
    w: c.resolved ? 'certified code with an interpretation' : 'certified code — meaning not established',
    f: { codeType: c.codeType, resolved: Boolean(c.resolved), recurrence: c.recurrenceCount,
      variants: c.sourceTexts, posts: (c.posts ?? []).slice(0, 400), linkedEntityId: c.linkedEntityId ?? null },
  })
}

// ── Emphasis ─────────────────────────────────────────────────────────────────
for (const o of emphasis.occurrences) {
  add({
    s: 'emphasis', p: o.postNum, i: o.postId, t: o.sourceText,
    w: `certified emphasis — ${o.type.replace(/_/g, ' ')}`,
    f: { type: o.type, line: o.line, basis: o.basis ?? null },
  })
}

// ── Unresolved ───────────────────────────────────────────────────────────────
for (const r of queue.rows) {
  add({
    s: 'unresolved', p: r.postNum, i: r.postId, t: r.token,
    w: 'unresolved — deliberately not decided',
    f: { kind: r.kind, itemId: r.id, span: r.sourceSpan },
  })
}

// ── QA ───────────────────────────────────────────────────────────────────────
const bySection = {}
for (const r of rows) bySection[r.s] = (bySection[r.s] ?? 0) + 1

const editorialUnlabelled = rows.filter(r => r.s === 'editorial' && r.q !== false)
const qAuthoredMislabelled = rows.filter(r => r.q === false && r.s !== 'editorial')
const noWhy = rows.filter(r => !r.w)
const noText = rows.filter(r => !String(r.t ?? '').trim())

const checks = [
  ['Questions indexed = 6,443', bySection.questions === 6443, bySection.questions],
  ['Directives indexed = 2,552', bySection.directives === 2552, bySection.directives],
  ['Claims indexed = 4,221', bySection.claims === 4221, bySection.claims],
  ['Predictions indexed = 595', bySection.predictions === 595, bySection.predictions],
  ['Evidence indexed = 6,590', bySection.evidence === 6590, bySection.evidence],
  // 1,334: Ray Chandler ships merged into Rachel Chandler under the owner ruling.
  [`Entities indexed = ${CANONICAL.entities.canonical.toLocaleString()}`,
    bySection.entities === CANONICAL.entities.canonical, bySection.entities],
  ['Themes indexed = 2,644', bySection.themes === 2644, bySection.themes],
  ['Codes indexed = 739', bySection.codes === 739, bySection.codes],
  ['Emphasis indexed = 3,112', bySection.emphasis === 3112, bySection.emphasis],
  // Read from the contract, never copied — see the same fix in build-relationships.mjs.
  [`Unresolved indexed = ${CANONICAL.resolution.total.toLocaleString()}`,
    bySection.unresolved === CANONICAL.resolution.total, bySection.unresolved],
  // 1,393: two lines that were editorial paraphrases became certified Claims in the 2026-08-13
  // owner adjudication, and a line cannot be both Q's own wording and a paraphrase of it.
  ['editorial rows = 134 normalisations + 1,259 paraphrases', bySection.editorial === 1393, bySection.editorial],
  ['every editorial row is flagged not-Q-authored', editorialUnlabelled.length === 0, editorialUnlabelled.length],
  ['no Q-authored row is flagged editorial', qAuthoredMislabelled.length === 0, qAuthoredMislabelled.length],
  ['every record states why it can match', noWhy.length === 0, noWhy.length],
  ['every record has text to match against', noText.length === 0, noText.length],
]

console.log('\nSEARCH INDEX\n')
for (const [s, n] of Object.entries(bySection).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${s}`)
console.log(`\n  total records : ${rows.length.toLocaleString()}`)
console.log('\n  QA GATE')
let failed = 0
for (const [label, ok, got] of checks) { if (!ok) failed++; console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(50)} ${got}`) }

const out = {
  generated: 'scripts/build-search-index.mjs',
  fromCertifiedArtifacts: true,
  note: 'Every record is copied from a certified section with that section’s own metadata. Search performs no classification. Raw post text is searched from the copy the app already holds, not duplicated here.',
  totals: { records: rows.length, bySection },
  rows,
}

const md = ['# Q Drops — search index QA\n']
md.push('Search indexes the certified datasets and their existing metadata. It performs no classification of its own, and it duplicates no post text.\n')
md.push(`\n**${rows.length.toLocaleString()} records.**\n`)
md.push('\n| Section | Records |')
md.push('|---|---|')
for (const [s, n] of Object.entries(bySection).sort((a, b) => b[1] - a[1])) md.push(`| ${s} | ${n.toLocaleString()} |`)
md.push('\n## QA\n')
md.push('| | Check | Observed |')
md.push('|---|---|---|')
for (const [label, ok, got] of checks) md.push(`| ${ok ? '✅' : '❌'} | ${label} | ${got} |`)
fs.writeFileSync(path.join(OUT, 'search-index-qa.md'), md.join('\n') + '\n')

if (failed) { console.error(`\nAborting: ${failed} QA check(s) failed. Nothing written.\n`); process.exit(1) }
if (dry) { console.log('\n--dry: search-index.json not written\n'); process.exit(0) }

fs.writeFileSync(path.join(DATA, 'search-index.json'), JSON.stringify(out))
console.log(`\nwrote public/data/search-index.json (${(fs.statSync(path.join(DATA, 'search-index.json')).size / 1048576).toFixed(2)} MB)\n`)
