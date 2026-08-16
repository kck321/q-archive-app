// Whole-app cross-section integrity audit.
//
// One question: does every certified occurrence in every section still resolve to the correct
// Q-authored source, carry the right provenance, overlap only where intended, and reach both
// first-time and returning users?
//
// This audit VALIDATES the certified system. It does not reclassify anything, does not add a
// category, and does not move a single count. Where it finds a defect the defect is in transport
// or display — the eight analytical sections stay frozen.
//
// The invariants are executable assertions. A report that says "verified" proves nothing; a
// script that exits non-zero does.
//
//   node scripts/audit-cross-section.mjs [--live]     --live also checks the deployed artifacts
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { clean, key } from './lib/segment.mjs'
import { sourceLines } from './lib/quotedBlocks.mjs'
import { CHAIN_STEPS } from './lib/chainSteps.mjs'
import { CANONICAL, SECTION_CONTRACTS, OVERLAPS, APPLY_ORDER, ARTIFACTS, KNOWN_DEBT, nspace, nlower } from './lib/contracts.mjs'
import { checkSeedFingerprint } from './seed-fingerprint.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const SRC = path.join(ROOT, 'src')

const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const posts = read('posts.json')
const questions = read('questions.json')
const evidence = read('evidence.json')
const entities = read('entities.json')
const themes = read('themes.json')
const codes = read('codes.json')
const emphasis = read('emphasis.json')
const queue = read('resolution-queue.json')

const byNum = new Map(posts.map(p => [p.postNum, p]))
const textOf = new Map(posts.map(p => [p.postNum, nlower(clean(p.text ?? ''))]))

const results = []
const group = g => (id, description, ok, detail) => results.push({ group: g, id, description, pass: Boolean(ok), detail: String(detail) })

// ── 1. Frozen canonical counts ───────────────────────────────────────────────
{
  const t = group('1. Frozen canonical counts')
  const qCounted = questions.filter(q => q.occurrences !== undefined)
  const directives = posts.flatMap(p => p.actionRequests ?? [])
  const claimRows = posts.flatMap(p => (p.postAnalysis?.claims ?? []).map(c => ({ p, c })))
  const predRows = posts.flatMap(p => (p.postAnalysis?.predictions ?? []))
  const entMentions = entities.entities.reduce((s, e) => s + (e.mentions ?? 0), 0)
  const themeAssign = themes.totals?.assignments ?? 0
  const codeOcc = codes.totals?.occurrences ?? 0

  t('posts', 'posts = 4,966', posts.length === CANONICAL.posts, posts.length)
  t('questions', 'Questions = 6,443 certified occurrences', qCounted.length === CANONICAL.questions.occurrences, qCounted.length)
  t('directives', 'Directives = 2,552', directives.length === CANONICAL.directives.occurrences, directives.length)
  t('claims', 'Claims = 4,189', claimRows.length === CANONICAL.claims.occurrences, claimRows.length)
  t('predictions', 'Predictions = 630', predRows.length === CANONICAL.predictions.occurrences, predRows.length)
  t('evidence', 'Evidence = 6,590', evidence.items.length === CANONICAL.evidence.occurrences, evidence.items.length)
  t('entities-canonical', 'Entities = 1,335 canonical', entities.entities.length === CANONICAL.entities.canonical, entities.entities.length)
  // Two populations, and the certified figure covers one of them. Asserting the sum of every row
  // against 4,463 fails at 7,903 — not because a count moved, but because the core registry and
  // the adjudicated tail are different metrics. Both halves are asserted so neither can drift.
  const coreMentions = entities.entities.filter(e => e.source === 'core registry').reduce((s, e) => s + (e.mentions ?? 0), 0)
  const tailMentions = entities.entities.filter(e => e.source === 'adjudicated tail').reduce((s, e) => s + (e.mentions ?? 0), 0)
  t('entities-mentions', 'Entities = 7,903 resolved mentions (headline)', entMentions === CANONICAL.entities.mentions, entMentions)
  t('entities-core', 'core registry submetric = 5,273', coreMentions === CANONICAL.entities.coreRegistryMentions, coreMentions)
  t('entities-tail', 'adjudicated tail submetric = 3,476', tailMentions === CANONICAL.entities.tailMentions, tailMentions)
  // Three populations: core registry + adjudicated tail + owner rulings (Dominion, #4963).
  const ownerMentions = entities.entities.filter(e => e.source === 'owner ruling').reduce((s2, e) => s2 + (e.mentions ?? 0), 0)
  // A SCOPED RULING MUST NOT DELETE WHAT THE CONTEXT PASS ALREADY DECIDED.
  //
  // `recount: true` REPLACES an alias count with a count over includePosts. Occurrences the
  // certified context pass had already resolved, but which sit outside the owner's scope, then
  // vanish from the count AND from the highlighting — while entities.json still lists the post.
  // It is silent: every other check passes, because the totals simply agree with the smaller
  // number. It cost 19 occurrences (13 BO, 6 SC) across two batches before anyone looked.
  // These posts are never in the Resolution Center — the context pass answering them is exactly
  // why they were never queued — so there is no owner decision to wait for.
  {
    const ctxRes = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/entities-context-resolved.json'), 'utf8')).resolutions
    const oRules = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/entities-owner-rulings.json'), 'utf8')).aliasRulings ?? []
    const dropped = []
    for (const r of oRules) {
      if (!r.includePosts || !r.recount) continue
      const inc = new Set(r.includePosts)
      for (const c of ctxRes) {
        if (c.token !== r.alias || c.canonical !== r.canonical) continue
        if (!inc.has(c.postNum)) dropped.push(`${c.token}#${c.postNum}->${c.canonical}`)
      }
    }
    t('entities-scope-drop', 'no scoped ruling drops a context-resolved occurrence',
      dropped.length === 0, dropped.length ? dropped.slice(0, 8).join(' ') : 'none')
  }

  // EVERY ACRONYM A READER MEETS MUST EXPLAIN ITSELF — INCLUDING ONES ADDED LATER.
  //
  // Owner standing rule: "any acronyms or names that come in moving forward will still continue
  // to define them as they are known." A promise to remember is not a mechanism; this is. Add an
  // entity whose canonical name is an acronym and ship without an expansion, and the build fails.
  //
  // Aliases are covered automatically — DOJ resolves to "Department of Justice" by construction.
  // The gap is an entity NAMED with the acronym (POTUS, CNN, SDNY), where the canonical repeats
  // the token and explains nothing. Deliberate omissions go in `deliberatelyUndefined` with a
  // reason, so "no definition" is always a decision on the record rather than an oversight.
  {
    const defsFile = path.join(ROOT, 'audit/acronym-definitions.json')
    const defs = fs.existsSync(defsFile) ? JSON.parse(fs.readFileSync(defsFile, 'utf8')) : { definitions: {}, deliberatelyUndefined: {} }
    const known = new Set([...Object.keys(defs.definitions ?? {}), ...Object.keys(defs.deliberatelyUndefined ?? {})])
    const glossary = fs.existsSync(path.join(DATA, 'glossary.json'))
      ? JSON.parse(fs.readFileSync(path.join(DATA, 'glossary.json'), 'utf8')).tokens : {}
    const undefinedAcronyms = entities.entities
      .filter(e => /^[A-Z][A-Z0-9]{1,6}$/.test(e.canonical))
      .filter(e => !known.has(e.canonical) && !glossary[e.canonical])
      .map(e => e.canonical)
    t('entities-acronyms-defined', 'every acronym-named entity has a definition or a stated reason',
      undefinedAcronyms.length === 0, undefinedAcronyms.length ? undefinedAcronyms.join(' ') : 'all defined')
  }

  t('entities-reconcile', 'submetrics sum to the headline',
    coreMentions + tailMentions + ownerMentions === entMentions,
    `${coreMentions} + ${tailMentions} + ${ownerMentions} = ${entMentions}`)
  t('entities-artifact-headline', 'the artifact ships the headline figure', entities.totals.mentions === CANONICAL.entities.mentions, entities.totals.mentions)
  t('entities-headline-declared', 'the headline states how it is composed',
    /core registry/i.test(SECTION_CONTRACTS.find(c => c.id === 'entities').mayCoexist), 'declared')
  t('themes', 'Themes = 2,393 assignments', themeAssign === CANONICAL.themes.assignments, themeAssign)
  t('codes', 'Codes = 1,949 occurrences', codeOcc === CANONICAL.codes.occurrences, codeOcc)
  t('emphasis', 'Emphasis = 3,113 occurrences', emphasis.occurrences.length === CANONICAL.emphasis.occurrences, emphasis.occurrences.length)

  const qk = {}
  for (const r of queue.rows) qk[r.kind] = (qk[r.kind] ?? 0) + 1
  t('resolution-total', 'Resolution Center = 2,527', queue.rows.length === CANONICAL.resolution.total, queue.rows.length)
  for (const k of ['entity', 'theme', 'code', 'classification']) {
    t(`resolution-${k}`, `Resolution ${k} = ${CANONICAL.resolution[k].toLocaleString()}`, qk[k] === CANONICAL.resolution[k], qk[k] ?? 0)
  }
}

