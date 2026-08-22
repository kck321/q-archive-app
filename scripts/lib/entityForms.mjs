// THE ENTITY-FORM LOOKUP — one copy, shared by everything that has to locate an identity.
//
// WHAT WAS WRONG. postAnalysis.namedEntities stores the IDENTITY a section recorded on a drop, and
// that identity is frequently an ALIAS rather than a canonical name: "Hussein" is an alias of
// "Barack Obama", "Sessions" of "Jeff Sessions", "Mueller" of "Robert Mueller", "Huber" of
// "John Huber". Every consumer built its alias map the same way —
//
//     aliasesOf.set(String(e.canonical).toLowerCase(), forms)
//
// — keyed by CANONICAL only. So for an alias-valued identity the map has no key at all, the
// fallback the ledger's own comment describes can never fire, and the entity is reported
// unlocatable. That single reachability defect accounts for 424 of the 645 UNLOCATED_SPAN rows in
// the Step 3B-1 conflict queue: 217 posts, and names as ordinary as HUSSEIN and SESSIONS.
//
// WHAT THIS DOES NOT DO. It does not relax matching. Callers still locate with occurrencesOfSpan(),
// which is exact and case-sensitive, and the forms are returned LONGEST FIRST so "US Military"
// still wins over "US". Case-insensitive resolution is a separate question with a separate answer
// (see invariant 4 in PROJECT_CONTEXT: substring matching makes "US" match "rUSsia", "mUSt" and
// "becaUSe") and is deliberately NOT decided here.

/**
 * Build the lookup from an entities.json document.
 *
 * @returns {{ formsFor: (identity: string) => string[], canonicalFor: (identity: string) => string|null, size: number }}
 *   formsFor      every registered spelling of the identity's group, longest first, [] if unknown
 *   canonicalFor  the group's canonical name, for provenance
 */
export function buildEntityForms(entitiesDoc) {
  const groups = new Map()      // any registered form (lowercased) -> the group's form list
  const canonical = new Map()   // any registered form (lowercased) -> canonical name
  for (const e of entitiesDoc?.entities ?? []) {
    const forms = [...new Set([e.canonical, ...(e.aliases ?? []).map(a => a.text)].filter(Boolean))]
      .sort((a, b) => String(b).length - String(a).length)
    for (const f of forms) {
      const k = String(f).toLowerCase()
      // FIRST REGISTRATION WINS, so the lookup is a function of the file and not of iteration luck.
      // A spelling shared by two identities keeps the one that declared it first; that collision is
      // a registry question, not something a lookup may decide silently.
      if (!groups.has(k)) { groups.set(k, forms); canonical.set(k, e.canonical) }
    }
  }
  return {
    formsFor: identity => groups.get(String(identity ?? '').toLowerCase()) ?? [],
    canonicalFor: identity => canonical.get(String(identity ?? '').toLowerCase()) ?? null,
    size: groups.size,
  }
}
