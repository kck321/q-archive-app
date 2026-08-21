// The occurrence schema, proved against the real module.
//
//   node scripts/test-occurrence-model.mjs
//
// A schema whose validator is never exercised is a comment. Each check below is a way a record can
// be wrong that would otherwise travel downstream looking plausible: a category counted twice, an
// entity painted over characters that do not contain it, a key that disagrees with its own offsets.
import {
  PRIMARY_CATEGORIES, SOURCE_DISPOSITIONS, REVIEW_DISPOSITIONS,
  makeOccurrence, validateOccurrence, occurrenceKey, countByLayer, findSameCategoryOverlaps,
} from './lib/occurrenceModel.mjs'

let failed = 0
const check = (ok, label, got = '') => {
  if (!ok) failed++
  console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(70)} ${got}`)
}
const base = {
  postNum: 4923, kind: 'claims', start: 10, end: 28, text: 'Dearest Virginia -',
  sentenceId: 'p4923-s001',
}

console.log('\nOCCURRENCE MODEL (Step 3B-0)\n')

// ── identity ────────────────────────────────────────────────────────────────
{
  const o = makeOccurrence({ ...base, primaryCategory: 'claim' })
  check(o.occurrenceKey === '4923|claims|10|28', 'the key is post|kind|start|end', o.occurrenceKey)
  check(validateOccurrence(o).length === 0, 'a well-formed record validates')
  const tampered = { ...o, start: 11 }
  check(validateOccurrence(tampered).some(e => /occurrenceKey does not match/.test(e)),
    'a key that disagrees with its own offsets is rejected')
}

// ── ranges ──────────────────────────────────────────────────────────────────
{
  check(validateOccurrence(makeOccurrence({ ...base, end: 10 })).some(e => /empty or reversed/.test(e)),
    'an empty range is rejected')
  check(validateOccurrence(makeOccurrence({ ...base, start: 40, end: 20 })).some(e => /empty or reversed/.test(e)),
    'a reversed range is rejected')
}

// ── primary / secondary ─────────────────────────────────────────────────────
{
  const ok = makeOccurrence({ ...base, primaryCategory: 'question',
    secondarySemantics: [{ category: 'directive', reason: 'imperative frame around the question' }] })
  check(validateOccurrence(ok).length === 0, 'a Question with a Directive secondary is valid')

  const doubled = makeOccurrence({ ...base, primaryCategory: 'claim',
    secondarySemantics: [{ category: 'claim', reason: 'x' }] })
  check(validateOccurrence(doubled).some(e => /both the primary and a secondary/.test(e)),
    'a category cannot be its own secondary — that is the double count')

  const twice = makeOccurrence({ ...base, primaryCategory: 'claim',
    secondarySemantics: [{ category: 'directive', reason: 'a' }, { category: 'directive', reason: 'b' }] })
  check(validateOccurrence(twice).some(e => /listed twice/.test(e)), 'a secondary cannot be listed twice')

  const noReason = makeOccurrence({ ...base, primaryCategory: 'claim',
    secondarySemantics: [{ category: 'directive' }] })
  check(validateOccurrence(noReason).some(e => /carries no reason/.test(e)),
    'a secondary without a reason is rejected')

  check(validateOccurrence(makeOccurrence({ ...base, primaryCategory: 'theme' }))
    .some(e => /is not one of/.test(e)), 'Theme is NOT a primary category (owner ruling 2026-08-21)')
}

// ── dispositions ────────────────────────────────────────────────────────────
{
  check(validateOccurrence(makeOccurrence({ ...base, sourceDisposition: 'quoted_source' })).length === 0,
    'quoted_source is a valid source disposition')
  check(validateOccurrence(makeOccurrence({ ...base, sourceDisposition: 'invented' }))
    .some(e => /sourceDisposition/.test(e)), 'an unknown source disposition is rejected')
  check(validateOccurrence(makeOccurrence({ ...base, reviewDispositions: ['ignored'] }))
    .some(e => /reviewDisposition/.test(e)), 'an unknown review disposition is rejected')
  // More than one review fact must survive - a single field would overwrite one with the other.
  const multi = makeOccurrence({ ...base, primaryCategory: 'claim', reviewDispositions: ['contextual', 'emphasis'] })
  check(validateOccurrence(multi).length === 0, 'a span can be BOTH contextual and emphasis')
  check(multi.reviewDispositions.length === 2, 'and both facts are retained', JSON.stringify(multi.reviewDispositions))
  check(validateOccurrence(makeOccurrence({ ...base, reviewDispositions: ['emphasis', 'emphasis'] }))
    .some(e => /listed twice/.test(e)), 'a duplicate review disposition is rejected')
}

// ---- cardinality: primaryCategory is ZERO-or-one ----
//
// A sentence deliberately reviewed and found to be context-only must be storable WITHOUT a
// category. Requiring one would eventually force a false Claim onto it.
{
  check(validateOccurrence(makeOccurrence({ ...base, primaryCategory: null, reviewDispositions: ['context_only'] })).length === 0,
    'null primary + context_only is valid')
  for (const d of ['signature', 'structural', 'source_boundary_exception']) {
    check(validateOccurrence(makeOccurrence({ ...base, primaryCategory: null, reviewDispositions: [d] })).length === 0,
      `null primary + ${d} is valid`)
  }
  check(validateOccurrence(makeOccurrence({ ...base, primaryCategory: 'claim', reviewDispositions: ['contextual'] })).length === 0,
    'a Claim marked contextual is valid')
  check(validateOccurrence(makeOccurrence({ ...base, primaryCategory: 'claim', reviewDispositions: ['context_only'] }))
    .some(e => /context_only cannot carry a primaryCategory/.test(e)),
    'context_only with a category is rejected - that is what contextual is for')
  check(validateOccurrence(makeOccurrence({ ...base, primaryCategory: null, reviewDispositions: ['contextual', 'context_only'] }))
    .some(e => /cannot both apply/.test(e)), 'contextual and context_only are mutually exclusive')
}

// ── entity associations ─────────────────────────────────────────────────────
{
  const body = 'Goodnight BO.\nMore text here.'
  const mk = assoc => makeOccurrence({ postNum: 111, kind: 'namedEntities', start: 10, end: 12, text: 'BO',
    entityAssociations: [assoc] })

  const good = mk({ identity: 'Hussein', kind: 'literal', aliasUsed: 'BO', literalText: 'BO', start: 10, end: 12 })
  check(validateOccurrence(good, body).length === 0, 'a literal association that matches the body is valid')

  check(validateOccurrence(mk({ identity: 'Hussein', kind: 'literal', aliasUsed: 'BO' }), body)
    .some(e => /carries no offsets/.test(e)), 'a literal association without offsets is rejected')

  check(validateOccurrence(mk({ identity: 'Hussein', kind: 'literal', aliasUsed: 'BO', start: 10, end: 12 }), body)
    .some(e => /carries no literalText/.test(e)), 'a literal association without literalText is rejected')

  // THE ASSERTION THAT MATTERS: the characters at those offsets must BE the alias.
  const wrongPlace = mk({ identity: 'Hussein', kind: 'literal', aliasUsed: 'BO', literalText: 'BO', start: 0, end: 2 })
  check(validateOccurrence(wrongPlace, body).some(e => /not "BO"/.test(e)),
    'an alias attached to the WRONG characters is rejected', 'body[0..2] is "Go"')

  const canonicalPainted = mk({ identity: 'Hussein', kind: 'literal', aliasUsed: 'BO', literalText: 'Hussein', start: 10, end: 12 })
  check(validateOccurrence(canonicalPainted, body).some(e => /is not the alias/.test(e)),
    'the canonical name may not be substituted for the spelling Q used')

  const indirect = makeOccurrence({ ...base, kind: 'namedEntities',
    entityAssociations: [{ identity: 'Hussein', kind: 'indirect' }] })
  check(validateOccurrence(indirect).length === 0,
    'an indirect association needs no alias or offsets - it never paints')
}

// ---- the record's own text must match its own range ----
{
  const body2 = 'Goodnight BO.\nMore text here.'
  const ok = makeOccurrence({ postNum: 111, kind: 'claims', start: 0, end: 13, text: 'Goodnight BO.', primaryCategory: 'claim' })
  check(validateOccurrence(ok, body2).length === 0, 'a record whose text matches its offsets is valid')
  const stale = makeOccurrence({ postNum: 111, kind: 'claims', start: 0, end: 13, text: 'Goodnight XX.', primaryCategory: 'claim' })
  check(validateOccurrence(stale, body2).some(e => /not the stored text/.test(e)),
    'a record whose stored text disagrees with its characters is rejected')
}

// ── the two figures stay apart ──────────────────────────────────────────────
{
  const rows = [
    makeOccurrence({ ...base, primaryCategory: 'question', secondarySemantics: [{ category: 'directive', reason: 'r' }] }),
    makeOccurrence({ ...base, start: 30, end: 40, primaryCategory: 'directive' }),
  ]
  const { primary, secondary } = countByLayer(rows)
  check(primary.question === 1 && primary.directive === 1, 'primary counts by painted category',
    JSON.stringify(primary))
  check(secondary.directive === 1, 'secondary counts separately', JSON.stringify(secondary))
  check(primary.directive !== 2, 'a secondary is NOT added to its section\'s primary total')
}

// ---- counts are separated by SOURCE as well as by layer ----
//
// Separating primary from secondary was not enough on its own: a quoted or paraphrased sentence
// can be a primary Claim and still not be Q's claim.
{
  const qClaim = makeOccurrence({ ...base, start: 0, end: 5, text: 'aaaaa', primaryCategory: 'claim' })
  const quoted = makeOccurrence({ ...base, start: 10, end: 15, text: 'bbbbb', primaryCategory: 'claim', sourceDisposition: 'quoted_source' })
  const para = makeOccurrence({ ...base, start: 20, end: 25, text: 'ccccc', primaryCategory: 'claim', sourceDisposition: 'editorial_paraphrase' })
  const c = countByLayer([qClaim, quoted, para])
  check(c.primary.claim === 3, 'the global primary total sees all three', String(c.primary.claim))
  check(c.qAuthoredPrimary.claim === 1, 'but only ONE is a Q-authored Claim', String(c.qAuthoredPrimary.claim))
  check(c.bySource.quoted_source.primary.claim === 1, 'quoted-source Claims are counted apart')
  check(c.bySource.editorial_paraphrase.primary.claim === 1, 'editorial paraphrases are counted apart')
}

// ── overlap detection, by range and by shape ────────────────────────────────
{
  const mk = (start, end, cat) => makeOccurrence({ ...base, start, end, primaryCategory: cat })
  const found = findSameCategoryOverlaps([
    mk(0, 20, 'claim'), mk(5, 12, 'claim'),        // nested
    mk(40, 60, 'claim'), mk(50, 70, 'claim'),      // partial overlap
    mk(80, 90, 'claim'), mk(80, 90, 'claim'),      // identical range
    mk(100, 110, 'claim'), mk(105, 115, 'question'), // different categories — not an overlap
  ])
  const byRel = found.reduce((m, f) => { m[f.relation] = (m[f.relation] ?? 0) + 1; return m }, {})
  check(byRel.NESTED === 1, 'containment is reported as NESTED', JSON.stringify(byRel))
  check(byRel.PARTIAL_OVERLAP === 1, 'a partial overlap is reported separately — longest-wins is not safe for it')
  check(byRel.IDENTICAL_RANGE === 1, 'an identical range is a duplicate key, not a boundary problem')
  check(found.length === 3, 'two different categories over the same characters is NOT an overlap', String(found.length))
}

// ── in-post repeats survive ─────────────────────────────────────────────────
{
  const a = makeOccurrence({ postNum: 111, kind: 'claims', start: 1160, end: 1173, text: 'Fantasy land.', primaryCategory: 'claim' })
  const b = makeOccurrence({ postNum: 111, kind: 'claims', start: 1174, end: 1187, text: 'Fantasy land.', primaryCategory: 'claim' })
  check(a.occurrenceKey !== b.occurrenceKey, 'identical wording at different offsets is two occurrences',
    `${a.occurrenceKey} vs ${b.occurrenceKey}`)
  check(findSameCategoryOverlaps([a, b]).length === 0, 'and they do not register as an overlap')
}

console.log(`\n  ${failed ? `${failed} FAILED` : 'all checks passed'}\n`)
process.exit(failed ? 1 : 0)