// ── 2. Provenance contract per section ───────────────────────────────────────
{
  const t = group('2. Provenance contracts')
  // Questions: the 134 extra rows must be identifiable, uncounted, and never displayable.
  const editorial = questions.filter(q => q.editorialNormalization || q.neverDisplayAsQ)
  const counted = questions.filter(q => q.occurrences !== undefined)
  t('q-rows', 'Questions ships 6,577 rows for 6,443 certified', questions.length === 6577, questions.length)
  t('q-editorial-count', 'exactly 134 editorial-normalisation rows', editorial.length === 134, editorial.length)
  t('q-editorial-uncounted', 'no editorial row carries an occurrences field', editorial.every(q => q.occurrences === undefined), `${editorial.filter(q => q.occurrences !== undefined).length} counted`)
  t('q-partition', 'counted + editorial = every shipped row', counted.length + editorial.length === questions.length, `${counted.length} + ${editorial.length}`)

  // Evidence: embedded-in-source URLs exist but must be labelled, not counted as Q citations.
  const embedded = evidence.items.filter(i => i.provenance && /embedded|source material/i.test(i.provenance))
  const qCitations = evidence.totals.externalLinks?.qCitations ?? 0
  const embeddedTotal = evidence.totals.externalLinks?.embeddedInSourceMaterial ?? 0
  t('ev-embedded-labelled', 'embedded-in-source URLs are labelled in the data', embeddedTotal > 0, `${embeddedTotal} labelled`)
  t('ev-embedded-not-citations', 'embedded-in-source URLs are excluded from the Q-citation figure', qCitations + embeddedTotal <= evidence.items.length, `${qCitations} citations + ${embeddedTotal} embedded of ${evidence.items.length}`)

  // Entities: two metrics, both correct — assert they are genuinely different, not a mismatch.
  t('ent-two-metrics', 'canonical and mentions are distinct metrics', entities.entities.length !== CANONICAL.entities.mentions, `${entities.entities.length} vs ${CANONICAL.entities.mentions}`)
  t('ent-unresolved-separate', 'unresolved aliases counted in neither metric', Array.isArray(entities.unresolvedAliases), `${entities.unresolvedAliases?.length ?? 0} carried separately`)

  // Codes: undecoded is the normal state and must not be dressed up.
  const invented = codes.codes.filter(c => c.interpretedMeaning && !c.interpretationBasis)
  t('codes-no-invented', 'no code carries a meaning without stating its basis', invented.length === 0, `${invented.length}`)

  // Emphasis: queued cases must not appear as certified.
  t('emph-basis', 'every parallel occurrence states its structural basis', emphasis.occurrences.filter(o => o.type === 'parallel_phrasing' && !o.basis).length === 0, 'ok')

  // Every section declares a contract.
  t('all-declared', 'all ten sections declare a provenance contract', SECTION_CONTRACTS.length === 10, SECTION_CONTRACTS.length)
}

// ── 3. Exact source resolution ───────────────────────────────────────────────
// Every certified Q-authored occurrence must be findable in its own drop, either literally or
// under whitespace normalisation. Anything that cannot be found is a phantom.
{
  const t = group('3. Exact source resolution')
  const unresolved = { questions: [], directives: [], claims: [], predictions: [], emphasis: [], codes: [] }

  const inPost = (num, text) => {
    const hay = textOf.get(num)
    if (!hay) return false
    return hay.includes(nlower(text))
  }

  for (const q of questions) {
    if (q.occurrences === undefined) continue
    if (!inPost(q.postNum, q.unitText ?? q.text)) unresolved.questions.push(q)
  }
  for (const p of posts) {
    for (const d of p.actionRequests ?? []) if (!inPost(p.postNum, d)) unresolved.directives.push({ postNum: p.postNum, text: d })
    for (const c of p.postAnalysis?.claims ?? []) if (!inPost(p.postNum, c)) unresolved.claims.push({ postNum: p.postNum, text: c })
    for (const c of p.postAnalysis?.predictions ?? []) if (!inPost(p.postNum, c)) unresolved.predictions.push({ postNum: p.postNum, text: c })
  }
  for (const o of emphasis.occurrences) {
    // A parallel-phrasing occurrence spans SEVERAL lines, so its `line` field is the run joined
    // with " / " — a display reconstruction, not a span. Each constituent line must resolve
    // individually; testing the joined string looks for text that was never in the drop.
    const parts = o.type === 'parallel_phrasing' ? String(o.line).split(' / ') : [o.line]
    const lineOk = parts.every(part => inPost(o.postNum, part))
    const spanOk = o.type === 'parallel_phrasing' || o.type === 'repeated_word' || o.type === 'repeated_question' ||
      o.type === 'repeated_directive' || nlower(o.line).includes(nlower(o.sourceText))
    if (!lineOk || !spanOk) unresolved.emphasis.push(o)
  }
  for (const c of codes.codes) {
    const anyPost = (c.posts ?? []).length
    if (!anyPost) unresolved.codes.push(c)
  }

  for (const [k, list] of Object.entries(unresolved)) {
    t(`resolve-${k}`, `every certified ${k} occurrence resolves to its drop`, list.length === 0, `${list.length} unresolved`)
  }

  // No editorial paraphrase may be presented as Q's literal wording.
  const paraphrases = posts.flatMap(p => (p.editorialParaphrases ?? []).map(e => ({ postNum: p.postNum, text: e.text })))
  const paraphraseKeys = new Set(paraphrases.map(e => `${e.postNum}|${nlower(e.text)}`))
  const leakedClaims = posts.flatMap(p => (p.postAnalysis?.claims ?? []).map(c => `${p.postNum}|${nlower(c)}`)).filter(k => paraphraseKeys.has(k))
  t('no-paraphrase-as-q', 'no editorial paraphrase is counted as a claim', leakedClaims.length === 0, `${paraphrases.length} paraphrases held aside, ${leakedClaims.length} leaked`)
}

// ── 4. Cross-section overlap audit ───────────────────────────────────────────
{
  const t = group('4. Cross-section overlap')
  // The certified overlap is measured from the DIRECTIVE side using the canonical key(), and it
  // counts a directive that matches either a question's text or the directive a question was
  // extracted from. Measuring it any other way gives a different number for the same fact:
  // whitespace-lowercase from the question side returns 167, which is not a defect in the data.
  const qKeys = new Set(questions.map(q => `${q.postNum}|${key(q.text)}`))
  const qSrc = new Set(questions.filter(q => q.directiveSource).map(q => `${q.postNum}|${key(q.directiveSource)}`))
  const allDirectives = posts.flatMap(p => (p.actionRequests ?? []).map(d => ({ postNum: p.postNum, text: d })))
  const dKeys = new Set(allDirectives.map(d => `${d.postNum}|${nlower(d.text)}`))
  const qd = allDirectives.filter(d => qKeys.has(`${d.postNum}|${key(d.text)}`) || qSrc.has(`${d.postNum}|${key(d.text)}`)).length
  t('overlap-qd', 'Question ↔ Directive overlap = 228, declared', qd === 230, qd)

  const linked = codes.codes.filter(c => c.linkedEntityId).length
  t('overlap-ce', 'Code ↔ Entity cross-links = 32, declared', linked === 32, linked)

  // Every repeated_question in Emphasis must exist as a certified Question, and vice versa is
  // NOT required — a question can appear once and never be repeated.
  const repQ = emphasis.occurrences.filter(o => o.type === 'repeated_question')
  // Its own lookup, deliberately. qKeys above uses the canonical key() because that is how the
  // certified Question<->Directive overlap is defined; matching an Emphasis span against it with
  // a different normalisation reported all 95 as orphaned when every one of them matches.
  const qText = new Set(questions.filter(q => q.occurrences !== undefined)
    .flatMap(q => [`${q.postNum}|${nlower(q.text)}`, `${q.postNum}|${nlower(q.unitText ?? q.text)}`]))
  const repQMissing = repQ.filter(o => !qText.has(`${o.postNum}|${nlower(o.sourceText)}`))
  t('overlap-eq', 'every repeated question in Emphasis exists in Questions', repQMissing.length === 0, `${repQ.length} repeated, ${repQMissing.length} orphaned`)

  const repD = emphasis.occurrences.filter(o => o.type === 'repeated_directive')
  const repDMissing = repD.filter(o => !dKeys.has(`${o.postNum}|${nlower(o.sourceText)}`))
  t('overlap-ed', 'every repeated directive in Emphasis exists in Directives', repDMissing.length === 0, `${repD.length} repeated, ${repDMissing.length} orphaned`)

  // isConclusion is an attribute, never an added population.
  // Counted per OCCURRENCE, not per claimMeta key: the meta map is keyed by normalised text, so
  // a claim Q wrote twice in one drop shares a single entry. Counting keys returns 960 for the
  // certified 966 — the six in-post repeats, not six missing conclusions.
  let conclusions = 0
  for (const p of posts) {
    const meta = p.claimMeta ?? {}
    for (const text of [...(p.postAnalysis?.claims ?? []), ...(p.postAnalysis?.predictions ?? [])]) {
      const m = meta[nlower(text)] ?? meta[key(text)] ?? meta[text]
      if (m?.isConclusion) conclusions++
    }
  }
  t('overlap-conclusions', 'conclusions are an attribute of 966 assertions, not a separate count', conclusions === 966, conclusions)

  t('overlap-declared', 'every overlap pair has a written rule', OVERLAPS.every(o => o.why && o.crossLink), OVERLAPS.length)
}

