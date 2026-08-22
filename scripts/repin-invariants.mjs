// One-shot: bring audit-cross-section.mjs's remaining literals back to the state they describe.
//
//   node scripts/repin-invariants.mjs
//
// Three kinds of change and they are not the same kind:
//
//   POPULATION   the check was counting the wrong set. `questions` counted every row carrying an
//                occurrences field, which since Step 3B-1 includes 182 records MARKED secondary or
//                withdrawn — records the search index and every certified total exclude. Moving it
//                to the primary population is a correction, not a re-pin.
//   RETIRED      Q Conclusions went the way Emphasis did, and a gate asserting a retired section's
//                figure is a gate that goes green the day the section comes back.
//   RE-PIN       a measured figure moved because an adjudication moved it, and the literal is the
//                record of what it was. Each one carries what moved it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(ROOT, 'scripts', 'audit-cross-section.mjs')
let s = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!s.includes(from)) { console.error(`  X not found:\n${from}`); process.exit(1) }
  s = s.replace(from, to)
}

// ── POPULATION: questions ───────────────────────────────────────────────────
swap(
  "  const qCounted = questions.filter(q => q.occurrences !== undefined)",
  "  // THE CERTIFIED POPULATION IS THE PRIMARY ONE. Step 3B-1 marks a question record `secondary`\n"
  + "  // when the sentence's primary category went elsewhere and `withdrawn` when the record was\n"
  + "  // superseded — 182 of them — and both keep their occurrences field, because the record is not\n"
  + "  // deleted (see \"no question record deleted to move a count\"). The search index, the section\n"
  + "  // headline and every certified total count the primary set, so this must too; counting the\n"
  + "  // field's presence made it report 6,503 against a certified 6,321 and call that a defect.\n"
  + "  const qCounted = questions.filter(q => q.occurrences !== undefined\n"
  + "    && (!q.semanticLayer || q.semanticLayer === 'primary'))")

swap(
  "  t('questions', 'Questions = 6,454 certified occurrences', qCounted.length === CANONICAL.questions.occurrences, qCounted.length)",
  "  t('questions', `Questions = ${CANONICAL.questions.occurrences.toLocaleString()} certified primary occurrences`, qCounted.length === CANONICAL.questions.occurrences, qCounted.length)")

// ── POPULATION: shipped question rows ───────────────────────────────────────
swap(
  "  t('q-rows', `Questions ships ${(CANONICAL.questions.occurrences + 134).toLocaleString()} rows for ${CANONICAL.questions.occurrences.toLocaleString()} certified`,\n"
  + "    questions.length === CANONICAL.questions.occurrences + 134, questions.length)",
  "  // The shipped file is the certified primary set, PLUS the records Step 3B-1 marked rather than\n"
  + "  // deleted, PLUS the 134 editorial normalisations. Derived from all three rather than from a\n"
  + "  // literal, because two of the three have moved since this was written and the third will.\n"
  + "  const qMarked = questions.filter(q => q.occurrences !== undefined && q.semanticLayer && q.semanticLayer !== 'primary')\n"
  + "  t('q-rows', `Questions ships ${CANONICAL.questions.occurrences.toLocaleString()} certified + ${qMarked.length} marked + 134 editorial`,\n"
  + "    questions.length === CANONICAL.questions.occurrences + qMarked.length + 134, questions.length)")

// ── RETIRED: sections ───────────────────────────────────────────────────────
swap(
  "  t('all-declared', 'all ten sections declare a provenance contract', SECTION_CONTRACTS.length === 10, SECTION_CONTRACTS.length)",
  "  // Nine, not ten: Emphasis is retired and its contract went with it. The assertion is that every\n"
  + "  // section SHIPPING declares one, so the number follows the sections rather than leading them.\n"
  + "  t('all-declared', `all ${SECTION_CONTRACTS.length} shipping sections declare a provenance contract`,\n"
  + "    SECTION_CONTRACTS.length === 9 && SECTION_CONTRACTS.every(c => c.artifact && c.certifiedCount !== undefined), SECTION_CONTRACTS.length)")

