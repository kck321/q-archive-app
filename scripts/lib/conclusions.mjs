// Post-level conclusion detection.
//
// v1 asked a per-unit regex for therefore|thus|hence|that means and found 32, against 9,024
// stored impliedConclusions. That failure is structural, not a matter of a thin word list: a
// conclusion is defined by its RELATIONSHIP to what came before it, which a per-unit test
// cannot see. So this reads the post.
//
// Modelled as an ATTRIBUTE, not an exclusive class: a conclusion is still asserting something,
// so it stays primaryClass Q_CLAIM with isConclusion true. That mirrors how the
// Question <-> Directive overlap is handled and avoids forcing a choice between the two.
//
// The rule the review set: do NOT assume every declarative follow-up is a conclusion. Position
// alone proves nothing. A positive signal of inference is required, and there is a counter-
// signal too — a unit that introduces NEW named entities is supplying fresh information, which
// is a claim, not a synthesis of what is already on the page.

const INFERENCE_MARKER = /\b(therefore|thus|hence|ergo|which means|that means|this means|it follows|as a result|the result is|in other words|bottom line|the point is|conclusion)\b/i

// Anaphora — the unit points back at material already in the post.
const ANAPHORA = /^(this|that|these|those|it|they|he|she|there|such|the result|the answer|the truth|the point|the reason|the conclusion|the takeaway)\b/i

// Q's habitual set-up for a takeaway. A question of this shape asks the reader to draw one.
const ASKS_FOR_TAKEAWAY = /\b(what does (this|that) tell you|what does (this|that) mean|why is (this|that) (relevant|important)|what do you (notice|see)|think about it|do you (understand|see) (it|now))\b/i

// Summary/closing idiom Q uses to state the implication.
const TAKEAWAY_IDIOM = /^(the (only|real|whole) (way|point|truth|answer|reason)|nothing (can|is)|everything (is|has)|it('| i)s (all|not) |there (is|are) no|no (coincidences|deals|escape)|you (now )?(have|know|see)|we (are|have) )/i

const PROPER = /\b[A-Z][A-Za-z0-9'’.-]{2,}\b/g
const STOP = new Set(['The', 'This', 'That', 'These', 'Those', 'They', 'There', 'What', 'When', 'Where', 'Why', 'How', 'Who', 'And', 'But', 'For', 'Not', 'All', 'You', 'Our', 'Their', 'His', 'Her', 'Its'])

const propersIn = t => new Set([...(t.match(PROPER) ?? [])].filter(w => !STOP.has(w)))

/**
 * Decide whether an assertive unit is also a conclusion, given the post before it.
 *
 * @param {string} text        the unit
 * @param {object} ctx
 *   ctx.priorUnits   string[]  Q-authored units earlier in the same post, in order
 *   ctx.priorIsQuestion boolean  the immediately preceding unit is a question
 *   ctx.questionCount number   questions earlier in the post
 *   ctx.hasEvidence  boolean   a link, list or document reference appears earlier
 *   ctx.isLastAssertion boolean this is the final assertive unit in the post
 * @returns {{isConclusion:boolean, why:string, confidence:string}}
 */
export function conclusionSignal(text, ctx = {}) {
  const t = (text ?? '').trim()
  if (!t) return { isConclusion: false, why: 'empty', confidence: 'LOW' }

  const priorText = (ctx.priorUnits ?? []).join(' ')
  // Nothing before it in the post — there is nothing to conclude FROM.
  if (!priorText) return { isConclusion: false, why: 'first unit in the post — nothing to draw from', confidence: 'HIGH' }

  const signals = []
  if (INFERENCE_MARKER.test(t)) signals.push('explicit inference marker')
  if (ANAPHORA.test(t)) signals.push('refers back to earlier material')
  if (ctx.priorIsQuestion) signals.push('answers the question immediately before it')
  if ((ctx.questionCount ?? 0) >= 2) signals.push('closes a rhetorical question sequence')
  if (ASKS_FOR_TAKEAWAY.test(priorText)) signals.push('the post explicitly asks for the takeaway')
  if (TAKEAWAY_IDIOM.test(t)) signals.push('summary idiom')
  if (ctx.hasEvidence && ctx.isLastAssertion) signals.push('final assertion after evidence')

  if (!signals.length) return { isConclusion: false, why: 'no inference signal — a declarative that follows other text is still just a claim', confidence: 'HIGH' }

  // Counter-signal: new named entities mean new information, not a synthesis.
  const fresh = [...propersIn(t)].filter(w => !priorText.includes(w))
  const introducesNew = fresh.length >= 2

  // An explicit marker outranks the counter-signal — "Therefore RR must also be dirty."
  // legitimately names someone while still being a deduction.
  const explicit = INFERENCE_MARKER.test(t)
  if (introducesNew && !explicit) {
    return { isConclusion: false, why: `introduces new subjects (${fresh.slice(0, 3).join(', ')}) — supplying information rather than drawing from it`, confidence: 'MEDIUM' }
  }

  const strong = explicit || signals.length >= 2
  return {
    isConclusion: true,
    why: signals.join('; '),
    confidence: strong ? 'HIGH' : 'MEDIUM',
  }
}
