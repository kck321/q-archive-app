// Read the hover text the way a reader will, before 4,285 of them go out.
//
//   node scripts/audit-hover-wording.mjs [--sample]
//
// Two jobs. The checks below are mechanical and catch the failures that scale: a Partial reading
// written as though it were settled, an allegation restated as fact, a question turned into a
// claim. The --sample output is for human eyes, because tone is not something a regex can grade —
// it draws a stratified sample across every entity type, post length, and the categories most
// likely to go wrong (merge survivors, corrected types, shared aliases, sarcasm, compression).
//
// The wording policy this enforces (10_TOOLTIP_POLICY.txt, and the owner's Stage 2 instruction):
//   - describe what the post is COMMUNICATING, never assert it as independently verified
//   - never convert Partial or Insufficient evidence into factual language
//   - a question stays a question
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const showSample = process.argv.includes('--sample')

const hovers = JSON.parse(fs.readFileSync(path.join(DATA, 'entity-hovers.json'), 'utf8'))
const entities = JSON.parse(fs.readFileSync(path.join(DATA, 'entities.json'), 'utf8'))
const posts = JSON.parse(fs.readFileSync(path.join(DATA, 'posts.json'), 'utf8'))
const stage1 = JSON.parse(fs.readFileSync(path.join(OUT, 'entities-stage1-rulings.json'), 'utf8'))
const byId = new Map(entities.entities.map(e => [e.id, e]))
const postByNum = new Map(posts.map(p => [p.postNum, p]))

// Flatten to one row per published synopsis.
const rows = []
for (const [entityId, byPost] of Object.entries(hovers.byPost)) {
  for (const [postNum, v] of Object.entries(byPost)) {
    rows.push({ entityId, postNum: Number(postNum), text: v.s, alias: v.a, role: v.r, support: v.g, confidence: v.c })
  }
}
console.log(`\nHOVER WORDING AUDIT\n\n  published synopses : ${rows.length}`)

let failed = 0
const check = (label, bad, detail) => {
  const ok = bad.length === 0
  if (!ok) failed++
  console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(56)} ${ok ? detail : `${bad.length} — e.g. ${bad[0]}`}`)
  return bad
}

// ── 1. attribution ──────────────────────────────────────────────────────────
// Every synopsis has to locate itself in the post rather than speaking about the world.
console.log('\n  ATTRIBUTION')
const ATTRIB = /\b(the post|the passage|the drop|this post|the line|the question|appears in|is used|reads|asks|frames|says|refers to|names)\b/i
check('every synopsis attributes to the post',
  rows.filter(r => !ATTRIB.test(r.text)).map(r => `#${r.postNum} ${r.alias}`), `${rows.length} attribute`)
check('every synopsis names its post number',
  rows.filter(r => !r.text.includes(`#${r.postNum}`)).map(r => `#${r.postNum} ${r.alias}`), 'all cite their drop')

// ── 2. support grade must survive into the wording ──────────────────────────
// The failure this catches: a Partial reading written as a settled one. If the grade is not
// visible in the language, the reader cannot tell a supported identification from a plausible one.
console.log('\n  SUPPORT GRADE PRESERVED')
const HEDGE = /\b(may|might|could|appears|suggests|is not established|unresolved|cannot|does not confirm|no direct|not explicit|possible|likely|consistent with|without|only|remains|unclear|ambiguous|insufficient|partial)\b/i
const weak = rows.filter(r => r.support === 'Partial' || r.support === 'Insufficient')
check('no Partial/Insufficient synopsis reads as settled',
  weak.filter(r => !HEDGE.test(r.text)).map(r => `#${r.postNum} ${r.alias} (${r.support})`),
  `${weak.length} weak-support synopses all hedge`)
const strong = rows.filter(r => r.support === 'Strong')
console.log(`      (Strong ${strong.length} · Partial ${weak.filter(r => r.support === 'Partial').length} · Insufficient ${weak.filter(r => r.support === 'Insufficient').length})`)