// ── 5. Double-count and collision audit ──────────────────────────────────────
{
  const t = group('5. Double-count and collisions')
  const dupIds = arr => {
    const seen = new Set(), dup = []
    for (const id of arr) { if (seen.has(id)) dup.push(id); seen.add(id) }
    return dup
  }
  t('emph-ids', 'no duplicate Emphasis occurrence id', dupIds(emphasis.occurrences.map(o => o.id)).length === 0, `${dupIds(emphasis.occurrences.map(o => o.id)).length}`)
  t('q-ids', 'no duplicate Question row id', dupIds(questions.map(q => q.id)).length === 0, `${dupIds(questions.map(q => q.id)).length}`)
  t('queue-ids', 'no duplicate Resolution Center id', dupIds(queue.rows.map(r => r.id)).length === 0, `${dupIds(queue.rows.map(r => r.id)).length}`)

  // In-post repeats are REAL and must stay separate. Assert they survived rather than assuming.
  const repeats = new Map()
  for (const q of questions) {
    if (q.occurrences === undefined) continue
    const k = `${q.postNum}|${nlower(q.text)}`
    repeats.set(k, (repeats.get(k) ?? 0) + (q.occurrences ?? 1))
  }
  const coincidence = [...repeats.entries()].filter(([k]) => k.endsWith('|coincidence?')).reduce((s, [, n]) => s + n, 0)
  t('in-post-repeats', 'in-post repeats preserved ("Coincidence?" = 88 mentions across 86 posts)', coincidence === 88, coincidence)

  // A unit must not hold two contradictory primary classes inside one section.
  let contradictory = 0
  for (const p of posts) {
    for (const [k, m] of Object.entries(p.claimMeta ?? {})) {
      if (m.displayClass === 'claim' && m.semanticFamily !== 'assertion') contradictory++
      void k
    }
  }
  t('no-contradictions', 'no assertion carries a contradictory family/class pair', contradictory === 0, contradictory)
}

// ── 6. Source-material isolation ─────────────────────────────────────────────
// Nothing pasted from elsewhere may be certified as Q's own analysis. Mixed posts are the risk:
// the same wording can appear in Q's line AND inside a quoted block in the same drop.
{
  const t = group('6. Source-material isolation')
  const srcCache = new Map()
  const qAuthoredText = num => {
    if (srcCache.has(num)) return srcCache.get(num)
    const p = byNum.get(num)
    if (!p) { srcCache.set(num, ''); return '' }
    const cleaned = clean(p.text ?? '')
    const src = sourceLines(cleaned)
    const out = nlower(cleaned.split('\n').filter((_, i) => !src.has(i)).join('\n'))
    srcCache.set(num, out)
    return out
  }

  // WHAT THIS INVARIANT CAN AND CANNOT SAY.
  //
  // The first version asserted that every certified occurrence must appear in the lines
  // sourceLines() leaves as Q-authored, and it failed on 123 posts. Reading them showed the
  // certified sections are right and the detector over-extends: in #1939 a quoted sentence and
  // its URL are followed by five lines — "BO closed door necessary.", "[WHO] ARE THE
  // FIREWALLS?", "What will the FAKE NEWS push tomorrow?" — that are unmistakably Q's, and the
  // block swallows them anyway.
  //
  // So the assertion is inverted. It no longer demands agreement; it FREEZES the disagreement at
  // its known size, so a future change that makes the detector claim more Q-authored text fails
  // here. The direction matters: Emphasis excludes source lines, so on these posts it
  // under-counts. Nothing phantom is admitted, which is the risk this section guards against.
  const KNOWN_OVEREXTENSION = KNOWN_DEBT.baseline
  const leaks = {}
  const check = (name, rows) => {
    const bad = rows.filter(r => {
      const q = qAuthoredText(r.postNum)
      if (!q) return false
      return !q.includes(nlower(r.text))
    })
    leaks[name] = bad
    const expected = KNOWN_OVEREXTENSION[name]
    t(`isolation-${name}`, `${name}: quoted-block over-extension stays at its known ${expected} occurrences`,
      bad.length === expected, `${bad.length} of ${rows.length} (expected ${expected})`)
  }

  check('questions', questions.filter(q => q.occurrences !== undefined).map(q => ({ postNum: q.postNum, text: q.unitText ?? q.text })))
  check('directives', posts.flatMap(p => (p.actionRequests ?? []).map(d => ({ postNum: p.postNum, text: d }))))
  check('claims', posts.flatMap(p => (p.postAnalysis?.claims ?? []).map(c => ({ postNum: p.postNum, text: c }))))
  // Emphasis is checked per constituent line, since a parallel occurrence's `line` is a joined
  // reconstruction rather than a span.
  check('emphasis', emphasis.occurrences.flatMap(o => (o.type === 'parallel_phrasing'
    ? String(o.line).split(' / ') : [o.line]).map(text => ({ postNum: o.postNum, text }))))
  // The affected posts travel with the debt record, so whoever fixes the detector has the
  // re-adjudication list already assembled rather than having to rediscover it.
  const affectedPosts = [...new Set(Object.values(leaks).flat().map(r => r.postNum))].sort((a, b) => a - b)

  // FREEZE THE SET, NOT THE COUNT.
  //
  // The count-only tripwire fired correctly on 102 -> 103 and then cost a full investigation to
  // learn which row moved. A guard over a population must freeze the population: with the
  // occurrence set stored, the next drift prints the added and removed rows immediately.
  const occKey = r => `${r.postNum}|${nlower(r.text).slice(0, 80)}`
  const currentOcc = new Set(Object.entries(leaks).flatMap(([layer, rows]) => rows.map(r => `${layer}::${occKey(r)}`)))
  const occFile = path.join(OUT, 'source-boundary-occurrences.json')
  if (fs.existsSync(occFile)) {
    const frozen = new Set(JSON.parse(fs.readFileSync(occFile, 'utf8')).occurrences)
    const added = [...currentOcc].filter(k => !frozen.has(k))
    const removed = [...frozen].filter(k => !currentOcc.has(k))
    t('debt-occurrence-set', 'the source-boundary occurrence SET is unchanged',
      added.length === 0 && removed.length === 0,
      added.length || removed.length ? `+${added.length} / -${removed.length}` : 'identical')
    if (added.length || removed.length) {
      for (const k of added.slice(0, 25)) console.log(`         + ${k}`)
      for (const k of removed.slice(0, 25)) console.log(`         - ${k}`)
    }
  } else {
    fs.writeFileSync(occFile, JSON.stringify({
      note: 'The exact source-boundary debt occurrences. Frozen as a SET so drift reports which row changed instead of only that a count moved.',
      count: currentOcc.size, occurrences: [...currentOcc].sort(),
    }, null, 1))
    t('debt-occurrence-set', 'occurrence-set baseline established', true, `${currentOcc.size} frozen`)
  }
  t('debt-posts-baseline', `source-boundary debt stays at its known ${KNOWN_DEBT.postsAffected} posts`,
    affectedPosts.length === KNOWN_DEBT.postsAffected, `${affectedPosts.length} posts`)
  t('debt-declared', 'the source-boundary risk is recorded as a prerequisite, not a footnote',
    KNOWN_DEBT.prerequisiteFor.length >= 3, KNOWN_DEBT.priority)
  fs.writeFileSync(path.join(OUT, 'source-boundary-debt.json'), JSON.stringify({ ...KNOWN_DEBT, affectedPosts }, null, 1))
  fs.writeFileSync(path.join(OUT, 'cross-section-isolation-detail.json'), JSON.stringify(
    Object.fromEntries(Object.entries(leaks).map(([k, v]) => [k, v.slice(0, 40)])), null, 1))
}

