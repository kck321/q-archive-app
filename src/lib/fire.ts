// The lazy door to Firestore.
//
// The public site never reads Firestore at startup — aliases and edits ship baked into the
// bundle (see loadAliasesFromCloud and localData's applyCloudOverrides, both IS_PUBLIC_SITE
// gated) — yet a static `import { db } from '../firebase'` anywhere pulls the ENTIRE Firestore
// SDK into the main chunk every visitor downloads. Measured 2026-08-28: the SDK was the single
// largest contributor to a 1.4 MB monolithic bundle that public visitors paid for on every
// deploy, to support code paths they can never reach.
//
// So every module that talks to Firestore goes through this one async door instead of importing
// the SDK at the top. Rollup then emits firebase as its own on-demand chunk: the desktop/dev
// workbench loads it the first time an edit syncs, the public site the first time a visitor
// actually submits feedback or a resolution suggestion — and the public FIRST LOAD carries none
// of it.
//
// Call shape, inside any async function that needs the database:
//
//   const { db, doc, getDoc } = await fire()
//
// The spread of the firebase/firestore namespace makes every SDK export available by name, so a
// call site lists exactly what it uses and nothing else changes.

let loaded: Promise<Record<string, unknown>> | null = null

export function fire(): Promise<typeof import('firebase/firestore') & { db: import('firebase/firestore').Firestore }> {
  loaded ??= Promise.all([import('../firebase'), import('firebase/firestore')])
    .then(([{ db }, fs]) => ({ ...fs, db }))
  return loaded as ReturnType<typeof fire>
}
