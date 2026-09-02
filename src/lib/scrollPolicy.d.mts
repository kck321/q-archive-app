// Types for the plain-JS scroll navigation policy, so ScrollRestoration.tsx can import it under
// `tsc -b`. The implementation is .mjs because it is also loaded directly by its Node test —
// the same arrangement scripts/lib/certifiedWrite.mjs uses.

export interface PendingRestore {
  key: string
  target: number
}

export interface ScrollDecisionInput {
  navType: string
  key: string
  previousKey: string | null
  pending: PendingRestore | null
  saved: number | null | undefined
}

export interface ScrollDecision {
  action: 'restore' | 'top'
  target: number
  pending: PendingRestore | null
}

export declare function decideScrollAction(input: ScrollDecisionInput): ScrollDecision

export declare function pendingAfterRestoreEnds(
  pending: PendingRestore | null,
  key: string,
): PendingRestore | null

export declare function shouldRecordScroll(input: {
  restoringKey: string | null
  key: string
}): boolean

export declare function positionToRecord(input: {
  atUnmount: number
  tracked: number | null | undefined
  restoringTarget: number | null
}): number