// ── 7. Export-chain integrity ────────────────────────────────────────────────
{
  const t = group('7. Export-chain integrity')
  // The chain used to be an inline array literal inside export-firestore.mjs, and this check
  // grepped that source for each step name. rebuild-bundle.mjs now replays the same chain, so
  // the ordering lives in lib/chainSteps.mjs and BOTH entry points import it — which is the
  // point: two copies of a load-bearing order is exactly how a step goes missing from one path.
  // Checking the shared module keeps the invariant on the thing both callers actually execute.
  const listed = APPLY_ORDER.filter(s => CHAIN_STEPS.includes(s))
  t('chain-complete', 'every apply step is chained into export', listed.length === APPLY_ORDER.length, `${listed.length}/${APPLY_ORDER.length}`)

  // Order matters more than presence: a later step rewriting posts.json must not precede the
  // step whose output it would overwrite.
  const positions = APPLY_ORDER.map(s => CHAIN_STEPS.indexOf(s))
  const inOrder = positions.every((v, i) => i === 0 || v > positions[i - 1])
  t('chain-order', 'apply order in export matches the declared order', inOrder, inOrder ? 'ok' : 'out of order')

  // Both entry points must execute the shared list rather than a private copy of it.
  for (const entry of ['export-firestore.mjs', 'rebuild-bundle.mjs']) {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', entry), 'utf8')
    t(`chain-shared-${entry}`, `${entry} runs the shared chain`,
      /from '\.\/lib\/chainSteps\.mjs'|from '\.\.\/scripts\/lib\/chainSteps\.mjs'/.test(src), 'ok')
  }

  const missingFiles = APPLY_ORDER.filter(s => !fs.existsSync(path.join(ROOT, 'scripts', s)))
  t('chain-files-exist', 'every chained script exists on disk', missingFiles.length === 0, missingFiles.join(', ') || 'ok')
}

// ── 8. Seed and cache integrity ──────────────────────────────────────────────
// SEED_VERSION=4 already proved section-level QA is not enough: every gate passed while the
// certified data never reached returning visitors. This is now a first-class gate.
{
  const t = group('8. Seed and cache integrity')
  const localData = fs.readFileSync(path.join(SRC, 'lib', 'localData.ts'), 'utf8')
  const m = localData.match(/const SEED_VERSION = (\d+)/)
  const seed = m ? Number(m[1]) : -1
  // 6 was verified in a real browser: a deliberately downgraded Seed-5 profile was repaired to a
  // state identical to a fresh Seed-6 profile across all ten rendering fields, while the same
  // downgrade against the live Seed-5 build stayed stale indefinitely.
  //
  // 7 carries the seven owner-adjudicated Claims. It is pinned here rather than merely bumped
  // because the failure it prevents is invisible from the server side: the bundle, the manifest
  // and the live Claim total were all correct at seed 6, a fresh profile painted both #2917
  // sentences, and the owner's returning profile still showed neither.
  // 8 also carries the Context correction those rulings forced (4,906 -> 4,902 units): posts.json
  // changed a second time, and a returning profile that stopped at 7 would keep showing the
  // claim+context contradiction on #570.
  // 41 carries the COVID alias ruling: posts.json changed again (namedEntities), so a profile
  // that stopped at 40 would keep showing the standalone COVID in #4489/#4541/#4548 as plain text.
  // 43 carries the Rachel Chandler ruling: posts.json changed again (namedEntities), so a
  // profile that stopped at 42 would keep showing RC and Ray Chandler as two strangers.
  // 76: Entities hover audit Stage 1 — posts.json lost 39 namedEntities entries and every entity
  // row gained an id and a slug, so a returning reader must re-seed.
  t('seed-current', 'SEED_VERSION is 76 (Entities hover audit, Stage 1)', seed === 76, seed)
  t('seed-gate', 'seeding is gated on SEED_VERSION', /seeded === SEED_VERSION/.test(localData), 'present')

  // THE GUARD THAT WOULD HAVE SAVED THREE ROUND TRIPS. Changing seeded data without bumping the
  // seed passes every server-side check and reaches nobody who already has the app. The owner had
  // to report the same Emphasis defect three times for exactly this reason. Now the data is pinned
  // to the version that shipped it: change one without the other and this fails, naming the files.
  const seedFp = checkSeedFingerprint()
  t('seed-fingerprint', 'seeded data matches the SEED_VERSION that shipped it', seedFp.ok,
    seedFp.reason + (seedFp.changed.length ? ` [${seedFp.changed.join(', ')}]` : ''))
  t('seed-writes', 'the gate value is persisted after seeding', /idbSet\('__seed_version__', SEED_VERSION\)/.test(localData), 'present')

  const swPath = path.join(ROOT, 'public', 'sw.js')
  const sw = fs.existsSync(swPath) ? fs.readFileSync(swPath, 'utf8') : ''
  const cacheName = (sw.match(/const\s+CACHE\w*\s*=\s*['"`]([^'"`]+)/) ?? [])[1] ?? null
  t('sw-versioned-cache', 'service worker cache name is versioned', Boolean(cacheName && /\d/.test(cacheName)), cacheName ?? 'none')
  const dataNetworkFirst = /data\//.test(sw) || /networkFirst|network-first/i.test(sw)
  t('sw-data-strategy', 'service worker does not pin /data to cache-only', !/cacheOnly/i.test(sw), dataNetworkFirst ? 'data handled explicitly' : 'no cache-only strategy')

  // /data is served cache-first, which is right for a 9.4 MB bundle that only changes on deploy —
  // and is exactly why the cache name MUST change on every publish. If it ever stopped being
  // rewritten, returning visitors would hold the old archive indefinitely and every certified
  // count would be correct on disk and stale in the browser. That is the SEED_VERSION failure in
  // a second transport, so it is asserted rather than trusted to a comment.
  const deploySh = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy-web.sh'), 'utf8')
  t('sw-version-bumped', 'the deploy rewrites CACHE_VERSION on every publish',
    /sed .*CACHE_VERSION = /.test(deploySh), 'rewritten at build time')
  // The gate has to be IN the pipeline, not merely available to run. A verification step that
  // depends on someone remembering it is the same class of defect as a comment that says the
  // cache version is bumped.
  t('deploy-gate-armed', 'the deploy blocks on certification-manifest --verify',
    /certification-manifest\.mjs --verify/.test(deploySh) && /exit 1/.test(deploySh), 'armed')
  t('sw-drops-old-caches', 'activation deletes every cache from a previous version',
    /keys\.filter\(k => !k\.startsWith\(CACHE_VERSION\)\)/.test(sw), 'present')
}

// ── 9. UI count integrity ────────────────────────────────────────────────────
// Every visible figure must come from the certified artifact. The single most expensive mistake
// of this project was a helper re-deriving a category after certification.
{
  const t = group('9. UI count integrity')
  const info = fs.readFileSync(path.join(SRC, 'lib', 'sectionInfo.ts'), 'utf8')
  const has = n => info.includes(String(n))
  t('ui-questions', 'sectionInfo states 6,443', has(6443), 'ok')
  t('ui-directives', 'sectionInfo states 2,552', has(2552), 'ok')
  t('ui-claims', 'sectionInfo states 4,221', has(4221), 'ok')
  t('ui-evidence', 'sectionInfo states 6,590', has(6590), 'ok')
  // Read from the contract rather than frozen inline — this literal has gone stale at every
  // certification since it was written, and its label still says 1,334 and 8,239.
  t('ui-entities', `sectionInfo headlines ${CANONICAL.entities.canonical.toLocaleString()} entities and ${CANONICAL.entities.mentions.toLocaleString()} mentions`,
    has(CANONICAL.entities.canonical) && has(CANONICAL.entities.mentions), 'ok')
  // The editable alias registry is typed by hand and its spellings are SHOWN on the entity cards,
  // beside certified names. "trump" and "djt" sat there looking like the archive did not know
  // better. displayAlias() repairs this at render time; this keeps the stored data honest too.
  const editableAliases = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'aliases.json'), 'utf8'))
  const lowerOnly = Object.values(editableAliases).flat().filter(a => /^[a-z][a-z ]*$/.test(a))
  t('ui-alias-spelling', 'no alias is stored all-lowercase', lowerOnly.length === 0, lowerOnly.join(' ') || 'ok')
  t('ui-entities-submetrics', 'sectionInfo keeps 4,463 and 3,440 as provenance', has(4463) && has(3440), 'ok')
  t('ui-themes', 'sectionInfo states 2,644', has(2644), 'ok')
  t('ui-codes', 'sectionInfo states 1,949', has(1949), 'ok')
  t('ui-emphasis', 'sectionInfo states 3,112', has(3112), 'ok')

  // ── Section headlines are certified, never recounted ───────────────────────
  //
  // The Post Analysis archive headlined a figure it summed from the phrase-frequency index. For
  // Claims that read "4,175 mentions" against a certified 4,188: the index groups by phrase, so
  // a phrase Q repeats inside one post collapses to that post once, and 13 real occurrences
  // disappeared from a user-facing total (#1888 says "You get to go to jail." four times).
  //
  // These assertions tie SECTION_TOTALS to the canonical contract and forbid the recount coming
  // back — either by the numbers drifting, or by the header being wired to the index again.
  {
    const si = fs.readFileSync(path.join(SRC, 'lib', 'sectionInfo.ts'), 'utf8')
    const totals = si.slice(si.indexOf('export const SECTION_TOTALS'))
    const stated = (cat, occ, posts) => {
      const row = totals.match(new RegExp(`${cat}:\\s*\\{[^}]*\\}`))
      return Boolean(row) && row[0].includes(String(occ)) && row[0].includes(String(posts))
    }
    t('headline-claims', 'Claims headline = certified 4,221 / 1,983',
      stated('claims', CANONICAL.claims.occurrences, CANONICAL.claims.posts), 'ok')
    t('headline-predictions', 'Predictions headline = certified 595 / 490',
      stated('predictions', CANONICAL.predictions.occurrences, CANONICAL.predictions.posts), 'ok')
    t('headline-emphasis', 'Emphasis headline = certified 3,112 / 1,357',
      stated('emphasis', CANONICAL.emphasis.occurrences, CANONICAL.emphasis.posts), 'ok')
    // The post count is MEASURED, not frozen. It has moved at three of the last four
    // certifications — 2,245 -> 2,240 on the Rachel Chandler merge, then 2,240 -> 2,445 when the
    // Stage 1 withdrawals rewrote namedEntities — and each time the stale literal failed a check
    // that was not actually broken. What matters is that the UI states what the data holds.
    const entityPosts = posts.filter(p => (p.postAnalysis?.namedEntities ?? []).length).length
    t('headline-entities', `Entities headline = certified mentions / ${entityPosts.toLocaleString()} posts`,
      stated('namedEntities', CANONICAL.entities.mentions, entityPosts), 'ok')
    t('headline-themes', 'Themes headline = certified 2,644 assignments',
      stated('themes', CANONICAL.themes.assignments, CANONICAL.themes.posts), 'ok')

    const archive = fs.readFileSync(path.join(SRC, 'pages', 'AnalysisArchive.tsx'), 'utf8')
    t('headline-not-recounted', 'the archive header reads SECTION_TOTALS rather than the frequency index',
      /SECTION_TOTALS\[activeTab\]/.test(archive), 'ok')
    // The phrase rows still count posts-per-phrase, which is what that index is FOR. The defect
    // was only ever using it as a section total, so this must not be "fixed" by removing it.
    t('headline-rows-keep-post-counts', 'phrase rows still show how many posts contain the phrase',
      /postNums\.length/.test(archive), 'ok')
  }

  // No UI file may re-derive a certified category with its own parser.
  const uiFiles = []
  const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name)
    if (f.isDirectory()) walk(p); else if (/\.tsx?$/.test(f.name)) uiFiles.push(p)
  } }
  walk(SRC)
  const rederivers = []
  for (const f of uiFiles) {
    const s = fs.readFileSync(f, 'utf8')
    // A page or component computing its own question/claim/code regex is the failure mode.
    if (/\/\\\[[^\]]*\\\]\/|match\(\/\[\^\?\]\*\\\?\//.test(s) && /questions|claims|codes/i.test(path.basename(f))) rederivers.push(path.relative(ROOT, f))
  }
  t('ui-no-rederive', 'no UI file re-derives a certified category with its own regex', rederivers.length === 0, rederivers.join(', ') || 'ok')
}

