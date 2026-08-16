// Adjudicated verdicts for the certification conflicts.
//
// Each verdict is a READ decision on a specific occurrence, not a rule applied in bulk. Where the
// text genuinely belongs to a certified section it is proposed for addition; where it does not,
// it keeps its coverage disposition and no frozen count moves. Nothing here is applied — the
// proposed changes are reported for approval first.

/** All 21 are Q-posted references the Evidence audit missed to the space-after-protocol form. */
export const EVIDENCE_VERDICT = 'ADD_EVIDENCE'

/**
 * Both from #2123. "Note the time?" and "Note Apple's stock image(s)?" end in a question mark and
 * ask the reader to observe something — the information-request shape that is already certified
 * as BOTH a question and a directive 177 times. Proposed as questions with an attention-family
 * directive cross-link, which is the existing overlap model rather than a new one.
 */
export const QUESTION_VERDICTS = {
  'Note the time?': { verdict: 'ADD_Q_QUESTION', alsoDirective: 'attention' },
  'Note Apple’s stock image(s)?': { verdict: 'ADD_Q_QUESTION', alsoDirective: 'attention' },
}

/**
 * Neither is a segmentation error. #1927 is a verbatim quotation from an Executive Order and #56
 * is a passage from a news article — pasted source material the block detector did not close
 * over. They are already represented as references; the honest verdict is a disposition, not a
 * new certified occurrence.
 */
export const SEGMENTATION_VERDICT = 'SOURCE_OR_REFERENCE'

/**
 * Bracketed prose. Q's brackets carry three different things here and lumping them together is
 * how a "code" section swallows ordinary writing:
 *   a bracketed QUESTION is a question that happens to be in brackets
 *   a bracketed PROPOSITION is a claim that happens to be in brackets
 *   a bracketed NAME or REFERENCE is a label
 * None of them is coded notation. The brackets are a formatting choice, which is Emphasis'
 * business, and the Codes audit already ruled ordinary words in brackets out of that section.
 */
export const BRACKET_VERDICTS = {
  '[SEC: FBI/DOJ handling of HRC email investigation]': 'KEEP_CONTEXT_OR_LABEL',
  '[Letter from Committee on Financial Services]': 'KEEP_CONTEXT_OR_LABEL',
  '[Part re: Fusion GPS, Perkins Coi now being revealed?]': 'ADD_Q_QUESTION',
  '[Meeting between Comey and Coleman on October 4]': 'KEEP_CONTEXT_OR_LABEL',
  '[take a picture and/or video only when safe to do so]': 'ADD_Q_DIRECTIVE:operational',
  '[Ref: public optics: ‘retired’’left’ refers to ‘fired/forced’]': 'ADD_Q_CLAIM',
  '[Will the rich & powerful influence the court to prevent the unsealing?]': 'ADD_Q_QUESTION',
  '[18-months ago?]': 'ADD_Q_QUESTION',
  '[New York Society For The Prevention Of Cruelty To Children]': 'KEEP_CONTEXT_OR_LABEL',
  '[Bonus Question: Was the time of the posting pre/post actual ‘event’]': 'ADD_Q_QUESTION',
  '[If majority of people believe ‘x’ then ‘x’ must be validated / true]': 'ADD_Q_CLAIM',
  '[Attempts to send new Article(s) to Senate to delay?]': 'ADD_Q_QUESTION',
  '[weaken prior to P_elec?]': 'ADD_Q_QUESTION',
  '[China pref Biden[+VP] as P?]': 'ADD_Q_QUESTION',
  '[Driver: Baseline: MSDNC coordinated narrative con]': 'KEEP_CONTEXT_OR_LABEL',
  '[General public steered by MSDNC like a dog steering sheep]': 'ADD_Q_CLAIM',
}

/**
 * The 29 imperative candidates, read one at a time.
 *
 * The detector was right that these are imperative in mood. It is not right that all of them are
 * directives: "Strike Package 111V-B." is a label, "End of MSM." is an assertion, and "Test 2."
 * is Q checking the board. An imperative VERB is not an instruction to the reader.
 */
export const DIRECTIVE_VERDICTS = {
  'Strike Package 111V-B.': 'KEEP_CONTEXT_OR_LABEL',
  'Note 187.': 'ADD_Q_DIRECTIVE:attention',
  'Picture provides 40,000ft. v.': 'ADD_Q_CLAIM',
  'Think Offshore.': 'ADD_Q_DIRECTIVE:cognition',
  'Post 74.': 'KEEP_CONTEXT_OR_LABEL',
  'List of Republicans, in the House and Senate, who have announced': 'KEEP_CONTEXT_OR_LABEL',
  'Use of symbolism to push strength and belonging to something pow': 'ADD_Q_CLAIM',
  'COMPARE VS OTHER STATES.': 'ADD_Q_DIRECTIVE:research',
  'End of all ends.': 'KEEP_CONTEXT_OR_LABEL',
  'Think GOOG+ / Gmail / etc.': 'ADD_Q_DIRECTIVE:cognition',
  'Think Executive Branch / NSA / etc.': 'ADD_Q_DIRECTIVE:cognition',
  'Think HRC emails, Weiner laptop, etc.': 'ADD_Q_DIRECTIVE:cognition',
  'Compare v.': 'SEGMENTATION_ERROR',
  'Never forget that.': 'ADD_Q_DIRECTIVE:prohibition',
  'Never interfere with an enemy…….': 'ADD_Q_DIRECTIVE:prohibition',
  'Ask yourself a very simple Q.': 'ADD_Q_DIRECTIVE:cognition',
  'Listen very carefully to statements made by Joe D.': 'ADD_Q_DIRECTIVE:attention',
  'Post D comes many I’s.': 'NEEDS_CONTEXT',
  'Never forget who directed.': 'ADD_Q_DIRECTIVE:prohibition',
  'Do you think it was Sen.': 'SEGMENTATION_ERROR',
  'Test 2.': 'NON_ANALYTICAL',
  'Test 3.': 'NON_ANALYTICAL',
  'Install ‘controlled’ [rogue2_Coats_DNI] prevent DECLAS [House-Se': 'ADD_Q_DIRECTIVE:operational',
  'TRUST Adm R.': 'ADD_Q_DIRECTIVE:morale',
  'God bless - I must go for good at this point.': 'KEEP_CONTEXT_OR_LABEL',
  'Re_read EO’s.': 'ADD_Q_DIRECTIVE:research',
  'RELEASE of INFO VITAL.': 'ADD_Q_CLAIM',
  'End of MSM.': 'ADD_Q_CLAIM',
  'Watch the EO’s.': 'ADD_Q_DIRECTIVE:attention',
}
