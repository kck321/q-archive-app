// THE SHAPE-RULE CASCADE — the only copy.
//
// One adjudicated primary category per complete sentence, decided by the sentence's SHAPE. It was
// written for build-step3b1-dryrun.mjs and lived inline there until the held-action adjudication
// needed to re-run it: six of the ten held rows were held because the generator called classify()
// with an EMPTY sentenceText, which fails R1, R5, R2, R3 and R2B in turn and falls out of the
// bottom at R4_DECLARATIVE. The rule never saw those sentences. Re-testing them means running this
// cascade, and a second copy of a rule that decides certified categories is exactly the shape that
// lets two callers drift apart — so there is one copy and both import it.
//
// Moved verbatim. No regex, no order, no comment changed.

// THE FRAME VERB CAN SIT BEHIND A SUBORDINATE CLAUSE.
//
// Anchoring this at the start of the string was wrong, and #1425 is the proof:
//
//   "Given we have now undeniably [on purpose] verified ourselves to be an inside source, expect
//    the MSM [Clown Army] to attack in full cooperation w/ foreign and domestic assets."
//
// That is the same forecast-in-an-imperative-frame as "Expect massive riots", and it was missed
// only because a "Given ..." clause runs ahead of the frame verb. No rule fired, so the sentence
// was held as a guess while 27 sentences of identical shape were classified. One optional leading
// clause, bounded so it cannot swallow a paragraph hunting for the word.
export const FRAME_PREDICTION = /^\s*(?:(?:given|if|when|since|because|now that|as)\b[^,]{0,160},\s*)?(?:expect\b|rest assured\b|make no mistake\b|fear not\b)/i
export const IMPERATIVE = /^\s*(?:[A-Z][a-z]+|[A-Z]{2,})\b/
export const DIRECT_ORDER = /^\s*(?:ask|be|read|re-?read|watch|listen|find|follow|learn|look|think|trust|remember|study|review|prepare|expect|define|name|list|count|compare|apply|refocus|focus|stay|keep|do not|don'?t|never|always|use|pray|enjoy|share|spread|dig|archive|save|note|consider|imagine|understand|know|see|open|close|return|go|stand|fight|unite|rise|wake|shine|protect|defend|demand|hold|push|track|monitor|verify|confirm|question|challenge|reject|ignore|forget|drop|move|act|vote|register|call|contact|email|post|tweet|screenshot|bookmark|download|upload|repeat|continue|proceed|begin|start|stop|wait|pause|slow|speed)\b/i

export function classify(sentenceText, kinds) {
  const t = String(sentenceText ?? '').trim()
  // 1 — interrogative wins outright.
  if (/\?\s*$/.test(t) || /^\s*(?:who|what|when|where|why|how|which|whose|whom|is|are|was|were|do|does|did|can|could|will|would|should|shall|have|has|had)\b.*\?/i.test(t)) {
    return { primary: 'question', rule: 'R1_INTERROGATIVE' }
  }
  // 5 — a forecast wearing an imperative frame. Checked BEFORE the imperative rule, because
  // "Expect massive riots" opens with a verb and is dominated by what it says will happen.
  if (FRAME_PREDICTION.test(t)) return { primary: 'prediction', rule: 'R5_FUTURE_FRAME' }
  // 2 — a direct instruction.
  if (DIRECT_ORDER.test(t) && kinds.includes('directives')) return { primary: 'directive', rule: 'R2_IMPERATIVE' }
  // 3 — a dominant future assertion.
  if (/\b(?:will|shall|coming|soon|to be announced|tba|next week|next month|incoming)\b/i.test(t) && kinds.includes('predictions')) {
    return { primary: 'prediction', rule: 'R3_FUTURE_ASSERTION' }
  }
  // 2b — an imperative where the archive certified a directive, even without a listed verb.
  if (kinds.includes('directives') && IMPERATIVE.test(t) && !/\b(?:is|are|was|were|has|have|had)\b/i.test(t.split(/\s+/).slice(0, 3).join(' '))) {
    return { primary: 'directive', rule: 'R2B_IMPERATIVE_CERTIFIED' }
  }
  // 4 — otherwise a proposition.
  if (kinds.includes('claims')) return { primary: 'claim', rule: 'R4_DECLARATIVE' }
  return { primary: kinds[0].replace(/s$/, ''), rule: 'R6_SOLE_CATEGORY' }
}
export const singular = k => k === 'claims' ? 'claim' : k === 'questions' ? 'question' : k === 'directives' ? 'directive' : 'prediction'