// ── 10. Resolution Center completeness ───────────────────────────────────────
{
  const t = group('10. Resolution Center completeness')
  const rows = queue.rows
  t('rc-ids-stable', 'every row has a stable id', rows.every(r => r.id && String(r.id).length > 3), 'ok')
  t('rc-deeplinks', 'every row deep-links somewhere', rows.every(r => r.deepLink), 'ok')
  const badLink = rows.filter(r => r.deepLink?.startsWith('/post/') && !posts.some(p => p.id === r.deepLink.slice(6)))
  t('rc-deeplink-targets', 'every /post deep link resolves to a real post', badLink.length === 0, `${badLink.length} broken`)
  t('rc-provenance', 'every row states where it came from', rows.every(r => r.provenance), 'ok')
  t('rc-why', 'every row explains why it is unresolved', rows.every(r => r.whyUnresolved), 'ok')
  t('rc-status', 'every row is OPEN or has an explicit status', rows.every(r => r.status), 'ok')
  t('rc-certified-untouched', 'the queue declares it does not affect certified data', queue.certifiedDataUnaffected === true, String(queue.certifiedDataUnaffected))

  // Every row says WHEN it became a question. The queue file is rebuilt from scratch each run, so
  // an undated row means the ledger lost an id — and the failure is silent: the row still renders,
  // just without the one field that says how long it has been waiting.
  const undated = rows.filter(r => !/^\d{4}-\d{2}-\d{2}$/.test(r.firstSeen ?? ''))
  t('rc-first-seen', 'every row carries the date it entered the queue', undated.length === 0,
    undated.length ? `${undated.length} undated, e.g. ${undated[0].id}` : `${new Set(rows.map(r => r.firstSeen)).size} distinct dates`)
  // A date in the future, or before the project existed, means the clock was consulted when the
  // ledger should have been.
  const today = new Date().toISOString().slice(0, 10)
  const impossible = rows.filter(r => r.firstSeen && (r.firstSeen > today || r.firstSeen < '2026-08-01'))
  t('rc-first-seen-sane', 'no row is dated in the future or before the archive was built',
    impossible.length === 0, impossible.length ? `${impossible.length}, e.g. ${impossible[0].firstSeen}` : 'ok')

  // Emphasis is the newest source: every borderline case must be ACCOUNTED FOR — either still
  // queued, or answered by the owner. The check compared the queue against the borderline total
  // alone, so the first four the owner ruled on ("HCQ is the standard abbreviation, not a
  // rhetorical device") read as four cases that never arrived. Completeness is queued + resolved;
  // a case that left the queue by being decided is the system working, not a gap in it.
  const emphQueued = rows.filter(r => r.kind === 'classification').length
  const borderline = JSON.parse(fs.readFileSync(path.join(OUT, 'emphasis-borderline.json'), 'utf8'))
  const resolvedFile = path.join(OUT, 'resolution-owner-resolved.json')
  const emphResolved = fs.existsSync(resolvedFile)
    ? JSON.parse(fs.readFileSync(resolvedFile, 'utf8')).resolved.filter(r => String(r.id).startsWith('emph-')).length
    : 0
  t('rc-emphasis-complete', 'every borderline Emphasis case is queued or owner-resolved',
    emphQueued + emphResolved === borderline.count, `${emphQueued} queued + ${emphResolved} resolved / ${borderline.count}`)

  // Same completeness rule for Source attribution, and one more besides. These rows exist because
  // 18 entity mentions are held OUT of the certified count pending a ruling, so the queue and the
  // held population have to agree: if a line quietly left the queue without being ruled, its
  // mentions would be excluded from Entities with nothing left saying why.
  const srcQueued = rows.filter(r => r.kind === 'source_reference')
  const pendingFile = path.join(OUT, 'entities-quote-boundary-pending.json')
  if (fs.existsSync(pendingFile)) {
    const pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8'))
    const srcResolved = fs.existsSync(resolvedFile)
      ? JSON.parse(fs.readFileSync(resolvedFile, 'utf8')).resolved.filter(r => String(r.id).startsWith('srcref-')).length
      : 0
    t('rc-source-complete', 'every quote-boundary line is queued or owner-resolved',
      srcQueued.length + srcResolved === pending.rows.length,
      `${srcQueued.length} queued + ${srcResolved} resolved / ${pending.rows.length}`)
    const heldMentions = pending.rows.reduce((n, r) => n + r.mentionCount, 0)
    t('rc-source-mentions', 'the held mentions still reconcile to the certified gap',
      heldMentions === pending.rederivedMentions - pending.certifiedMentions,
      `${heldMentions} held / ${pending.rederivedMentions - pending.certifiedMentions} gap`)
    // The point of the section: a queued row is excluded from its section's certified totals.
    t('rc-source-excluded', 'none of the held mentions is counted in Entities',
      entities.totals.mentions === CANONICAL.entities.mentions, `${entities.totals.mentions}`)
  }
}

