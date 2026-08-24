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
import { runtimeText } from './lib/renderedMatch.mjs'

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
// EMPHASIS IS RETIRED (owner ruling, 2026-08-21) — the section, its data and its artifact. Kept as
// an empty stand-in rather than deleted from the code, so this script keeps running and reports a
// truthful ZERO instead of crashing on a missing file.
const emphasis = { occurrences: [] }
const queue = read('resolution-queue.json')

const byNum = new Map(posts.map(p => [p.postNum, p]))
const textOf = new Map(posts.map(p => [p.postNum, nlower(clean(p.text ?? ''))]))

const results = []
const group = g => (id, description, ok, detail) => results.push({ group: g, id, description, pass: Boolean(ok), detail: String(detail) })

// ── 1. Frozen canonical counts ───────────────────────────────────────────────
{
  const t = group('1. Frozen canonical counts')
  // THE CERTIFIED POPULATION IS THE PRIMARY ONE. Step 3B-1 marks a question record `secondary`
  // when the sentence's primary category went elsewhere and `withdrawn` when the record was
  // superseded — 182 of them — and both keep their occurrences field, because the record is not
  // deleted (see "no question record deleted to move a count"). The search index, the section
  // headline and every certified total count the primary set, so this must too; counting the
  // field's presence made it report 6,503 against a certified 6,321 and call that a defect.
  const qCounted = questions.filter(q => q.occurrences !== undefined
    && (!q.semanticLayer || q.semanticLayer === 'primary'))
  const directives = posts.flatMap(p => p.actionRequests ?? [])
  const claimRows = posts.flatMap(p => (p.postAnalysis?.claims ?? []).map(c => ({ p, c })))
  const predRows = posts.flatMap(p => (p.postAnalysis?.predictions ?? []))
  const entMentions = entities.entities.reduce((s, e) => s + (e.mentions ?? 0), 0)
  const themeAssign = themes.totals?.assignments ?? 0
  const codeOcc = codes.totals?.occurrences ?? 0

  t('posts', 'posts = 4,966', posts.length === CANONICAL.posts, posts.length)
  t('questions', `Questions = ${CANONICAL.questions.occurrences.toLocaleString()} certified primary occurrences`, qCounted.length === CANONICAL.questions.occurrences, qCounted.length)
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
  // EMPHASIS IS RETIRED (owner ruling, 2026-08-21). The count gate is replaced by a RETIREMENT
  // gate: what has to stay true is not "3,111 occurrences" but "nothing regenerated it". A gate
  // asserting a retired section's figure is a gate that would go green the day the section came
  // back, which is precisely backwards.
  t('emphasis-retired', 'Emphasis is retired: no artifact, no field, no occurrence',
    !fs.existsSync(path.join(DATA, 'emphasis.json'))
      && posts.every(p => !p.postAnalysis?.emphasis?.length)
      && emphasis.occurrences.length === 0,
    fs.existsSync(path.join(DATA, 'emphasis.json')) ? 'emphasis.json is back'
      : `${posts.filter(p => p.postAnalysis?.emphasis?.length).length} posts still carry the field`)

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
  // +11 owner rulings, 2026-08-19. The 134 editorial normalisations are unchanged.
  // Derived, not written twice. This literal went stale the moment the 2026-08-20 queue ruling
  // moved the certified figure, reporting a defect that did not exist: the shipped file is always
  // the certified count plus the 134 editorial normalisations, and THAT is the contract.
  // The shipped file is the certified primary set, PLUS the records Step 3B-1 marked rather than
  // deleted, PLUS the 134 editorial normalisations. Derived from all three rather than from a
  // literal, because two of the three have moved since this was written and the third will.
  const qMarked = questions.filter(q => q.occurrences !== undefined && q.semanticLayer && q.semanticLayer !== 'primary')
  t('q-rows', `Questions ships ${CANONICAL.questions.occurrences.toLocaleString()} certified + ${qMarked.length} marked + 134 editorial`,
    questions.length === CANONICAL.questions.occurrences + qMarked.length + 134, questions.length)
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


  // Every section declares a contract.
  // Nine, not ten: Emphasis is retired and its contract went with it. The assertion is that every
  // section SHIPPING declares one, so the number follows the sections rather than leading them.
  t('all-declared', `all ${SECTION_CONTRACTS.length} shipping sections declare a provenance contract`,
    SECTION_CONTRACTS.length === 9 && SECTION_CONTRACTS.every(c => c.artifact && c.certifiedCount !== undefined), SECTION_CONTRACTS.length)
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
  // 230 -> 173. Step 3B-1's DIRECTIVE_QUESTION_UNIFIED actions resolve a sentence that is both
  // into ONE primary with the other recorded as a non-painting secondary, so the pair stops being
  // two certified records over one sentence. The relationship edge is preserved either way and is
  // asserted separately by 'question_directive relationship preserved on every unified pair'.
  t('overlap-qd', 'Question ↔ Directive overlap = 173, declared', qd === 173, qd)

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
  // 965 -> 964: the 2026-08-21 abbreviation repair absorbed tail fragments carrying the attribute; it travels with the ROW.
  // Q CONCLUSIONS IS RETIRED, like Emphasis. The gate is now that nothing regenerated it: no
  // claimMeta.isConclusion survives retire-sections.mjs and no impliedConclusions array does.
  t('overlap-conclusions-retired', 'Q Conclusions is retired: no conclusion attribute survives',
    conclusions === 0 && posts.every(p => !p.postAnalysis?.impliedConclusions?.length),
    `${conclusions} attributes, ${posts.filter(p => p.postAnalysis?.impliedConclusions?.length).length} posts with the array`)

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
      fs.writeFileSync(path.join(OUT, 'source-boundary-drift.json'), JSON.stringify({ added, removed }, null, 1))
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
  // 77: Stage 2 hovers + the Black Lives Matter type correction. entities.json is seeded, so a
  // returning reader on 76 would keep the stale category beside the corrected wording.
  // 78 carries the integrated entity cleanup. BOTH seeded artifacts changed — entities.json lost
  // 208 rows and posts.json lost 951 namedEntities entries — so a returning reader stuck on 77
  // would go on seeing URL slugs and "God" inside "Godfather III" painted as certified entities,
  // while every server-side check passed.
  // 80 carries the unhighlighted-sentence queue ruling. posts.json, questions.json, entities.json,
  // codes.json and emphasis.json all changed, and a reader stuck on 79 would go on seeing four
  // thousand ruled sentences rendered as plain unclassified text on both surfaces.
  // 81 carries the 2026-08-21 owner ruling on #4923: "Dearest Virginia -" moves Context -> Claim.
  // Context does not paint, so a reader stuck on 80 sees that drop open with an unhighlighted line
  // above five classified ones — the exact complaint that produced the ruling.
  // 91 carries the UPDATED-report rulings of 2026-08-24. posts.json, questions.json,
  // entity-hovers.json, relationships.json and search-index.json all change, and a reader stuck on
  // 90 would keep seven blue FRAGMENTS where the whole sentence is now the question, an amber
  // fragment ("Why would H.") inside #4891's question, and violet on #1443's DECLAS_Public[3].
  // 92 carries the #2347 card and #1443. A reader stuck on 91 keeps #2347 with no entity on either
  // Q and no green on WWG1WGA, and #1443 amber where the owner has ruled it violet.
  t('seed-current', 'SEED_VERSION is 94 (the owner section moves)', seed === 94, seed)
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
  // READ FROM THE CONTRACT, never a literal. These are "does the UI still state the certified
  // figure" checks, and writing the figure twice is what made three of them fail on the
  // 2026-08-20 queue ruling for no reason other than that the literal had gone stale.
  t('ui-questions', `sectionInfo states ${CANONICAL.questions.occurrences.toLocaleString()}`, has(CANONICAL.questions.occurrences), 'ok')
  t('ui-directives', `sectionInfo states ${CANONICAL.directives.occurrences.toLocaleString()}`, has(CANONICAL.directives.occurrences), 'ok')
  t('ui-claims', `sectionInfo states ${CANONICAL.claims.occurrences.toLocaleString()}`, has(CANONICAL.claims.occurrences), 'ok')
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
  t('ui-entities-submetrics', 'sectionInfo keeps the core and tail submetrics as provenance', has(CANONICAL.entities.coreRegistryMentions) && has(CANONICAL.entities.tailMentions), 'ok')
  t('ui-themes', `sectionInfo states ${CANONICAL.themes.assignments.toLocaleString()}`, has(CANONICAL.themes.assignments), 'ok')
  t('ui-codes', `sectionInfo states ${CANONICAL.codes.occurrences.toLocaleString()}`, has(CANONICAL.codes.occurrences), 'ok')
  // Retired: sectionInfo must NOT state an Emphasis figure any more.
  // The assertion is that no Emphasis SECTION is offered to a reader — not that the word never
  // appears in a comment explaining the retirement, which is exactly where it should appear.
  t('ui-emphasis-gone', 'sectionInfo offers no Emphasis section',
    !/EMPHASIS_INFO/.test(info) && !/id:\s*'emphasis'/.test(info)
    && !/^\s*emphasis\s*:\s*\{/m.test(info), 'ok')

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
    t('headline-claims', 'Claims headline = certified 8,928 / 3,084',
      stated('claims', CANONICAL.claims.occurrences, CANONICAL.claims.posts), 'ok')
    t('headline-predictions', 'Predictions headline = certified 935 / 672',
      stated('predictions', CANONICAL.predictions.occurrences, CANONICAL.predictions.posts), 'ok')
    t('headline-emphasis-gone', 'SECTION_TOTALS carries no Emphasis row', !/emphasis\s*:/i.test(totals), 'ok')
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
    // AN OWNER-RULED READING IS NOT AN AUDIT OUTCOME, and the two checks below are both about the
    // audit. `o` marks a byPost record the owner ruled directly — 73 of them on 2026-08-24, saying
    // what "Q" means on the drops that inherit the Q = Alice equation rather than stating it.
    // They are layered on top of the audit's population by apply-entity-synopses.mjs, so counting
    // them into the audit's six-bucket reconciliation would make it fail by exactly the number of
    // rulings the owner made.
    const ownerRuled = published.filter(p => p.o)
    const audited = published.filter(p => !p.o)
    // 4,177 -> 3,780. Two corrections, and the second overturned the first.
    //
    // Fixing the substring defect stopped 21 records matching inside URLs and they fell through to
    // publish, which read as records that had been wrongly held. They were not: none of them
    // contains any spelling of its entity anywhere in its drop. That prompted the wider check —
    // does the reader have a word to hover at all — and 376 published records failed it. Their
    // certified mention is real; its wording is simply not in the text on screen, usually because
    // it came from an image. A tooltip over an invisible word cannot render and should not ship.
    // ONE SYNOPSIS PER LIVE ENTITY, LESS THE ONES DELIBERATELY NOT WRITTEN YET.
    //
    // A global synopsis is authored editorial text about a real person or organisation, and
    // extract-entity-hovers.mjs refuses to publish an unreviewed one - that refusal is the point of
    // the whole allowlist. So when the 2026-08-20 queue ruling certified 39 new identities, the
    // honest state is 1,201 synopses for 1,240 entities and a NAMED list of what is missing, not 39
    // synopses written to make a number match.
    //
    // Both halves are asserted, because either one alone can hide a real defect: the pending list
    // must be exactly the difference (so the gap cannot widen silently), and no published synopsis
    // may point at an entity that is no longer live (so a withdrawal cannot leave a tooltip behind).
    const pendingFile = path.join(ROOT, 'audit/entity-hover-pending.json')
    const pending = fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile, 'utf8')).entities ?? [] : []
    const globalIds = new Set(Object.keys(hov.global ?? {}))
    const withoutSynopsis = entities.entities.filter(e => !globalIds.has(e.id)).map(e => e.id)
    const pendingIds = new Set(pending.map(p => p.id))
    const orphanedSynopses = [...globalIds].filter(id => !entities.entities.some(e => e.id === id))
    t('hover-globals', `one global synopsis per live entity, less the ${pending.length} awaiting one`,
      globalIds.size + pending.length === CANONICAL.entities.canonical
      && withoutSynopsis.length === pending.length
      && withoutSynopsis.every(id => pendingIds.has(id)),
      `${globalIds.size} published + ${pending.length} pending`)
    t('hover-no-orphans', 'no published synopsis points at an entity that is no longer live',
      orphanedSynopses.length === 0, `${orphanedSynopses.length} orphaned`)

    // The four buckets must account for every audit record — 7,778, no more and no fewer. A
    // record that falls out of all of them has silently disappeared, which is worse than being
    // held, because nothing is left saying it existed.
    const q = path.join(OUT, 'entity-hover-url-quarantine.json')
    const w = path.join(OUT, 'entity-hover-withdrawn.json')
    const rq = path.join(OUT, 'entity-hover-review-queue.json')
    if ([q, w, rq].every(f => fs.existsSync(f))) {
      const review = JSON.parse(fs.readFileSync(rq, 'utf8'))
      const quar = JSON.parse(fs.readFileSync(q, 'utf8'))
      const wd = JSON.parse(fs.readFileSync(w, 'utf8'))
      // FIVE buckets since the 2026-08-16 no-visible-anchor ruling. The fifth is not a subset of
      // review: "an editor should re-read this" and "there is no word on screen to hover" are
      // different findings, and only the first is about the writing.
      const naPath = path.join(OUT, 'entity-hover-no-visible-anchor.json')
      const na = fs.existsSync(naPath) ? JSON.parse(fs.readFileSync(naPath, 'utf8')) : { total: 0, records: [] }
      // A SIXTH BUCKET since 2026-08-22: synopses PRUNED because the identity they described was
      // retired. The text is not lost — audit/entity-hover-pruned.json keeps it verbatim so
      // restoring an identity can restore its synopsis — so it still has to be accounted for here,
      // or the reconciliation would read the pruning as three records that vanished.
      const prunedPath = path.join(OUT, 'entity-hover-pruned.json')
      const pruned = fs.existsSync(prunedPath) ? JSON.parse(fs.readFileSync(prunedPath, String.fromCharCode(117,116,102,45,56))) : { postSynopsesRemoved: 0 }
      const sum = audited.length + review.total + na.total + quar.total + wd.total + (pruned.postSynopsesRemoved ?? 0)
      t('hover-reconciles', 'publish + review + no-anchor + quarantine + withdrawn + pruned = 7,778', sum === 7778,
        `${audited.length} + ${review.total} + ${na.total} + ${quar.total} + ${wd.total} = ${sum}` + (ownerRuled.length ? ` (+${ownerRuled.length} owner-ruled, outside this population)` : ''))

      // No held record may be in the bundle, matched on the key the bundle uses.
      const held = [...review.records, ...na.records, ...quar.records, ...wd.records]
      const pubKeys = new Set(published.map(p => `${p.id} ${p.postNum}`))
      const pubOcc = new Set(published.map(p => p.occ).filter(Boolean))
      const leaked = held.filter(r => pubKeys.has(`${r.entityId} ${r.postNum}`) && !pubOcc.has(r.auditOccurrenceId))
      t('hover-no-review-leak', 'no held record is in the public bundle', leaked.length === 0,
        leaked.length ? `${leaked.length} leaked` : `${held.length} held back`)

      // THE PRIVACY GUARANTEE IS THE ABSENCE OF THE BYTES, not a permission check. These files
      // must not be under public/data, because that directory IS the published bundle.
      const inPublic = ['entity-hover-review-queue.json', 'entity-hover-url-quarantine.json', 'entity-hover-withdrawn.json']
        .filter(f => fs.existsSync(path.join(DATA, f)))
      t('hover-queues-private', 'the editorial queues are not under public/data', inPublic.length === 0,
        inPublic.length ? inPublic.join(', ') : 'admin only')

      // Every shared-alias occurrence stays in review. A global alias mapping must never decide
      // that BO means one entity in every drop.
      const shared = new Set()
      for (const e of entities.entities) for (const a of e.aliases) {
        if (!shared.has(a.text)) shared.set?.(a.text) ?? shared.add(a.text)
      }
      const owners = new Map()
      for (const e of entities.entities) for (const a of e.aliases) {
        if (!owners.has(a.text)) owners.set(a.text, [])
        owners.get(a.text).push(e.canonical)
      }
      const sharedSet = new Set([...owners].filter(([, v]) => v.length > 1).map(([k]) => k))
      // An OWNER RULING is exempt, and only an owner ruling. The rule this guard enforces is that
      // a global alias mapping must never decide that "BO" means one entity in every drop — it is
      // about what a GENERATOR may infer, not about what the owner may rule. "Q" is shared between
      // the Q designation and Alice, and the owner ruled on 2026-08-24 which reading each drop
      // carries. Every exempt record names the ruling in its own `o` field.
      const publishedShared = audited.filter(p => sharedSet.has(p.a))
      t('hover-shared-alias-held', 'no shared-alias occurrence is published unless the owner ruled it',
        publishedShared.length === 0,
        publishedShared.length ? `${publishedShared.length} published` :
          `${review.records.filter(r => r.sharedAlias).length} held in review, ${ownerRuled.filter(p => sharedSet.has(p.a)).length} ruled by the owner`)

      // Withdrawn records are audit history only.
      t('hover-withdrawn-history', 'withdrawn records are history, not review',
        wd.category === 'withdrawn_entity_occurrence' && wd.total === 37, `${wd.total}`)
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

// ── 10c. The integrated entity cleanup ───────────────────────────────────────
//
// Everything here is about a change that has NOT been applied. That is deliberate: the invariants
// are written first, they pass before the change by asserting the world as it stands, and they go
// on passing after it by asserting the world as it will stand. Written afterwards, they would
// describe whatever happened rather than check it.
//
// The one that matters most is the vacuous-test guard, and it exists because of what these checks
// nearly missed. The URL classifier ran against posts.json raw text — the board's own encoding,
// complete with `https:<em>//</em>` splitting every link in half. It found 1,430 of the corpus's
// 2,666 links. Every count downstream was arithmetically perfect and answered the wrong question.
// A test that reads the wrong string does not fail; it passes, quietly, forever.
{
  const t = group('10c. Integrated entity cleanup')
  // THE RUNNING RECORD OF EVERY DECISION SINCE THE 2026-08-17 APPROVAL, read once for the group.
  // Three checks below consult it: what the applied totals should now be, what state the audit was
  // run against, and whether a moved input is explained. It is the file the approval guard itself
  // uses, so all four agree by construction rather than by three separate copies of the arithmetic.
  const contractPath = path.join(OUT, 'entity-cleanup-rollback-contract.json')
  const contract = fs.existsSync(contractPath)
    ? JSON.parse(fs.readFileSync(contractPath, 'utf8'))
    : { postApprovalDeltas: [], countsBefore: { mentions: 0, entityRows: 0 } }
  const readIf = f => { const p = path.join(OUT, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null }
  const occAudit = readIf('occurrence-provenance-audit.json')
  const integratedRaw = readIf('integrated-migration-plan.json')
  // THE SAME POST-APPROVAL DELTA THE REMATERIALISER READS, from the same file.
  //
  // integrated-migration-plan.json records what the 2026-08-17 cleanup was PROVEN to do, against
  // the tree it was proven on. A later owner ruling that adds entities upstream moves the
  // before-state and the after-state by the same amount without changing the cleanup at all - 951
  // withdrawals, still. Offsetting here keeps these checks measuring the cleanup rather than
  // re-reporting an unrelated ruling as drift, and it reads the delta from the rollback contract so
  // there is exactly one place that says how far the tree has moved since the approval.
  const cleanupContract = readIf('entity-cleanup-rollback-contract.json')
  const cleanupDelta = (cleanupContract?.postApprovalDeltas ?? []).reduce((acc, d) => ({
    mentions: acc.mentions + (d.mentions ?? 0),
    entityRows: acc.entityRows + (d.entityRows ?? 0),
  }), { mentions: 0, entityRows: 0 })
  const integrated = integratedRaw && {
    ...integratedRaw,
    proven: {
      ...integratedRaw.proven,
      mentionsBefore: integratedRaw.proven.mentionsBefore + cleanupDelta.mentions,
      mentionsAfter: integratedRaw.proven.mentionsAfter + cleanupDelta.mentions,
      entityRowsBefore: integratedRaw.proven.entityRowsBefore + cleanupDelta.entityRows,
      entityRowsAfter: integratedRaw.proven.entityRowsAfter + cleanupDelta.entityRows,
    },
  }
  const reversal = readIf('entity-cleanup-reversal.json')
  const substrings = readIf('invalid-substring-occurrences.json')
  const dormantReg = readIf('entity-dormant-registry.json')
  const sourceOnlyReg = readIf('entity-source-only-registry.json')
  const quarantine = readIf('entity-hover-url-quarantine.json')
  const noAnchor = readIf('entity-hover-no-visible-anchor.json')
  const linkedPath = path.join(DATA, 'linked-sources.json')
  const linked = fs.existsSync(linkedPath) ? JSON.parse(fs.readFileSync(linkedPath, 'utf8')) : null
  const applied = Boolean(linked)

  // ── 1. TOTALS. The audit, the plan and the reversal are three views of ONE list.
  if (occAudit && integrated && reversal) {
    const led = integrated.occurrenceLedger
    // BEFORE the apply, the audit describes the live corpus. AFTER it, the audit describes the
    // state the cleanup started from — so the comparison moves to the recorded before-figure. An
    // invariant that silently switched to comparing the audit against itself would pass forever.
    // TWO DIFFERENT "BEFORE"S, and conflating them is what made this fail on a healthy tree.
    //
    // The occurrence LEDGER is the historical record of the 2026-08-17 plan: it was computed over
    // the 9,749 that existed then and it must still add to that, whatever has happened since. The
    // provenance AUDIT describes the corpus as it stands, so it has to cover every occurrence
    // certified today - including the ones a later owner ruling added.
    const ledgerBefore = applied ? integratedRaw.proven.mentionsBefore : CANONICAL.entities.mentions
    const expected = applied ? integrated.proven.mentionsBefore : CANONICAL.entities.mentions
    t('cleanup-ledger-reconciles', 'every starting mention lands in exactly one bucket',
      led.reconciles && led.TOTAL === ledgerBefore, `${led.TOTAL} of ${led.certifiedBefore}`)
    t('cleanup-audit-covers-corpus', 'the provenance audit covers every certified occurrence',
      occAudit.totals.reconciles && occAudit.totals.occurrences === expected,
      `${occAudit.totals.occurrences} of ${expected}`)
    if (applied) {
      // THE PROVEN TOTALS, PLUS EVERY DECISION RECORDED SINCE. integrated-migration-plan.json is
      // the 2026-08-17 apply record and does not move; the rollback contract carries one
      // postApprovalDeltas entry per later ruling, and the duplicate-record reconciliation carries
      // its own artifact. Comparing the tree to the 2026-08-17 figure alone asserts that nothing
      // has been ruled since.
      // ONLY THE afterOnly DELTAS. `integrated.proven` above is already offset by the upstream
      // ones — the deltas that move the before-state and the after-state together — so adding the
      // whole set again counts those twice. An afterOnly delta changes what the step DOES rather
      // than the tree it starts from, so it lands here and nowhere else.
      // afterOnly AND downstream. This test measures the FINISHED bundle, so it must count both the
      // rulings apply-entity-cleanup.mjs itself applies and the ones a later step adds — the
      // 2026-08-23 verse-block ruling being the latter. The applier counts only the first kind,
      // because at that point in the chain the second has not happened yet.
      const d = (contract.postApprovalDeltas ?? []).reduce((a, x) => ({
        mentions: a.mentions + (x.afterOnly?.mentions ?? 0) + (x.downstream?.mentions ?? 0),
        entityRows: a.entityRows + (x.afterOnly?.entityRows ?? 0) + (x.downstream?.entityRows ?? 0),
      }), { mentions: 0, entityRows: 0 })
      const recPath = path.join(OUT, 'entity-registry-reconciliation.json')
      const rec = fs.existsSync(recPath) ? JSON.parse(fs.readFileSync(recPath, 'utf8')) : { duplicateRecordsRemoved: 0 }
      const expectRows = integrated.proven.entityRowsAfter + d.entityRows
      const expectMentions = integrated.proven.mentionsAfter + d.mentions - (rec.duplicateRecordsRemoved ?? 0)
      t('cleanup-applied-as-planned', 'the applied totals are the proven ones plus every ruling recorded since',
        entities.entities.length === expectRows && entities.totals.mentions === expectMentions,
        `${entities.entities.length}/${entities.totals.mentions} against ${expectRows}/${expectMentions}`)
    }
    const acted = integrated.actions.length
    t('cleanup-totals-agree', 'plan actions, reversal restores and the withdrawn total are one number',
      acted === reversal.restores.length && acted === integrated.proven.mentionsBefore - integrated.proven.mentionsAfter,
      `${acted} actions / ${reversal.restores.length} restores / ${integrated.proven.mentionsBefore - integrated.proven.mentionsAfter} withdrawn`)
    const ids = new Set(integrated.actions.map(a => a.occurrenceId))
    t('cleanup-no-double-subtraction', 'no certified occurrence is acted on twice',
      ids.size === integrated.actions.length, `${ids.size} distinct of ${integrated.actions.length}`)
    t('cleanup-no-refusals', 'the plan carries no refusals', integrated.refusals.length === 0, `${integrated.refusals.length}`)
    // THE RULE THAT PROTECTS Q'S OWN WORDS, asserted against the audit rather than the plan derived
    // from it, so a bug in the derivation cannot hide behind its own output.
    const visibleActed = occAudit.rows.filter(r =>
      (r.category === 'visible_complete_token' || r.category === 'visible_alias_variant') && r.certifiedCountEffect !== 0)
    t('cleanup-visible-never-withdrawn', 'no occurrence the reader can see is withdrawn',
      visibleActed.length === 0, `${visibleActed.length} acted on`)
  }

  // ── 2. URL EXCLUSION.
  if (quarantine) {
    const hoverFile = path.join(DATA, 'entity-hovers.json')
    const hov = fs.existsSync(hoverFile) ? JSON.parse(fs.readFileSync(hoverFile, 'utf8')) : { byPost: {} }
    const pub = new Set()
    for (const [id, byPost] of Object.entries(hov.byPost ?? {})) for (const pn of Object.keys(byPost)) pub.add(`${id} ${pn}`)
    const leaked = quarantine.records.filter(r => pub.has(`${r.entityId} ${r.postNum}`))
    t('url-excluded-from-hovers', 'no URL-derived record has a public hover', leaked.length === 0,
      leaked.length ? `${leaked.length} leaked` : `${quarantine.total} quarantined`)
  }
  if (applied && integrated) {
    // A WITHDRAWAL CAN BE UNDONE - BUT ONLY BY A NAMED RULING.
    //
    // The plan withdrew #1239:0 "Al Gore" because his only trace on the drop was the path of a
    // Washington Post URL, which a publisher's CMS generates and Q did not write. #1239's FIRST
    // LINE is "@algore", and on 2026-08-24 that handle was certified as his alias - so the
    // occurrence is now supported by Q's own visible text and the condition it was withdrawn under
    // has stopped being true.
    //
    // That is a legitimate reason for a withdrawn occurrence to come back and it must not be a
    // silent one. The exception is read from restoredOccurrences[] on the postApprovalDeltas entry
    // that causes it, so an occurrence reappearing WITHOUT a record still fails - which is the
    // thing this invariant exists to catch.
    const restored = new Set((contract?.postApprovalDeltas ?? [])
      .flatMap(d => d.restoredOccurrences ?? [])
      .map(r => r.occurrenceId))
    const stillPainted = integrated.actions.filter(a =>
      (byNum.get(a.postNum)?.postAnalysis?.namedEntities ?? [])[a.index] === a.alias
      && !restored.has(a.occurrenceId))
    t('url-fragments-withdrawn', 'no withdrawn occurrence is still a certified annotation',
      stillPainted.length === 0,
      stillPainted.length ? `${stillPainted.length} remaining`
        : restored.size ? `ok (${restored.size} restored by a recorded ruling)` : 'ok')
  }

  // ── 3. BOUND AND UNBOUND SOURCES. A null entityId is a decision, not a gap.
  if (linked) {
    const rows = [...Object.values(linked.byHostname ?? {}), ...Object.values(linked.byAccount ?? {})]
    const bad = rows.filter(h => h.entityId && !entities.entities.some(e => e.id === h.entityId))
    t('sources-bound-resolve', 'every bound source resolves to a live entity', bad.length === 0, `${bad.length} dangling`)
    const unbound = rows.filter(h => !h.entityId)
    t('sources-unbound-explained', 'every unbound source still names who it is',
      unbound.every(h => String(h.displayName ?? '').trim().length > 0), `${unbound.length} unbound`)
    const flat = Object.values(linked.byPost ?? {}).flat()
    t('sources-post-index-agrees', 'the per-post, per-hostname and per-account indexes hold the same records',
      flat.length === linked.totals.records
      && new Set(flat.filter(r => r.kind === 'publisher').map(r => r.hostname)).size === Object.keys(linked.byHostname ?? {}).length
      && new Set(flat.filter(r => r.kind === 'social_account').map(r => `${r.platform}/${String(r.handle).toLowerCase()}`)).size === Object.keys(linked.byAccount ?? {}).length,
      `${flat.length} records / ${Object.keys(linked.byHostname ?? {}).length} hostnames / ${Object.keys(linked.byAccount ?? {}).length} accounts`)
    // A SOCIAL ACCOUNT IS NOT A PUBLISHER. Collapsing 84 people onto "twitter.com" would lose every
    // one of them, and labelling an account as a publisher would claim Q cited it as a source.
    t('sources-kinds-distinct', 'publishers and accounts are separately keyed and separately labelled',
      Object.values(linked.byAccount ?? {}).every(a => a.platform && a.handle)
      && flat.every(r => r.kind === 'publisher' || r.kind === 'social_account'),
      `${linked.totals.publisherRecords} publisher / ${linked.totals.socialAccountRecords} social`)
  } else {
    t('sources-absent-before-apply', 'linked-sources.json does not exist until the cleanup is applied', true, 'not applied')
  }

  // ── 4. DORMANT IDS. Retired from the bundle, reserved forever.
  if (dormantReg) {
    const ledger = readIf('entity-ids.json')
    const live = new Set(entities.entities.map(e => e.id))
    const unreserved = dormantReg.entities.filter(e => !ledger?.entries?.[e.id])
    t('dormant-ids-reserved', 'every dormant id is still held in the permanent ledger',
      unreserved.length === 0, `${dormantReg.total} dormant, ${unreserved.length} unreserved`)
    if (applied) {
      t('dormant-not-public', 'no dormant identity is in the public entity bundle',
        dormantReg.entities.every(e => !live.has(e.id)), `${dormantReg.entities.filter(e => live.has(e.id)).length} still public`)
      const idx = path.join(DATA, 'search-index.json')
      if (fs.existsSync(idx)) {
        const names = new Set(dormantReg.entities.map(e => e.canonical))
        const indexed = JSON.parse(fs.readFileSync(idx, 'utf8')).rows.filter(r => r.s === 'entities' && names.has(r.t))
        t('dormant-not-searchable', 'no dormant identity is indexed as an entity', indexed.length === 0, `${indexed.length} indexed`)
      }
      const hoverFile = path.join(DATA, 'entity-hovers.json')
      if (fs.existsSync(hoverFile)) {
        const hov = JSON.parse(fs.readFileSync(hoverFile, 'utf8'))
        const withHover = dormantReg.entities.filter(e => hov.global?.[e.id] || hov.byPost?.[e.id])
        t('dormant-no-hovers', 'no dormant identity carries a global synopsis or a hover', withHover.length === 0, `${withHover.length}`)
      }
    } else {
      t('dormant-pending', 'the dormant set is prepared but not retired',
        dormantReg.entities.every(e => live.has(e.id)), `${dormantReg.total} still live, as expected before apply`)
    }
  }

  // ── 5. SOURCE-ONLY. Zero mentions is a CATEGORY here, never a rendered figure.
  if (sourceOnlyReg) {
    t('source-only-have-posts', 'every source-only identity keeps at least one linked drop',
      sourceOnlyReg.entities.every(e => (e.linkedSourcePosts ?? []).length > 0), `${sourceOnlyReg.total} rows`)
    const libSrc = fs.existsSync(path.join(SRC, 'lib', 'linkedSources.ts'))
      ? fs.readFileSync(path.join(SRC, 'lib', 'linkedSources.ts'), 'utf8') : ''
    t('source-only-described', 'a source-only identity has a sentence of its own, not a zero',
      /sourceOnlyDescription/.test(libSrc) && /never named in Q's own words/.test(libSrc), 'described')
    const srcPage = path.join(SRC, 'pages', 'Sources.tsx')
    t('source-navigation-separate', 'Sources is its own surface, not a filter on Entities',
      fs.existsSync(srcPage) && /linkedSources/.test(fs.readFileSync(srcPage, 'utf8')), 'separate page')
  }

  // ── 6. MIXED PROSE AND URL, per drop rather than per row.
  if (occAudit) {
    const byKey = new Map()
    for (const r of occAudit.rows) {
      if (!r.entityId) continue
      const k = `${r.entityId} ${r.postNum}`
      if (!byKey.has(k)) byKey.set(k, [])
      byKey.get(k).push(r)
    }
    const overreach = [...byKey.values()].filter(rs =>
      rs.some(r => r.category === 'visible_complete_token') && rs.every(r => r.certifiedCountEffect !== 0))
    t('cleanup-mixed-keeps-prose', 'a drop where the entity is visible never loses every occurrence',
      overreach.length === 0, `${overreach.length} over-reaching`)
  }

  // ── 7. AMBIGUOUS RECORDS ARE UNTOUCHED.
  if (occAudit) {
    const amb = occAudit.rows.filter(r => r.category === 'ambiguous_provenance')
    t('cleanup-ambiguous-untouched', 'every ambiguous occurrence is retained unchanged',
      amb.every(r => r.certifiedCountEffect === 0), `${amb.length} ambiguous, ${amb.filter(r => r.certifiedCountEffect !== 0).length} acted on`)
  }

  // ── 8. THE BOUNDARY RULING. A substring is only removable with nothing else behind it.
  if (substrings && occAudit) {
    const auto = substrings.records.filter(r => r.certifiedCountEffect === -1)
    const wrong = auto.filter(r => r.anotherValidAliasInProse || r.urlProvenance || r.metadataProvenance || r.imageProvenance)
    t('substring-removal-is-last-resort', 'no substring is auto-removed where other provenance exists',
      wrong.length === 0, `${auto.length} removable of ${substrings.total}, ${wrong.length} with other support`)
    t('substring-evidence-complete', 'every substring record carries the word that produced it',
      substrings.records.every(r => (r.containingWords ?? []).length > 0 && r.renderedContext !== undefined),
      `${substrings.total} documented`)
  }

  // ── 8b. THE THREE RULINGS OF 2026-08-17, each asserted where it can actually fail.
  if (occAudit) {
    const social = occAudit.rows.filter(r => r.category === 'social_account_reference')
    t('social-migrated-not-withdrawn', 'every social-account reference migrates rather than being deleted',
      social.length > 0 && social.every(r => r.proposedAction === 'migrate-to-social-account'),
      `${social.length} references`)
    t('social-not-prose', 'no social-account reference is counted as a prose mention',
      social.every(r => r.certifiedCountEffect === -1), 'migrated out of the prose layer')

    // The image ruling: certified, private, no public hover.
    const imgUnconfirmed = occAudit.rows.filter(r => r.category === 'image_provenance_unconfirmed')
    t('image-unconfirmed-certified', 'image-unconfirmed occurrences keep their certified mention',
      imgUnconfirmed.every(r => r.certifiedCountEffect === 0), `${imgUnconfirmed.length} held`)
    t('image-unconfirmed-private', 'every one of them is in the private provenance queue',
      imgUnconfirmed.every(r => r.privateProvenanceReview === true), `${imgUnconfirmed.length} queued`)
    // The 17 that were substring suspects are RECLASSIFIED, not erased: the finding survives on the
    // row, so a later editor is not told the drop was clean.
    const reclassified = imgUnconfirmed.filter(r => r.evidence?.reclassifiedFrom === 'invalid_substring_extraction')
    t('image-substring-evidence-kept', 'a reclassified substring suspect still carries its evidence',
      reclassified.every(r => (r.evidence.alsoSubstringOf ?? []).length > 0), `${reclassified.length} reclassified`)

    // The withdrawal ruling, scoped to the population it named.
    const withdrawn = readIf('entity-withdrawals-approved.json')
    if (withdrawn) {
      const acted = occAudit.rows.filter(r => r.category === 'no_supported_provenance' && r.certifiedCountEffect === -1)
      t('withdrawals-scoped-to-ruling', 'only the approved population is withdrawn',
        acted.length === withdrawn.total && acted.every(r => r.withdrawalApproved),
        `${withdrawn.total} approved, ${withdrawn.beyondRuledPopulation.length} held beyond it`)
      t('withdrawals-fully-documented', 'every withdrawal records its evidence search and reversal',
        withdrawn.records.every(r => r.evidenceSearch && r.reversal && r.withdrawalReason), `${withdrawn.total} documented`)
      t('withdrawals-preserve-the-drop', 'post text and media are untouched by a withdrawal',
        withdrawn.postTextUnchanged === true && withdrawn.mediaUnchanged === true, 'annotation only')
      if (integrated) {
        const ids = new Set(integrated.actions.map(a => a.occurrenceId))
        t('withdrawals-reversible', 'every withdrawal is in the reversal contract',
          withdrawn.records.every(r => ids.has(r.occurrenceId)), `${withdrawn.total} reversible`)
      }
    }
  }

  // ── 9. NO VISIBLE TEXT ANCHOR is a ruling about the tooltip, and only the tooltip.
  if (noAnchor) {
    t('anchor-classified', 'every no-anchor record carries the classification, not a bare reason',
      noAnchor.records.every(r => r.hoverClassification === 'no_visible_text_anchor'), `${noAnchor.total} classified`)
    t('anchor-not-withdrawn', 'no no-anchor record is filed as a withdrawn entity occurrence',
      noAnchor.category === 'no_visible_text_anchor' && noAnchor.certifiedCountChange === 'none', 'ruling honoured')
  }
  if (occAudit) {
    // The AUDIT moves nothing; the APPLY does. Before the apply those are the same statement, and
    // after it they are not — so the check is that the audit still describes the state it was run
    // against, which is what makes it a usable rollback reference.
    const auditBase = applied ? integrated.proven : { mentionsBefore: entities.totals.mentions, entityRowsBefore: entities.entities.length }
    // THE AUDIT'S OWN SNAPSHOT, WHICH IS NOT THE 2026-08-17 BEFORE-STATE. The audit was last
    // re-run on 2026-08-21, after the queue rulings and the Nellie Ohr alias had added rows and
    // mentions upstream of the cleanup — so it describes 1,448 rows / 9,926 mentions, not the
    // 1,409 / 9,749 the apply record holds. Both figures are correct about different moments, and
    // comparing them reported drift that is the audit being newer than the apply.
    //
    // What must stay true is that the audit's snapshot matches what the rollback contract says the
    // tree looked like when it ran: countsBefore plus the deltas that PREDATE it. A delta recorded
    // afterwards (Owner Ruling 1's merge, Ruling 3, the lane-B reviews) moved the tree and not the
    // audit, which is exactly why each is recorded separately.
    const preAudit = (contract.postApprovalDeltas ?? []).filter(x => (x.ruledOn ?? '') <= (occAudit.ruledOnAuditRun ?? '2026-08-21'))
      .reduce((a, x) => ({ mentions: a.mentions + (x.mentions ?? 0), entityRows: a.entityRows + (x.entityRows ?? 0) }), { mentions: 0, entityRows: 0 })
    const auditExpect = {
      mentions: contract.countsBefore.mentions + preAudit.mentions,
      entityRows: contract.countsBefore.entityRows + preAudit.entityRows,
    }
    t('anchor-counts-unmoved', 'the provenance audit describes the state it was run against',
      occAudit.certifiedUnchanged.mentions === auditExpect.mentions
      && occAudit.certifiedUnchanged.entityRows === auditExpect.entityRows,
      `${occAudit.certifiedUnchanged.entityRows}/${occAudit.certifiedUnchanged.mentions} against ${auditExpect.entityRows}/${auditExpect.mentions}`)
    // An "image confirmed" verdict is only meaningful if something could have confirmed it.
    const mediaFields = new Set()
    for (const p of posts) for (const m of [...(p.media ?? []), ...(p.refMedia ?? [])]) for (const k of Object.keys(m ?? {})) mediaFields.add(k)
    const canConfirm = ['ocr', 'ocrText', 'imageText', 'annotations', 'boundingBoxes', 'caption', 'alt'].some(f => mediaFields.has(f))
    t('anchor-image-claim-honest', 'image_provenance_confirmed is only claimed where something could confirm it',
      canConfirm || (occAudit.totals.byCategory.image_provenance_confirmed ?? 0) === 0,
      canConfirm ? 'image data exists' : `no OCR/annotation data in the corpus → ${occAudit.totals.byCategory.image_provenance_confirmed ?? 0} confirmed`)
    t('image-unconfirmed-stay-certified', 'image-unconfirmed occurrences keep their certified mention',
      occAudit.rows.filter(r => r.category === 'image_provenance_unconfirmed').every(r => r.certifiedCountEffect === 0),
      `${occAudit.totals.byCategory.image_provenance_unconfirmed ?? 0} held`)
  }

  // ── 10. ONE SHARED IMPLEMENTATION, ASSERTED AS ONE (owner ruling, 2026-08-17).
  //
  // It is not enough that the shared module exists — what matters is that nobody kept a private
  // copy, so this checks that every consumer imports the primitives and that none redefines one.
  {
    const shared = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'renderedMatch.mjs'), 'utf8')
    t('coords-shared-definition', 'one shared implementation of rendered text and complete-token matching',
      /from '\.\/runtimeText\.mjs'/.test(shared) && /export function completeTokenMatch/.test(shared)
      && /export function foldTokens/.test(shared) && /runtimeText\(text\)/.test(shared), 'renderedMatch.mjs')

    const CONSUMERS = ['lib/hoverValidation.mjs', 'extract-entity-hovers.mjs', 'audit-occurrence-provenance.mjs',
      'apply-entity-cleanup.mjs', 'build-glossary.mjs', 'build-search-index.mjs', 'analyse-url-derived-cleanup.mjs']
    const forked = []
    const notImporting = []
    for (const f of CONSUMERS) {
      const p = path.join(ROOT, 'scripts', f)
      if (!fs.existsSync(p)) { notImporting.push(`${f} (missing)`); continue }
      const src = fs.readFileSync(p, 'utf8')
      if (!/renderedMatch\.mjs|hoverValidation\.mjs/.test(src)) notImporting.push(f)
      if (/^\s*(?:const|function|export function)\s+(foldTokens|completeTokenMatch|urlSpans|aliasLocation)\b/m.test(src)) forked.push(f)
    }
    t('coords-no-private-copies', 'no consumer keeps its own copy of the matching primitives',
      forked.length === 0 && notImporting.length === 0,
      [...forked.map(f => `FORK ${f}`), ...notImporting.map(f => `NOT IMPORTING ${f}`)].join(', ') || `${CONSUMERS.length} consumers share it`)

    // ── THE VACUOUS-TEST GUARD ──────────────────────────────────────────────
    // Both halves. That the shared definition is used, AND that it MATTERS: the raw and rendered
    // forms must disagree about how many links exist, because if they ever agree, this guard has
    // stopped guarding anything and is passing for free.
    const rawLinks = posts.reduce((n, p) => n + (String(p.text ?? '').match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi) ?? []).length, 0)
    const renderedLinks = posts.reduce((n, p) => n + (runtimeText(String(p.text ?? '')).match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi) ?? []).length, 0)
    t('coords-guard-is-not-vacuous', 'the two coordinate systems genuinely disagree, so this check can fail',
      renderedLinks > rawLinks, `raw ${rawLinks} links vs rendered ${renderedLinks} — the gap this guard exists for`)

    const seedSrc = fs.readFileSync(path.join(SRC, 'lib', 'localData.ts'), 'utf8')
    t('coords-matches-the-app', 'the script definition still matches what the app strips at seed time',
      /em\|u\|span\|p\|b\|i\|strong\|s/.test(seedSrc) && /&amp;/.test(seedSrc) && /&gt;/.test(seedSrc), 'markup + entities')

    // And the boundary rule is the RENDERER's boundary rule, not a second opinion about it.
    const hc = fs.readFileSync(path.join(SRC, 'lib', 'highlightConstants.ts'), 'utf8')
    t('coords-boundary-matches-renderer', 'the scripts use the renderer\'s word-boundary rule',
      /\(\?<!\[A-Za-z0-9\]\)/.test(hc) && /\(\?<!\[A-Za-z0-9\]\)/.test(shared), 'lookaround, not \\b')
  }

  // ── 11. BYTE-IDENTICAL REBUILD.
  {
    const auditPath = path.join(OUT, 'occurrence-provenance-audit.json')
    if (fs.existsSync(auditPath)) {
      const digest = crypto.createHash('sha256').update(fs.readFileSync(auditPath)).digest('hex')
      // Recorded, not re-run: re-running a derivation inside a validation pass is the derive step
      // standing rule 7 forbids. The check is that the declared inputs still hash the same and that
      // the artifact they produced still does too.
      const inputs = ['entities.json', 'posts.json'].map(f => crypto.createHash('sha256')
        .update(fs.readFileSync(path.join(DATA, f))).digest('hex')).join('|')
      const stampPath = path.join(OUT, 'cleanup-determinism.json')
      const stamp = fs.existsSync(stampPath) ? JSON.parse(fs.readFileSync(stampPath, 'utf8')) : null
      if (stamp) {
        // THE AUDIT IS FROZEN ON PURPOSE, AND ITS INPUTS ARE NOT.
        //
        // occurrence-provenance-audit.json is the 2026-08-17 approval record. Every decision since
        // is recorded BESIDE it — two separately pinned withdrawal sets and five postApprovalDeltas
        // — precisely so the approval keeps its bytes. So entities.json and posts.json have moved
        // and the audit has not, and that is the design rather than drift.
        //
        // The check that still means something is the one about the artifact: its bytes must not
        // have changed. The input hash is recorded beside it as provenance, with the number of
        // recorded decisions that explain the difference — if the inputs move and NOTHING is
        // recorded, that is drift and this says so.
        const decisions = (contract.postApprovalDeltas ?? []).length
        t('cleanup-rebuild-byte-identical', 'the approved audit still holds its exact bytes',
          stamp.auditSha256 === digest && (stamp.inputs === inputs || decisions > 0),
          stamp.auditSha256 !== digest ? 'AUDIT BYTES MOVED'
            : stamp.inputs === inputs ? 'identical' : `audit unchanged; inputs moved under ${decisions} recorded decision(s)`)
      } else {
        fs.writeFileSync(stampPath, JSON.stringify({
          note: 'Determinism stamp. With the inputs unchanged, re-running audit-occurrence-provenance.mjs must reproduce occurrence-provenance-audit.json byte for byte. Delete to re-baseline after a DELIBERATE change to the derivation.',
          inputs, auditSha256: digest,
        }, null, 1))
        t('cleanup-rebuild-baseline', 'determinism baseline recorded', true, 'baseline')
      }
    }
  }
}

