// THE STEP 3B-1 ACTION SETS — the only copy of this list.
//
// apply-step3b1.mjs applies them and verify-step3b1.mjs derives its count targets from them, and
// for a while each kept its own copy. The verifier's copy stopped at B3, so when Owner Ruling 3 and
// the lane-B reviews were added the cross-tab gate went on measuring the new bundle against a
// target computed from four of six sets — it reported a mismatch that was its own list being
// short. That is the same shape as the deploy chain having its arguments at the call site: a
// load-bearing detail written twice is a detail that will disagree with itself.
//
// Order is load-bearing. A set may target spans the set before it creates, so each is applied
// against an occurrence index bound after the one before it — see the wave loop in the applier.
// Each is pinned by content: a set that can be edited between review and apply was never reviewed.
export const EXTRA_ACTION_SETS = [
  { file: 'step3b1-b2-actions.jsonl',  sha256: 'c9c6c43a08291d2fed207f9ce573ecf526ed33751336c0bd86595fb647e53f00', label: 'B2 boundary repairs' },
  { file: 'step3b1-b2b-actions.jsonl', sha256: '33f26fa2d5c34c86e5e57681a9ba7613bb938e2f6fe1993e35f433fd480be6ce', label: 'B2b collisions the trims uncovered' },
  { file: 'step3b1-b2c-actions.jsonl', sha256: '34fb5fedfa40a0e3ed8c1b2f6bef3ff2448467931ab72dc03db6e5cb03058678', label: 'B2c spaced-protocol link lines' },
  { file: 'step3b1-b3-actions.jsonl',  sha256: 'fc2f9f5a571b515fc9624f417e2abf6610e7f5a2cc8e8e0cab81a42f77df88f7', label: 'B3 over-extended segmentation recoveries' },
  // OWNER RULING 3 (2026-08-22) — the two themeAnchors records in the reviewed C/D/E population.
  // The other 27 are named-entity occurrences and go through apply-entity-cleanup.mjs, which owns
  // the entity accounting they move. These two carry none, and themeAnchors is rebuilt by
  // apply-themes.mjs earlier in the chain, so they belong to the applier that runs after every
  // step that writes the arrays it edits.
  { file: 'step3b1-r3-actions.jsonl',  sha256: '91c6bccf00928f5304cc08c44bdec473d9020c831302fbcd8ae14f2fe10bbd0c', label: 'R3 owner ruling 3 unlocated withdrawals' },
  // LANE B — the 159 human-semantic reviews, one set per family, in the order they were reviewed.
  { file: 'step3b1-lb1-actions.jsonl', sha256: '0d2670d27c5eedbf316d6253bd74fe691f861ca43de4a8447174aacba95bf740', label: 'LB1 multi-line span reviews' },
  { file: 'step3b1-lb2-actions.jsonl', sha256: '75afd5eba04e17f5fe397557bb0b7040760f0596bf75e0e181fa5105bc8b9ef8', label: 'LB2 within-line crossing reviews' },
  { file: 'step3b1-lb3-actions.jsonl', sha256: '925292bcc367cdfa515359e9670a2247132c78a24b64bb7e95e8b2d7569fcbc5', label: 'LB3 same-category overlap reviews' },
]