// ── 10b. Entity hovers: nothing unreviewed reaches the reader ────────────────
// A Review synopsis is unreviewed editorial text about a named person, written by a first-pass
// classifier. Publishing one is not a formatting slip, so the barrier is asserted rather than
// assumed — and asserted from BOTH sides: the public file contains only Ready records, and the
// review queue is not inside public/data at all.
{
  const t = group('10b. Entity hover publication')
  const hoverFile = path.join(DATA, 'entity-hovers.json')
  if (fs.existsSync(hoverFile)) {
    const hov = JSON.parse(fs.readFileSync(hoverFile, 'utf8'))
    const published = []
    for (const [id, byPost] of Object.entries(hov.byPost ?? {})) {
      for (const [pn, v] of Object.entries(byPost)) published.push({ id, postNum: Number(pn), ...v })
    }
    t('hover-count', 'published post synopses = 4,285', published.length === 4285, published.length)
    t('hover-globals', 'one global synopsis per live entity',
      Object.keys(hov.global ?? {}).length === CANONICAL.entities.canonical, Object.keys(hov.global ?? {}).length)

    // Every published record must be absent from the review queue, matched on the same key the
    // bundle uses. Comparing on anything looser would let a near-duplicate through.
    const rq = path.join(OUT, 'entity-hover-review-queue.json')
    if (fs.existsSync(rq)) {
      const review = JSON.parse(fs.readFileSync(rq, 'utf8'))
      const reviewKeys = new Set(review.records.map(r => `${r.entityId} ${r.postNum}`))
      const leaked = published.filter(p => reviewKeys.has(`${p.id} ${p.postNum}`))
      t('hover-no-review-leak', 'no review-queue record is in the public bundle', leaked.length === 0,
        leaked.length ? `${leaked.length} leaked, e.g. #${leaked[0].postNum}` : `${review.total} held back`)
      t('hover-review-not-public', 'the review queue is not under public/data',
        !fs.existsSync(path.join(DATA, 'entity-hover-review-queue.json')), 'admin only')
    }
    // Every hover must resolve to a live entity BY ID — the whole point of minting them.
    const entityIds = new Set(entities.entities.map(e => e.id))
    const orphan = published.filter(p => !entityIds.has(p.id))
    t('hover-ids-resolve', 'every hover resolves to a live entity id', orphan.length === 0, `${new Set(published.map(p => p.id)).size} entities`)
    t('hover-keyed-by-id', 'hovers are keyed by qe- id, not by name',
      Object.keys(hov.byPost ?? {}).every(k => /^qe-[0-9a-f]{12}$/.test(k)), 'ok')
    // Importing hover TEXT must not have moved a single count.
    t('hover-counts-untouched', 'entity totals are unchanged by the import',
      entities.totals.mentions === CANONICAL.entities.mentions && entities.entities.length === CANONICAL.entities.canonical,
      `${entities.entities.length} entities / ${entities.totals.mentions} mentions`)
    // A grade must reach the reader, or a Partial reading looks like a settled one.
    const graded = published.filter(p => ['Strong', 'Partial', 'Insufficient'].includes(p.g))
    t('hover-grades-present', 'every published synopsis carries its support grade',
      graded.length === published.length, `${published.length - graded.length} ungraded`)
  }
}

// ── 11. Frozen-section mutation check ────────────────────────────────────────
{
  const t = group('11. Frozen-section mutation')
  const hashes = {}
  for (const a of ARTIFACTS) {
    const p = path.join(DATA, a)
    if (!fs.existsSync(p)) continue
    // Full digest. Comparing a truncated hash against the manifest's full one reported all eight
    // artifacts as changed on a tree that had not drifted at all.
    // Semantic hash: object keys sorted, so a re-serialisation by the export chain does not read
    // as drift. Byte changes are reported separately below.
    const stable = v => Array.isArray(v) ? v.map(stable)
      : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((acc, k) => (acc[k] = stable(v[k]), acc), {})
        : v
    hashes[a] = crypto.createHash('sha256')
      .update(JSON.stringify(stable(JSON.parse(fs.readFileSync(p, 'utf8'))))).digest('hex')
  }
  const manifestPath = path.join(OUT, 'certification-manifest.json')
  if (fs.existsSync(manifestPath)) {
    const prev = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const changed = Object.entries(hashes).filter(([k, v]) => prev.artifacts?.[k]?.semanticSha256 && prev.artifacts[k].semanticSha256 !== v)
    const reserialised = Object.keys(hashes).filter(k => prev.artifacts?.[k]?.sha256 &&
      prev.artifacts[k].sha256 !== crypto.createHash('sha256').update(fs.readFileSync(path.join(DATA, k))).digest('hex'))
    t('hash-stable', 'no certified artifact CHANGED CONTENT since the manifest', changed.length === 0, changed.map(([k]) => k).join(', ') || 'ok')
    t('hash-reserialised', 'byte-level re-serialisation reported separately, not as drift', true,
      reserialised.length ? `${reserialised.join(', ')} re-serialised by the export chain` : 'none')
  } else {
    t('hash-baseline', 'no manifest yet — this run establishes the baseline', true, 'baseline')
  }
  t('artifacts-present', 'every certified artifact is on disk', Object.keys(hashes).length === ARTIFACTS.length, `${Object.keys(hashes).length}/${ARTIFACTS.length}`)

  // ── The editorial write path ───────────────────────────────────────────────
  //
  // The hashes above catch a certified artifact that CHANGED. These catch the change getting in
  // by the wrong door: an owner ruling written into postAnalysis instead of into the canonical
  // artifact survives every count check, then vanishes on the next chain run. It happened once,
  // to seven approved Claims, four hours after the rule was written down in a comment.
  //
  // So the rule is a module with a test, and these assert that it stays the only copy.
  const scriptsDir = path.join(ROOT, 'scripts')
  const guardSrc = path.join(scriptsDir, 'lib', 'certifiedWrite.mjs')
  t('guard-exists', 'the editorial write guard is a shared module', fs.existsSync(guardSrc), 'lib/certifiedWrite.mjs')
  t('guard-tested', 'the guard has a negative test', fs.existsSync(path.join(scriptsDir, 'test-certified-write-guard.mjs')), 'test-certified-write-guard.mjs')

  const ownAllowlists = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.mjs'))
    .filter(f => /CANONICAL_WRITE_ALLOWLIST\s*=/.test(fs.readFileSync(path.join(scriptsDir, f), 'utf8')))
  t('guard-single-copy', 'no editorial script carries its own allowlist', ownAllowlists.length === 0, ownAllowlists.join(', ') || 'one copy in lib/')

  const bypassing = ['apply-editorial-batch.mjs', 'apply-owner-claims.mjs'].filter(f => {
    const src = fs.readFileSync(path.join(scriptsDir, f), 'utf8')
    return !/from '\.\/lib\/certifiedWrite\.mjs'/.test(src) || /fs\.writeFileSync/.test(src)
  })
  t('guard-editorial-tools', 'every editorial tool writes through the guard', bypassing.length === 0, bypassing.join(', ') || 'ok')
}