swap(
  "  t('overlap-conclusions', 'conclusions are an attribute of 964 assertions, not a separate count', conclusions === 964, conclusions)",
  "  // Q CONCLUSIONS IS RETIRED, like Emphasis. The gate is now that nothing regenerated it: no\n"
  + "  // claimMeta.isConclusion survives retire-sections.mjs and no impliedConclusions array does.\n"
  + "  t('overlap-conclusions-retired', 'Q Conclusions is retired: no conclusion attribute survives',\n"
  + "    conclusions === 0 && posts.every(p => !p.postAnalysis?.impliedConclusions?.length),\n"
  + "    `${conclusions} attributes, ${posts.filter(p => p.postAnalysis?.impliedConclusions?.length).length} posts with the array`)")

// ── RE-PIN: measured figures an adjudication moved ──────────────────────────
swap(
  "  t('overlap-qd', 'Question ↔ Directive overlap = 228, declared', qd === 230, qd)",
  "  // 230 -> 173. Step 3B-1's DIRECTIVE_QUESTION_UNIFIED actions resolve a sentence that is both\n"
  + "  // into ONE primary with the other recorded as a non-painting secondary, so the pair stops being\n"
  + "  // two certified records over one sentence. The relationship edge is preserved either way and is\n"
  + "  // asserted separately by 'question_directive relationship preserved on every unified pair'.\n"
  + "  t('overlap-qd', 'Question ↔ Directive overlap = 173, declared', qd === 173, qd)")

const repins = [
  ["      t('rc-source-excluded', 'none of the held mentions is counted in Entities',",
    "      t('rc-source-excluded', 'none of the held mentions is counted in Entities',"],
]

// 10d — the three component figures the entity cleanup and the lane-B reviews moved
swap(
  "    t('entity-mentions-8798', 'certified prose mentions = 8,798',",
  "    // 8,798 -> 8,821: the queue rulings and the Nellie Ohr alias added, Owner Ruling 3 and the\n"
  + "    // lane-B reviews withdrew or migrated, and the duplicate-record reconciliation took 99 off.\n"
  + "    // Read from the contract rather than the label, which is what went stale.\n"
  + "    t('entity-mentions-certified', `certified prose mentions = ${CANONICAL.entities.mentions.toLocaleString()}`,")

swap(
  "    t('entity-source-only-135', 'the 135 source-only identities are a labelled component',\n"
  + "      totals.sourceOnly === 135 && srcIds.size === 135 && srcIds.size === (sourceOnlyReg?.total ?? -1)\n"
  + "      && (view.breakdown ?? []).some(b => b.key === 'sourceOnly' && b.count === 135),\n"
  + "      `${srcIds.size} rows / registry ${sourceOnlyReg?.total}`)",
  "    // 135 -> 138. Judicial Watch (Owner Ruling 3) plus Reuters and Ann Coulter (lane B) lost their\n"
  + "    // last prose mention and each has a bound linked source, so each keeps a row as source-only\n"
  + "    // rather than going dormant. The registry is the authority; the view must equal it exactly.\n"
  + "    t('entity-source-only-component', `the ${sourceOnlyReg?.total} source-only identities are a labelled component`,\n"
  + "      totals.sourceOnly === sourceOnlyReg?.total && srcIds.size === sourceOnlyReg?.total\n"
  + "      && (view.breakdown ?? []).some(b => b.key === 'sourceOnly' && b.count === sourceOnlyReg?.total),\n"
  + "      `${srcIds.size} rows / registry ${sourceOnlyReg?.total}`)")

swap(
  "    t('entity-dormant-excluded', 'the 208 dormant identities are reserved and never public',\n"
  + "      dormantIds.size === 208 && dormantLeak.length === 0 && totals.dormantReserved === 208,\n"
  + "      `${dormantIds.size} reserved, ${dormantLeak.length} leaked`)",
  "    // 208 -> 229. Owner Ruling 3 took the last mention of 21 identities that carry no linked\n"
  + "    // source, so each is retired from the public bundle with its id reserved forever. The count\n"
  + "    // follows the registry; what is asserted is that NONE of them reaches the public list.\n"
  + "    t('entity-dormant-excluded', `the ${dormantIds.size} dormant identities are reserved and never public`,\n"
  + "      dormantIds.size === (dormantReg?.total ?? -1) && dormantLeak.length === 0 && totals.dormantReserved === dormantIds.size,\n"
  + "      `${dormantIds.size} reserved, ${dormantLeak.length} leaked`)")

fs.writeFileSync(p, s)
console.log('audit-cross-section.mjs re-pinned')
