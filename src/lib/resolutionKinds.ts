// What each kind of unresolved item is actually asking — in the contributor's terms.
//
// The queue shipped four filter chips labelled `entity`, `theme`, `code` and `classification`.
// Those are the audit's words for its own populations, and they tell a contributor nothing about
// what question they are being asked or what a useful answer looks like. Four kinds ask four
// genuinely different questions:
//
//   entity          which specific thing does this shorthand refer to, HERE
//   code            what does this notation mean, if the corpus can establish it at all
//   theme           are these words doing the work this subject label claims
//   classification  is this a deliberate rhetorical device or ordinary writing
//
// Each also has a different standard of proof, and saying so up front is the difference between
// a submission that can be adjudicated and one that cannot.

export type KindGuide = {
  label: string
  asks: string
  answerLooksLike: string
  goodEvidence: string
  /** A closed choice where the question is genuinely binary; free text otherwise. */
  choices?: (item: { candidates: string[] }) => string[]
  placeholder: string
}

export const KIND_GUIDES: Record<string, KindGuide> = {
  entity: {
    label: 'Reference',
    asks: 'Which specific person, place or organisation does this shorthand mean in THIS drop?',
    answerLooksLike: 'A name — “Barack Obama”, “the Board Owner”.',
    goodEvidence: 'A line in this same post or an adjacent drop that identifies the referent, or a dated outside source that fixes it. The strongest submissions quote the words that settle it.',
    choices: it => it.candidates,
    placeholder: 'e.g. "Barack Obama"',
  },
  code: {
    label: 'Notation',
    asks: 'What does this notation mean, and what in the corpus establishes it?',
    answerLooksLike: 'A meaning plus the evidence for it — not a plausible reading.',
    goodEvidence: 'A drop where Q uses the notation and its expansion together, or a consistent pattern across several drops. “It probably stands for…” is not evidence, and this section is comfortable leaving a code undecoded.',
    placeholder: 'e.g. "declassification" — with the drop that shows it',
  },
  theme: {
    label: 'Subject',
    asks: 'Do the words that triggered this subject label actually make the drop about that subject?',
    answerLooksLike: 'Keep the label, drop it, or name a better one.',
    goodEvidence: 'Point at what the drop is doing. A country named as the subject of an investigation is not the same as a drop about foreign affairs, which is why the guard fired here.',
    choices: it => [...it.candidates, 'Not this subject'],
    placeholder: 'e.g. "Keep — the drop is about the diplomacy itself"',
  },
  classification: {
    label: 'Device',
    asks: 'Is this a deliberate rhetorical device, or ordinary sentence structure?',
    answerLooksLike: 'One of the two readings, with a sentence on why.',
    goodEvidence: 'What the lines do together. Two questions sharing an opening word can be a deliberate cascade or a coincidence; what settles it is whether they build on one another.',
    choices: it => it.candidates,
    placeholder: 'e.g. "Deliberate — both lines press the same point"',
  },
  // Declared with the other kinds long before anything populated it, and originally written as
  // "what source is being pointed at". The rows that actually arrived ask the prior question —
  // whose words are these — so the guide asks that instead.
  source_reference: {
    label: 'Source',
    asks: 'Is this line Q writing, or Q pasting something he is quoting?',
    answerLooksLike: 'One of the two readings, with what in the line settles it.',
    goodEvidence: 'What the line itself does. Q’s brackets, his arrows and his all-caps questions are his own voice; a full-sentence news paragraph with a byline and a URL beneath it is not. Where a pasted article and Q’s reply sit in one block, say which lines belong to which.',
    choices: it => it.candidates,
    placeholder: 'e.g. "Q’s own — the brackets and the question mark are his register"',
  },
  other: {
    label: 'Other',
    asks: 'What does the archive have wrong or missing here?',
    answerLooksLike: 'A specific, checkable correction.',
    goodEvidence: 'Whatever a reader would need to confirm it without taking your word for it.',
    placeholder: 'Describe what should change',
  },
}

export const guideFor = (kind: string): KindGuide => KIND_GUIDES[kind] ?? KIND_GUIDES.other