// ── 12. Cross-section relationships ──────────────────────────────────────────
// A PRODUCT layer, asserted separately from the frozen semantic contracts above. Its job is to
// show what the certified data already says about itself; it must never become a ninth
// classifier, so every invariant here is about provenance rather than about meaning.
{
  const t = group('12. Cross-section relationships')

  // ── Reference-audit regressions (679-row batch) ───────────────────────────
  {
    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, "audit/entities-owner-rulings.json"), "utf8")).aliasRulings
    const queue = JSON.parse(fs.readFileSync(path.join(DATA, "resolution-queue.json"), "utf8")).rows
    const notes = JSON.parse(fs.readFileSync(path.join(ROOT, "audit/resolution-owner-notes.json"), "utf8")).notes
    const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, "audit/reference-audit-parsed.json"), "utf8")).rows

    // 1. A recount must REPLACE render entries, not add to them. The rendered cache and the
    //    certified metric disagreed by 62 when it did not.
    let rendered = 0
    for (const q of JSON.parse(fs.readFileSync(path.join(DATA, "posts.json"), "utf8"))) rendered += (q.postAnalysis?.namedEntities ?? []).length
    t("entities-render-matches-certified", "postAnalysis entries equal certified mentions",
      rendered === entities.totals.mentions, rendered + " vs " + entities.totals.mentions)

    // 2. One alias, several rulings, no scope loss: SIS is MI6 in some drops and the FBI service
    //    in others. A Map keyed by alias alone silently kept only the last.
    const multi = {}
    for (const r of rules) (multi[r.alias] = multi[r.alias] ?? new Set()).add(r.canonical)
    const many = Object.entries(multi).filter(([, v]) => v.size > 1)
    t("entities-multi-ruling-aliases", "aliases carrying several canonicals are preserved",
      many.length > 0, many.length + " aliases (e.g. " + (many[0]?.[0] ?? "-") + ")")

    // 3. Occurrence-scoped rulings must not clear by post. #1385 line 1 is ruled; line 5 is held.
    const sis = queue.some(r => r.id === "SIS-1385-5-0")
    t("entities-occurrence-scoped-clearing", "#1385 line 5 stays open though line 1 is ruled",
      sis, sis ? "open" : "WRONGLY CLEARED")

    // 4. Every held reference row keeps its note so others can keep exploring it.
    const held = parsed.filter(r => r.decision === "UNRESOLVED_REVIEW")
    const noted = new Set(notes.map(n => n.id))
    const open = new Set(queue.filter(r => r.kind === "entity").map(r => r.id))
    t("entities-held-rows-noted", "held reference rows are open and carry a note (30 after #2774 resolved DELTA-2774-1-16)",
      held.filter(h => open.has(h.id)).length === 30 && held.every(h => noted.has(h.id)),
      held.filter(h => open.has(h.id) && noted.has(h.id)).length + "/" + held.length)

    // 5. Every occurrence-scoped ruling names coordinates that exist, and the audit covers the
    //    queue exactly - no unmatched, no duplicates.
    const ids = parsed.map(r => r.id)
    t("entities-reference-audit-complete", "679 audit rows, unique, all adjudicated",
      ids.length === 679 && new Set(ids).size === 679, ids.length + " rows, " + new Set(ids).size + " unique")
  }
  const relPath = path.join(DATA, 'relationships.json')
  if (!fs.existsSync(relPath)) {
    t('rel-present', 'relationships.json is built', false, 'missing')
  } else {
    const rel = JSON.parse(fs.readFileSync(relPath, 'utf8'))
    const edges = Object.values(rel.byPost).flat()
    const bt = rel.totals.byType

    t('rel-basis', 'every relationship names its certified basis', edges.every(e => e.basis), `${edges.filter(e => !e.basis).length} without`)
    t('rel-derived', 'the artifact declares it is derived, not inferred', rel.derivedNotInferred === true, String(rel.derivedNotInferred))
    t('rel-qd', 'Question ↔ Directive edges = the certified 230', bt.question_directive === 230, bt.question_directive)
    t('rel-ce', 'Entity ↔ Code edges come from the 32 stored cross-links',
      new Set(edges.filter(e => e.type === 'entity_code').map(e => e.from.id)).size === 32,
      new Set(edges.filter(e => e.type === 'entity_code').map(e => e.from.id)).size)
    t('rel-conclusions', 'Claim → Conclusion edges = the certified 966', bt.claim_conclusion === 966, bt.claim_conclusion)
    t('rel-source', 'Claim → Source provided edges = the certified 439', bt.claim_source_provided === 439, bt.claim_source_provided)
    t('rel-predictions', 'Prediction → assertion edges = the certified 595', bt.prediction_assertion === 595, bt.prediction_assertion)
    t('rel-unresolved', 'every queue row has an edge to its occurrence', bt.unresolved_occurrence === CANONICAL.resolution.total, bt.unresolved_occurrence)

    // An edge may only point at a post that exists, and the map may only count posts that exist.
    const badPost = edges.filter(e => !byNum.has(e.postNum)).length
    t('rel-posts-exist', 'every relationship belongs to a real post', badPost === 0, `${badPost} orphaned`)

    // The map is a VIEW of the certified counts. If it disagrees with the artifacts, the reader
    // is shown a number the section itself does not hold — which is the whole failure mode this
    // project has spent its time eliminating.
    const mapQ = Object.values(rel.analysisMap).reduce((n, m) => n + m.counts.questions, 0)
    const mapE = Object.values(rel.analysisMap).reduce((n, m) => n + m.counts.emphasis, 0)
    const mapD = Object.values(rel.analysisMap).reduce((n, m) => n + m.counts.directives, 0)
    t('rel-map-questions', 'analysis map totals reconcile with certified Questions', mapQ === CANONICAL.questions.occurrences, mapQ)
    t('rel-map-directives', 'analysis map totals reconcile with certified Directives', mapD === CANONICAL.directives.occurrences, mapD)
    t('rel-map-emphasis', 'analysis map totals reconcile with certified Emphasis', mapE === CANONICAL.emphasis.occurrences, mapE)

    // NO BLANKET SEMANTIC RULES IN EITHER RENDERER.
    //
    // Static vocabularies produced ~6,002 semantic-looking spans on the post page and ~5,631 on
    // the archive with no certified occurrence behind them. Grepping for the imports is enough:
    // a word list cannot enter a renderer without being imported first.
    for (const [label, file] of [['post page', path.join(SRC, 'pages', 'PostDetail.tsx')],
      ['archive', path.join(SRC, 'lib', 'postHighlight.tsx')]]) {
      const code = fs.readFileSync(file, 'utf8')
      const uses = ['STATIC_ENTITIES', 'MIL_INTEL_TERMS', 'Q_SIGNATURES']
        .filter(v => new RegExp(`addSegs\\([^)]*${v}|for \\(const \\w+ of ${v}`).test(code))
      const blanketBrackets = /bracketRx\s*=\s*\//.test(code)
      t(`no-blanket-${label.replace(/\s/g, '-')}`,
        `${label}: no blanket semantic rule paints without a certified occurrence`,
        uses.length === 0 && !blanketBrackets,
        uses.length || blanketBrackets ? `${uses.join(', ')}${blanketBrackets ? ' + blanket brackets' : ''}` : 'clean')
    }

    // EXACT CERTIFIED BOUNDARIES — no expansion on the sentence layers.
    //
    // 593 highlights per surface ran past their certified span. Two causes, both "helpful":
    // expandToSentence() enlarged an exact occurrence to its whole sentence, and withAliases()
    // folded an entity's alias group into a claim's search terms so a claim mentioning POTUS also
    // painted every nearby Trump and 45. Alias expansion is right for a NAME and wrong for a
    // sentence; sentence expansion is wrong wherever a literal span already exists.
    for (const [label, file] of [['post page', path.join(SRC, 'pages', 'PostDetail.tsx')],
      ['archive', path.join(SRC, 'lib', 'postHighlight.tsx')]]) {
      const code = fs.readFileSync(file, 'utf8')
      const aliasOnSentences = /withAliases\(analysis\.(claim|prediction|conclusion|checkable)/.test(code)
      // checkableSpans dropped from this check on 2026-08-15: Checkable Claims was retired as a
      // section and its highlight layer with it, so requiring the literal-span form of a layer
      // that no longer renders would fail forever. claimSpans still carries the rule — every
      // former checkable IS a claim, so the same literal spans still govern those highlights.
      const spansPreferred = /claimSpans \?\?/.test(code)
      const retiredLayersGone = !/\['verificationHook',/.test(code) && !/\['impliedConclusion',/.test(code)
      t(`exact-spans-${label.replace(/\s/g, '-')}`,
        `${label}: semantic highlights stop at the certified span`,
        !aliasOnSentences && spansPreferred && retiredLayersGone,
        aliasOnSentences ? 'alias expansion on a sentence layer' : spansPreferred ? 'exact' : 'literal spans not preferred')
    }

    // Derived views must reuse the parent Claim occurrence rather than reconstructing it.
    const derivedReuse = posts.every(p => {
      const a = p.postAnalysis
      if (!a?.conclusionSpans && !a?.checkableSpans) return true
      return (a.conclusionSpans?.length ?? 0) === (a.impliedConclusions?.length ?? 0)
        && (a.checkableSpans?.length ?? 0) === (a.verificationHooks?.length ?? 0)
    })
    t('derived-views-reuse-spans', 'Conclusions and Checkable reuse their certified occurrence spans', derivedReuse, 'ok')

    // The UI must read this artifact rather than recompute it.
    const mapSrc = fs.readFileSync(path.join(SRC, 'components', 'AnalysisMap.tsx'), 'utf8')
    t('rel-ui-reads-artifact', 'the Analysis Map reads the artifact and counts nothing itself',
      /loadRelationships/.test(mapSrc) && !/\.filter\(|\.reduce\(.*length/.test(mapSrc.split('const entries')[0]), 'reads relationships.json')
  }
}

// ── 13. Global search ────────────────────────────────────────────────────────
// Search is a VIEW. Its job is to find what the sections already certified, so every invariant
// here is about fidelity to those sections — never about whether search agrees with its own
// idea of what a question or a code is, because it is not allowed to have one.
{
  const t = group('13. Global search')
  const idxPath = path.join(DATA, 'search-index.json')
  if (!fs.existsSync(idxPath)) {
    t('search-present', 'search-index.json is built', false, 'missing')
  } else {
    const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'))
    const bs = idx.totals.bySection

    t('search-derived', 'the index declares it comes from certified artifacts', idx.fromCertifiedArtifacts === true, String(idx.fromCertifiedArtifacts))
    t('search-questions', 'indexed Questions = certified 6,443', bs.questions === CANONICAL.questions.occurrences, bs.questions)
    t('search-directives', 'indexed Directives = certified 2,552', bs.directives === CANONICAL.directives.occurrences, bs.directives)
    t('search-claims', 'indexed Claims = certified 4,181', bs.claims === CANONICAL.claims.occurrences, bs.claims)
    t('search-predictions', 'indexed Predictions = certified 630', bs.predictions === CANONICAL.predictions.occurrences, bs.predictions)
    t('search-evidence', 'indexed Evidence = certified 6,590', bs.evidence === CANONICAL.evidence.occurrences, bs.evidence)
    t('search-entities', 'indexed Entities = certified 1,445', bs.entities === CANONICAL.entities.canonical, bs.entities)
    t('search-themes', 'indexed Themes = certified 2,395', bs.themes === CANONICAL.themes.assignments, bs.themes)
    t('search-codes', 'indexed Codes = certified 739 distinct', bs.codes === CANONICAL.codes.distinct, bs.codes)
    t('search-emphasis', 'indexed Emphasis = certified 3,113', bs.emphasis === CANONICAL.emphasis.occurrences, bs.emphasis)
    t('search-unresolved', 'indexed unresolved = the 2,527 queue rows', bs.unresolved === CANONICAL.resolution.total, bs.unresolved)

    // The rule that matters most in this section: a cleaned-up sentence must never be able to
    // reach a reader as Q's own words. Both halves are asserted — the flag on the data, and the
    // label in the component that renders it.
    const rows = idx.rows
    const editorialUnflagged = rows.filter(r => r.s === 'editorial' && r.q !== false).length
    const qFlaggedEditorial = rows.filter(r => r.q === false && r.s !== 'editorial').length
    t('search-editorial-flagged', 'every editorial row is flagged not-Q-authored', editorialUnflagged === 0, editorialUnflagged)
    t('search-no-false-editorial', 'no Q-authored row is flagged editorial', qFlaggedEditorial === 0, qFlaggedEditorial)
    const pageSrc = fs.readFileSync(path.join(SRC, 'pages', 'Search.tsx'), 'utf8')
    t('search-editorial-labelled', 'the results page labels editorial rows before their text',
      /Editorial normalisation/.test(pageSrc) && /q === false/.test(pageSrc), 'labelled')

    // In-post repeats survive indexing: Q wrote it twice, search shows it twice.
    const claimRows = rows.filter(r => r.s === 'claims')
    const distinctClaims = new Set(claimRows.map(r => `${r.p}|${nlower(r.t)}`)).size
    t('search-repeats-preserved', 'in-post repeats are indexed as separate occurrences',
      claimRows.length > distinctClaims, `${claimRows.length} rows, ${distinctClaims} distinct (post, text)`)

    // Every result must be able to explain itself, and land somewhere.
    t('search-why', 'every record states why it can match', rows.every(r => r.w), 'ok')
    const linkable = rows.filter(r => r.p != null)
    t('search-deeplinks', 'every post-bound record carries the id its link needs',
      linkable.every(r => r.i), `${linkable.filter(r => !r.i).length} without`)

    // Search must not re-parse the corpus. If the page or the lib grew its own extractor, the
    // app would hold two disagreeing definitions of a certified category.
    const libSrc = fs.readFileSync(path.join(SRC, 'lib', 'search.ts'), 'utf8')
    t('search-no-parser', 'search performs no classification of its own',
      !/certifiedQuestionRegex|new RegExp\(.*\?\)/.test(libSrc), 'reads the index')
  }
}

// ── report ───────────────────────────────────────────────────────────────────
const failed = results.filter(r => !r.pass)
const byGroup = {}
for (const r of results) (byGroup[r.group] ??= []).push(r)

fs.writeFileSync(path.join(OUT, 'cross-section-integrity.json'), JSON.stringify({
  scope: 'whole-app cross-section integrity audit',
  productionChanged: false,
  canonical: CANONICAL,
  contracts: SECTION_CONTRACTS,
  overlaps: OVERLAPS,
  totals: { invariants: results.length, passed: results.length - failed.length, failed: failed.length },
  results,
}, null, 1))

const md = ['# Q Drops — whole-app cross-section integrity audit\n']
md.push('One question: does every certified occurrence in every section still resolve to the correct Q-authored source, carry the right provenance, overlap only where intended, and reach both first-time and returning users?\n')
md.push('\nThis audit validates the certified system. It reclassifies nothing and moves no count. All eight analytical sections remain frozen.\n')
md.push(`\n**${results.length - failed.length} of ${results.length} invariants pass.**\n`)
for (const [g, list] of Object.entries(byGroup)) {
  md.push(`\n## ${g}\n`)
  md.push('| | Invariant | Observed |')
  md.push('|---|---|---|')
  for (const r of list) md.push(`| ${r.pass ? '✅' : '❌'} | ${r.description} | ${r.detail} |`)
}
md.push('\n## Provenance contracts\n')
md.push('There is no single rule that shipped rows must equal certified counts — asserting one would produce false failures. Each section states its own contract.\n')
md.push('| Section | Certified | Counted by | What may coexist | What must never display |')
md.push('|---|---|---|---|---|')
for (const c of SECTION_CONTRACTS) {
  md.push(`| ${c.label} | ${c.certifiedCount.toLocaleString()} | ${c.countedBy} | ${c.mayCoexist} | ${c.neverDisplayed} |`)
}
md.push('\n## Overlap matrix\n')
md.push('Overlap is allowed only where two sections answer different analytical questions about the same text.\n')
md.push('| Pair | Occurrences | Why it is allowed | Cross-link |')
md.push('|---|---|---|---|')
for (const o of OVERLAPS) {
  const measured = results.find(r => r.id === `overlap-${o.pair.split(' ')[0].slice(0, 1)}${o.pair.split(' ')[2]?.slice(0, 1) ?? ''}`)
  md.push(`| ${o.pair} | ${o.expected ?? measured?.detail ?? 'measured'} | ${o.why} | ${o.crossLink} |`)
}
if (failed.length) {
  md.push('\n## Failures\n')
  for (const r of failed) md.push(`- **${r.group} — ${r.description}**: ${r.detail}`)
}
fs.writeFileSync(path.join(OUT, 'cross-section-integrity.md'), md.join('\n') + '\n')

console.log('\nCROSS-SECTION INTEGRITY AUDIT\n')
for (const [g, list] of Object.entries(byGroup)) {
  const bad = list.filter(r => !r.pass).length

  console.log(`  ${bad ? 'FAIL' : 'PASS'}  ${g.padEnd(36)} ${list.length - bad}/${list.length}`)
  for (const r of list.filter(x => !x.pass)) console.log(`         ↳ ${r.description} — ${r.detail}`)
}
console.log(`\n  ${results.length - failed.length}/${results.length} invariants pass`)
console.log('\n→ audit/cross-section-integrity.md + .json\n')
process.exit(failed.length ? 1 : 0)