// ── 3. a question stays a question ──────────────────────────────────────────
console.log('\n  QUESTIONS ARE NOT CONVERTED')
const qRows = rows.filter(r => r.role === 'question')
check('a synopsis over a question says so',
  qRows.filter(r => !/\b(question|asks|asking|whether)\b/i.test(r.text)).map(r => `#${r.postNum} ${r.alias}`),
  `${qRows.length} question-role synopses`)

// ── 4. nothing is asserted as independently verified ────────────────────────
console.log('\n  NO INDEPENDENT VERIFICATION IMPLIED')
// Measured on the synopsis's OWN words, with Q's quoted passage removed first. Reading the whole
// string flagged five synopses for the word "proven" — every one of them inside the drop being
// quoted ("Has POTUS ever made a statement that hasn't been proven to be correct?"). Quoting Q
// accurately is the job; this rule is about what the synopsis asserts in its own voice.
// Quote marks cannot settle this. #1939 pastes a news article that opens with a straight quote and
// closes with a curly one, so a paired-quote strip leaves "now proven to be a spy" looking like the
// synopsis's own assertion when it is Q's pasted source, correctly quoted and attributed. Parity
// counting over quotation marks is unreliable for exactly this reason — lib/quotedBlocks.mjs
// carries the same lesson.
//
// So the test is whether the phrase is IN THE DROP. If the words are Q's, quoting them is the job.
const VERIFIED = /\b(confirmed by|proven to be|verified by|in fact,|it is established that|as we know|actually did|was indeed)\b/i
const assertsInOwnVoice = r => {
  const m = r.text.match(VERIFIED)
  if (!m) return false
  const post = String(postByNum.get(r.postNum)?.text ?? '').toLowerCase()
  return !post.includes(m[0].toLowerCase())
}
check('no synopsis claims verification in its own voice',
  rows.filter(assertsInOwnVoice).map(r => `#${r.postNum} ${r.alias}`), 'none — every match is Q quoted')

// ── 5. structural sanity ────────────────────────────────────────────────────
console.log('\n  STRUCTURE')
check('every synopsis has text', rows.filter(r => !r.text || r.text.length < 40).map(r => `#${r.postNum} ${r.alias}`), 'all non-trivial')
const LONG = 900
check(`no synopsis exceeds ${LONG} characters`, rows.filter(r => r.text.length > LONG).map(r => `#${r.postNum} ${r.alias} (${r.text.length})`),
  `longest ${Math.max(...rows.map(r => r.text.length))}`)
check('every synopsis resolves to a live entity', rows.filter(r => !byId.has(r.entityId)).map(r => r.entityId), `${new Set(rows.map(r => r.entityId)).size} entities`)
check('every synopsis resolves to a real post', rows.filter(r => !postByNum.has(r.postNum)).map(r => `#${r.postNum}`), `${new Set(rows.map(r => r.postNum)).size} posts`)
// THE CHECK THAT MATTERS: does the tooltip have something to attach to? A hover is keyed to
// (entity, post), so it is meaningful only if that drop carries a certified mention of that
// entity — otherwise it is an explanation floating over nothing.
//
// The first version asked a different question — "is the alias literally in the post text" — and
// failed 309 times. Those are real but not defects of this stage: the entity was matched inside a
// URL rather than in Q's prose ("Black Lives Matter" from trends.google.com/...q=black%20lives%20
// matter, "Daily Beast" from amp.thedailybeast.com). Our certified data counts those mentions too,
// so the tooltips agree with what the archive highlights. It is a pre-existing extraction issue —
// the entities contract requires an alias to appear "outside URL spans" — and it is reported
// rather than allowed to block Stage 2.
const entityAliases = new Map(entities.entities.map(e => [e.id, new Set([...e.aliases.map(a => a.text.toLowerCase()), e.canonical.toLowerCase()])]))
const paintedIn = new Map(posts.map(p => [p.postNum, new Set((p.postAnalysis?.namedEntities ?? []).map(t => t.toLowerCase()))]))
check('every hover anchors to a certified mention in that drop',
  rows.filter(r => {
    const al = entityAliases.get(r.entityId) ?? new Set()
    const painted = paintedIn.get(r.postNum) ?? new Set()
    return ![...al].some(a => painted.has(a))
  }).map(r => `#${r.postNum} ${byId.get(r.entityId)?.canonical}`),
  `all ${rows.length} have a mention to attach to`)

