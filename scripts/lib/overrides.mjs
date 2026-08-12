// Human classification calls that no rule can reach.
//
// Some units cannot be classified from the sentence alone — they depend on the line before
// them. "Identify and list." reads as an information request in isolation, but in #184 the
// preceding sentence already states what to investigate, which makes it an instruction to
// act rather than a request for an answer. That was a review decision, not a derivation.
//
// Kept HERE so every auditor honours the same calls. When the questions audit and the
// directives audit disagreed on exactly this unit (56/57 on the seed cross-check), the cause
// was that one of them held the override privately.
//
// Key: the unit text, lowercased with punctuation stripped.

export const CLASSIFICATION_OVERRIDES = new Map([
  ['identify and list', {
    klass: 'Q_DIRECTIVE',
    semanticFunction: 'analytical_directive',
    grammaticalForm: 'imperative',
    countsTowardQQuestionTotal: false,
    decidedBy: 'review',
    post: 184,
    why: 'the preceding sentence already states what to investigate, so this instructs an action rather than asking for information',
  }],
])

export const overrideKey = t =>
  (t ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim()

export const overrideFor = t => CLASSIFICATION_OVERRIDES.get(overrideKey(t)) ?? null