// ── 10d. Public entity list reconciliation ───────────────────────────────────
//
// The Named Entities page was printing 856, 879 and 1,201 as though they described one population.
// They describe three: 879 is the count of DISTINCT NORMALISED STRINGS in the browser's frequency
// index, 856 is those less the 23 the verbatim filter emptied to zero posts, and 1,201 is the
// certified registry. The list underneath rendered 1,062 rows, a fourth number nothing explained.
//
// These invariants pin the reconciled model so it cannot come apart again: the total, the two
// disjoint components that add to it, the row count and what accounts for the difference, and — the
// point of the whole exercise — that no row reaches a reader without evidence they can open.
{
  const t = group('10d. Public entity list reconciliation')
  const viewPath = path.join(DATA, 'entity-public-view.json')
  const view = fs.existsSync(viewPath) ? JSON.parse(fs.readFileSync(viewPath, 'utf8')) : null
  const dormantPath = path.join(OUT, 'entity-dormant-registry.json')
  const dormantReg = fs.existsSync(dormantPath) ? JSON.parse(fs.readFileSync(dormantPath, 'utf8')) : null
  const sourceOnlyPath = path.join(OUT, 'entity-source-only-registry.json')
  const sourceOnlyReg = fs.existsSync(sourceOnlyPath) ? JSON.parse(fs.readFileSync(sourceOnlyPath, 'utf8')) : null
  const linkedPath2 = path.join(DATA, 'linked-sources.json')
  const linked2 = fs.existsSync(linkedPath2) ? JSON.parse(fs.readFileSync(linkedPath2, 'utf8')) : null

  t('entity-view-published', 'entity-public-view.json ships', Boolean(view), view ? 'present' : 'MISSING')

  if (view) {
    const reg = entities.entities
    const rows = view.rows ?? {}
    const totals = view.totals ?? {}

    // ① The headline total IS the registry. Not a recount of it.
    t('entity-total-1201', 'public canonical identities = 1,201',
      totals.canonicalEntities === CANONICAL.entities.canonical && reg.length === CANONICAL.entities.canonical,
      `view ${totals.canonicalEntities} / registry ${reg.length}`)

    // ② Mentions are reported separately and are unchanged by any of this.
    const mentionSum = reg.reduce((s, e) => s + (e.mentions ?? 0), 0)
    // 8,798 -> 8,821: the queue rulings and the Nellie Ohr alias added, Owner Ruling 3 and the
    // lane-B reviews withdrew or migrated, and the duplicate-record reconciliation took 99 off.
    // Read from the contract rather than the label, which is what went stale.
    t('entity-mentions-certified', `certified prose mentions = ${CANONICAL.entities.mentions.toLocaleString()}`,
      totals.mentions === CANONICAL.entities.mentions && mentionSum === CANONICAL.entities.mentions,
      `view ${totals.mentions} / registry sum ${mentionSum}`)

    // ③ The displayed breakdown adds EXACTLY to the total, and its components are disjoint.
    const sum = (view.breakdown ?? []).reduce((s, b) => s + b.count, 0)
    t('entity-breakdown-adds', 'displayed breakdown adds exactly to the canonical total',
      (view.breakdown ?? []).length >= 2 && sum === totals.canonicalEntities,
      `${(view.breakdown ?? []).map(b => `${b.count} ${b.label}`).join(' + ')} = ${sum}`)

    const proseIds = new Set(Object.entries(rows).filter(([, r]) => r.kind === 'prose').map(([id]) => id))
    const srcIds = new Set(Object.entries(rows).filter(([, r]) => r.kind === 'source_only').map(([id]) => id))
    const overlap = [...proseIds].filter(id => srcIds.has(id))
    t('entity-components-disjoint', 'prose and source-only components share no identity',
      overlap.length === 0 && proseIds.size + srcIds.size === reg.length,
      `${proseIds.size} + ${srcIds.size}, overlap ${overlap.length}`)

    // 135 -> 138. Judicial Watch (Owner Ruling 3) plus Reuters and Ann Coulter (lane B) lost their
    // last prose mention and each has a bound linked source, so each keeps a row as source-only
    // rather than going dormant. The registry is the authority; the view must equal it exactly.
    t('entity-source-only-component', `the ${sourceOnlyReg?.total} source-only identities are a labelled component`,
      totals.sourceOnly === sourceOnlyReg?.total && srcIds.size === sourceOnlyReg?.total
      && (view.breakdown ?? []).some(b => b.key === 'sourceOnly' && b.count === sourceOnlyReg?.total),
      `${srcIds.size} rows / registry ${sourceOnlyReg?.total}`)

    // ④ Every public row has traceability a reader can open.
    const noEvidence = reg.filter(e => {
      const r = rows[e.id]
      if (!r) return true
      return r.kind === 'source_only'
        ? !(r.sourcePosts ?? []).length
        : !(e.posts ?? []).length
    })
    t('entity-row-traceability', 'every public row has a certified prose post or a linked-source post',
      noEvidence.length === 0,
      noEvidence.length ? `${noEvidence.length} without evidence: ${noEvidence.slice(0, 3).map(e => e.canonical).join(', ')}` : 'all 1,201')

    const srcWithoutRecord = [...srcIds].filter(id => !(rows[id].sourcePosts ?? []).length)
    t('entity-source-row-has-record', 'every source-only row has at least one source record',
      srcWithoutRecord.length === 0, `${srcIds.size - srcWithoutRecord.length}/${srcIds.size}`)

    // A source post chip must correspond to a real linked-source record — the row cannot invent one.
    const boundPairs = new Set()
    for (const [pn, recs] of Object.entries(linked2?.byPost ?? {})) {
      for (const rec of recs) if (rec.entityId) boundPairs.add(`${rec.entityId}:${pn}`)
    }
    const unbackedChips = []
    for (const [id, r] of Object.entries(rows)) {
      for (const s of r.sourcePosts ?? []) if (!boundPairs.has(`${id}:${s.post}`)) unbackedChips.push(`${id}#${s.post}`)
    }
    t('entity-source-chip-backed', 'every source post chip is backed by a linked-source record',
      unbackedChips.length === 0, unbackedChips.length ? unbackedChips.slice(0, 3).join(', ') : `${boundPairs.size} bound pairs`)

    // A source reference is NEVER a mention. Zero is the whole assertion.
    const srcWithMentions = [...srcIds].filter(id => (reg.find(e => e.id === id)?.mentions ?? 0) > 0)
    t('entity-source-not-a-mention', 'no source-only identity carries a prose mention',
      srcWithMentions.length === 0, `${srcWithMentions.length} violations`)

    // ⑤ Dormant identities cannot enter the public list.
    const dormantIds = new Set((dormantReg?.entities ?? []).map(d => d.id ?? d).filter(Boolean))
    const dormantLeak = reg.filter(e => dormantIds.has(e.id))
    // 208 -> 229. Owner Ruling 3 took the last mention of 21 identities that carry no linked
    // source, so each is retired from the public bundle with its id reserved forever. The count
    // follows the registry; what is asserted is that NONE of them reaches the public list.
    t('entity-dormant-excluded', `the ${dormantIds.size} dormant identities are reserved and never public`,
      dormantIds.size === (dormantReg?.total ?? -1) && dormantLeak.length === 0 && totals.dormantReserved === dormantIds.size,
      `${dormantIds.size} reserved, ${dormantLeak.length} leaked`)

    // ⑥ No alias becomes its own duplicate row.
    //
    // A row is keyed by identity, so the failure mode is an identity whose CANONICAL is nothing but
    // another identity's alias — that is the row that would read as a duplicate of its own parent.
    // Sharing a spelling is not that: 46 spellings are claimed by more than one identity, every one
    // of them legitimately (BO is Barack Obama, Bruce Ohr AND Board Owner).
    const canonByLower = new Map(reg.map(e => [e.canonical.toLowerCase().trim(), e]))
    const aliasDupes = []
    for (const e of reg) {
      for (const a of e.aliases ?? []) {
        const other = canonByLower.get((a.text ?? '').toLowerCase().trim())
        if (!other || other.id === e.id) continue
        // Two identities may be connected by the alias registry — that is one row, not two, and the
        // merged-row model records it. Anything else is a duplicate.
        const merged = (view.mergedRows ?? []).some(m => m.identityIds.includes(e.id) && m.identityIds.includes(other.id))
        if (!merged) aliasDupes.push(`${a.text}: ${e.canonical} / ${other.canonical}`)
      }
    }
    t('entity-no-alias-duplicate-row', 'no alias is published as its own row beside its canonical',
      aliasDupes.length === 0, aliasDupes.length ? aliasDupes.slice(0, 3).join(' | ') : 'none')

    // ⑦ Shared aliases do not leak posts between entities.
    //
    // The registry attributes each occurrence to exactly one identity, so the test is that the
    // occurrence ledger never hands one occurrenceId to two of them — a string-keyed union would.
    const occPath = path.join(OUT, 'occurrence-provenance-audit.json')
    const occ = fs.existsSync(occPath) ? JSON.parse(fs.readFileSync(occPath, 'utf8')) : null
    if (occ) {
      const owner = new Map()
      let doubleClaimed = 0
      for (const r of occ.rows ?? []) {
        if (!r.entityId) continue
        const prev = owner.get(r.occurrenceId)
        if (prev && prev !== r.entityId) doubleClaimed++
        else owner.set(r.occurrenceId, r.entityId)
      }
      t('entity-no-shared-alias-leak', 'no occurrence is claimed by two identities',
        doubleClaimed === 0, `${owner.size} occurrences, ${doubleClaimed} double-claimed`)
    }

    // Repeat badges are per identity, clipped to that identity's own certified drops. The defect this
    // replaced painted one entity's in-post repeat onto every other entity in the same drop.
    const strayRepeat = []
    for (const e of reg) {
      const perPost = rows[e.id]?.perPostMentions ?? {}
      const own = new Set(e.posts ?? [])
      const total = Object.values(perPost).reduce((a, b) => a + b, 0)
      for (const pn of Object.keys(perPost)) if (!own.has(Number(pn))) strayRepeat.push(`${e.canonical}#${pn}`)
      if (total > (e.mentions ?? 0)) strayRepeat.push(`${e.canonical} total ${total}>${e.mentions}`)
    }
    t('entity-repeats-own-posts-only', 'per-post mention counts stay inside the identity that earned them',
      strayRepeat.length === 0, strayRepeat.length ? strayRepeat.slice(0, 3).join(', ') : 'clean')

    // ⑧ Rows and identities reconcile. Fewer rows than identities is allowed ONLY where the alias
    // registry connects them, and the difference must be exactly what the merge model accounts for.
    const mergedIds = new Set((view.mergedRows ?? []).flatMap(m => m.identityIds))
    const accounted = totals.canonicalEntities - totals.publicRows === mergedIds.size - (view.mergedRows ?? []).length
    t('entity-rows-reconcile', 'row count and identity count reconcile through the merge model',
      accounted && totals.mergedIdentities === mergedIds.size,
      `${totals.publicRows} rows / ${totals.canonicalEntities} identities / ${mergedIds.size} in ${(view.mergedRows ?? []).length} merged rows`)

    // A merged row must be labelled by its highest-post identity, which is what the owner ruled.
    const badLabel = (view.mergedRows ?? []).filter(m => {
      const top = [...m.identities].sort((a, b) => b.posts - a.posts || b.mentions - a.mentions || a.canonical.localeCompare(b.canonical))[0]
      return top.canonical !== m.label
    })
    t('entity-merged-label-most-posts', 'a merged row is named by the identity with the most posts',
      badLabel.length === 0, badLabel.length ? badLabel.map(m => m.label).join(', ') : `${(view.mergedRows ?? []).length} merged rows`)

    // A merged row may not mix the components, or the breakdown stops describing the rows.
    const mixedMerge = (view.mergedRows ?? []).filter(m => {
      const kinds = new Set(m.identityIds.map(id => rows[id]?.kind))
      return kinds.size > 1
    })
    t('entity-merged-single-component', 'no merged row mixes prose and source-only identities',
      mixedMerge.length === 0, `${(view.mergedRows ?? []).length} merged rows checked`)
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
    // 230 -> 231. The edge is PRESERVED wherever Step 3B-1 unified a directive-question pair, so
    // this figure tracks the pairs and not the certified overlap, which fell to 173 as those pairs
    // became one primary plus a non-painting secondary. Both are asserted; they are not the same
    // number and never were.
    t('rel-qd', 'Question ↔ Directive edges = the certified 231', bt.question_directive === 231, bt.question_directive)
    t('rel-ce', 'Entity ↔ Code edges come from the 32 stored cross-links',
      new Set(edges.filter(e => e.type === 'entity_code').map(e => e.from.id)).size === 32,
      new Set(edges.filter(e => e.type === 'entity_code').map(e => e.from.id)).size)
    // Q CONCLUSIONS IS RETIRED. The gate is that the edge type is gone, not that it holds 964.
    t('rel-conclusions-retired', 'Claim → Conclusion edges are retired', !bt.claim_conclusion, bt.claim_conclusion ?? 0)
    // 438 -> 337 across five withdrawals of claims that carried sourceProvided, then 337 -> 330 on
    // 2026-08-23 when the scripture ruling withdrew nine more (the Ephesians sentences on #2403,
    // #3593 and #3594). The attribute travels with the ROW, never with the section, so it leaves
    // when the row does. Read from build-relationships.mjs's own gate rather than a second copy.
    t('rel-source', 'Claim → Source provided edges = the certified 330', bt.claim_source_provided === 330, bt.claim_source_provided)
    // Read from the contract: a prediction IS an assertion, so this edge count is Predictions'
    // figure and not a second opinion about it. The literal went stale on the 2026-08-20 ruling.
    t('rel-predictions', `Prediction → assertion edges = the certified ${CANONICAL.predictions.occurrences.toLocaleString()}`,
      bt.prediction_assertion === CANONICAL.predictions.occurrences, bt.prediction_assertion)
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
    // The analysis map counts question RECORDS on drops, which includes the 182 Step 3B-1 marked
    // secondary or withdrawn rather than deleted. The certified figure counts the primary set. The
    // reconciliation is between the map and the shipped records, not between the map and the
    // headline — comparing it to the headline reported a defect that is the marking working.
    const qMarkedRel = questions.filter(q => q.occurrences !== undefined && q.semanticLayer && q.semanticLayer !== 'primary').length
    t('rel-map-questions', 'analysis map totals reconcile with the shipped question records',
      mapQ === CANONICAL.questions.occurrences + qMarkedRel,
      `${mapQ} vs ${CANONICAL.questions.occurrences} certified + ${qMarkedRel} marked`)
    t('rel-map-directives', 'analysis map totals reconcile with certified Directives', mapD === CANONICAL.directives.occurrences, mapD)
    t('rel-map-emphasis-zero', 'the analysis map counts no Emphasis', !mapE, mapE)

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
    t('search-questions', 'indexed Questions = certified 6,454', bs.questions === CANONICAL.questions.occurrences, bs.questions)
    t('search-directives', 'indexed Directives = certified 2,552', bs.directives === CANONICAL.directives.occurrences, bs.directives)
    t('search-claims', 'indexed Claims = certified 4,181', bs.claims === CANONICAL.claims.occurrences, bs.claims)
    t('search-predictions', 'indexed Predictions = certified 630', bs.predictions === CANONICAL.predictions.occurrences, bs.predictions)
    t('search-evidence', 'indexed Evidence = certified 6,590', bs.evidence === CANONICAL.evidence.occurrences, bs.evidence)
    t('search-entities', 'indexed Entities = certified 1,445', bs.entities === CANONICAL.entities.canonical, bs.entities)
    t('search-themes', 'indexed Themes = certified 2,395', bs.themes === CANONICAL.themes.assignments, bs.themes)
    t('search-codes', 'indexed Codes = certified 739 distinct', bs.codes === CANONICAL.codes.distinct, bs.codes)
    t('search-emphasis-gone', 'the search index carries no Emphasis section', !bs.emphasis, bs.emphasis ?? 0)
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