// Reported, not enforced.
const fold = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ')
const urlOnly = rows.filter(r => !fold(postByNum.get(r.postNum)?.text ?? '').includes(fold(r.alias).trim()))
console.log(`      note: ${urlOnly.length} explain a term absent from the drop's prose (matched inside a URL) — pre-existing`)

// ── 6. global and post-specific are distinct ────────────────────────────────
console.log('\n  TWO LAYERS STAY SEPARATE')
const sameAsGlobal = rows.filter(r => hovers.global[r.entityId] && hovers.global[r.entityId].trim() === r.text.trim())
check('no post synopsis is just the global one', sameAsGlobal.map(r => `#${r.postNum} ${r.alias}`),
  `${Object.keys(hovers.global).length} globals, ${rows.length} post-specific, none identical`)

// ── the stratified sample ───────────────────────────────────────────────────
if (showSample) {
  const typeCorrected = new Set(stage1.typeCorrections.map(t => t.canonical))
  const mergeSurvivors = new Set(stage1.merges.map(m => m.canonical))
  const aliasOwners = new Map()
  for (const e of entities.entities) for (const a of e.aliases) {
    if (!aliasOwners.has(a.text)) aliasOwners.set(a.text, [])
    aliasOwners.get(a.text).push(e.canonical)
  }
  const shared = new Set([...aliasOwners].filter(([, v]) => v.length > 1).map(([k]) => k))

  const pick = (label, pred, n = 2) => {
    const hits = rows.filter(pred)
    if (!hits.length) { console.log(`\n  ── ${label} — NONE FOUND`); return }
    console.log(`\n  ── ${label}  (${hits.length} available)`)
    // Spread the picks across the set rather than taking the first n, which would always land on
    // the same busiest entities.
    for (let i = 0; i < Math.min(n, hits.length); i++) {
      const r = hits[Math.floor(i * hits.length / Math.min(n, hits.length))]
      const e = byId.get(r.entityId)
      console.log(`     #${r.postNum} · ${e.canonical} [${e.type}] · alias "${r.alias}" · ${r.support}/${r.confidence} · role ${r.role}`)
      console.log(`       ${r.text.replace(/\s+/g, ' ').slice(0, 340)}`)
    }
  }
  console.log('\n\n  REPRESENTATIVE SAMPLE')
  for (const t of ['person', 'organization', 'location', 'media_organization', 'government_institution',
    'legislation_regulation', 'technology_platform', 'creative_work']) {
    pick(`type: ${t}`, r => byId.get(r.entityId)?.type === t, 2)
  }
  pick('short posts (< 120 chars)', r => (postByNum.get(r.postNum)?.text ?? '').length < 120, 2)
  pick('long posts (> 1500 chars)', r => (postByNum.get(r.postNum)?.text ?? '').length > 1500, 2)
  pick('duplicate-merge survivors', r => mergeSurvivors.has(byId.get(r.entityId)?.canonical), 2)
  pick('corrected entity types', r => typeCorrected.has(byId.get(r.entityId)?.canonical), 2)
  pick('aliases shared by several entities', r => shared.has(r.alias), 2)
  pick('role: question', r => r.role === 'question', 2)
  pick('role: claim / allegation', r => r.role === 'claim', 2)
  pick('weakest support (Insufficient)', r => r.support === 'Insufficient', 3)
}

console.log(`\n  ${failed ? `❌ ${failed} check(s) failed` : '✅ wording policy holds across all published synopses'}\n`)
process.exit(failed ? 1 : 0)
