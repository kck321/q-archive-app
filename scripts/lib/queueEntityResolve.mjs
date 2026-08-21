// Resolve the owner's Entity rulings from the unhighlighted-sentence queue to certified identities.
//
// An entity ruling names a SPAN. A certified entity row needs an IDENTITY — a canonical name and a
// type — and the review carries neither, because the owner ruled the section, not the registry
// entry. This module is the one place that closes that gap, and it closes it by RESOLUTION first
// and creation last:
//
//   1. the span verbatim, against every certified canonical and alias
//   2. the span with titles ("Sen.", "Adm."), party suffixes (", D-Minn"), role tails
//      ("(D-CA) – Speaker of the House") and a leading "The" removed
//   3. an initial + surname, but ONLY where exactly one certified person carries that surname
//   4. a connector split ("Hilton/Roth", "SA -> NK"), and only when EVERY part resolves
//   5. audit/unhighlighted-entity-identities.json — the identities this batch introduces, each
//      with a stated type from the vocabulary already in entities.json
//   6. held: refused and reported, never guessed
//
// 341 of the 508 rulings land at step 1. That ordering matters more than it looks: creating a new
// canonical for a name the registry already holds is how an archive ends up with Barack Obama
// twice, and the entity model here is one row per CONNECTED SET precisely to avoid that.
const TITLE = /^(?:Sen|Rep|Gov|Adm|Gen|Lt|Col|Maj|Capt|Dr|Mr|Mrs|Ms|Amb|Sec|Judge|Justice|Army Lt\.? Gen|Attorney General|President|Vice President)\.?\s+/i

/**
 * The span with Q's decoration removed: board markers, wrapping quotes, terminal punctuation.
 *
 * A CLOSING PAREN IS ONLY DECORATION WHEN NOTHING OPENED IT. Stripping it unconditionally turned
 * "The Analysis Corporation (TAC)" into "The Analysis Corporation (TAC" — which then failed the
 * paren-tail removal in bareName() and left an already-certified organisation unresolvable, along
 * with "Jason Bourne (Deep Dream)" and "Operation Merlin (tech)". Three certified identities lost
 * to one over-eager character class.
 */
export function stripSpan(s) {
  let v = String(s ?? '').trim().replace(/^[>\s]+/, '')
  v = v.replace(/^["'“”‘’]+/, '').replace(/["'“”‘’]+$/, '')
  // A span WRAPPED in its own parens is decoration too — #1115 is literally "(Cohen)." — but only
  // when the pair is balanced and encloses the whole thing, so "Operation Merlin (tech)" is left
  // for bareName() to handle as a tail rather than being unwrapped from the wrong end.
  v = v.replace(/[.!?:;,\s]+$/, '').trim()
  while (/^\((?:[^()]*)\)$/.test(v)) v = v.slice(1, -1).trim()
  if (!v.includes('(')) v = v.replace(/\)+$/, '')
  if (!v.includes(')')) v = v.replace(/^\(+/, '')
  return v.replace(/[.!?:;,\s]+$/, '').trim()
}

/** The span reduced to a bare name: no title, no party suffix, no role tail, no leading "The". */
function bareName(s, { dropThe = true } = {}) {
  let v = stripSpan(s)
  v = v.replace(/\s*[–—-]\s*(Speaker|Chair|Senate|Ranking|Chief|Minority|Majority)\b.*$/i, '')
  v = v.replace(/\s*\([^)]*\)\s*$/, '')
  v = v.replace(/,\s*[DRI]-[A-Za-z.]+$/i, '')
  if (dropThe) v = v.replace(/^the\s+/i, '')
  let prev
  do { prev = v; v = v.replace(TITLE, '').trim() } while (v !== prev)
  return stripSpan(v)
}

// Q's own chain notation. "->" and ">" before "-" so "SA -> NK" splits once, not twice.
const CONNECTOR = /\s*(?:->|>|\/|\\|\s&\s|\s\+\s|\sv\s|\svs\.?\s|\s-\s|\s_\s|,\s*and\s+|,\s*|\sand\s)\s*/gi

/**
 * A resolver bound to one certified entity set.
 *
 * `entities` is the assembled array apply-entities.mjs holds — canonical, type, aliases — so
 * lookups see the owner's earlier rulings and the merges, not a stale snapshot.
 */
export function makeEntityResolver(entities, identitiesFile) {
  const byName = new Map()
  const index = e => {
    byName.set(e.canonical.toLowerCase(), e)
    for (const a of e.aliases ?? []) byName.set(String(a.text ?? a).toLowerCase(), e)
  }
  for (const e of entities) index(e)

  const surname = new Map()
  for (const e of entities) {
    if (e.type !== 'person') continue
    const last = e.canonical.trim().split(/\s+/).pop().toLowerCase()
    if (!surname.has(last)) surname.set(last, [])
    surname.get(last).push(e)
  }

  const declared = new Map()      // spelling -> { canonical, type }
  for (const id of identitiesFile.identities ?? []) {
    for (const sp of id.spellings) declared.set(stripSpan(sp).toLowerCase(), id)
  }
  const splits = new Map()        // "postNum|spelling" -> string[]
  for (const s of identitiesFile.splits ?? []) {
    splits.set(`${s.postNum}|${stripSpan(s.spelling).toLowerCase()}`, s.into)
  }
  // Held entries are matched by PREFIX, because one of them is an entire paragraph of the Vigano
  // letter and no file should have to carry that verbatim to name it.
  const heldList = (identitiesFile.held ?? []).map(h => ({ postNum: h.postNum, prefix: stripSpan(h.spelling).replace(/[….]+$/, '').toLowerCase() }))
  const isHeld = (postNum, span) => heldList.some(h => h.postNum === postNum && span.toLowerCase().startsWith(h.prefix))

  /** One certified entity for a bare name, or null. */
  function lookup(name) {
    const n = stripSpan(name).toLowerCase()
    if (!n) return null
    if (byName.has(n)) return byName.get(n)
    const b = bareName(name).toLowerCase()
    if (b && byName.has(b)) return byName.get(b)
    // Keep the leading "The" for registries that carry it ("The Analysis Corporation").
    const bk = bareName(name, { dropThe: false }).toLowerCase()
    if (bk && byName.has(bk)) return byName.get(bk)
    const m = /^([a-z])\.\s*([a-z'-]+)$/i.exec(bareName(name))
    if (m) {
      const cands = (surname.get(m[2].toLowerCase()) ?? [])
        .filter(e => e.canonical.toLowerCase().startsWith(m[1].toLowerCase()))
      if (cands.length === 1) return cands[0]
    }
    return null
  }

  /**
   * Every identity one ruling certifies.
   *
   * Returns `{ hits: [{ canonical, type, aliasUsed, isNew }] }`, or `{ heldWhy }` when the span
   * names nothing that can be certified without inventing a referent.
   */
  function resolve(ruling) {
    const span = stripSpan(ruling.sourceText)
    const listKey = `${ruling.postNum}|${span.toLowerCase()}`
    if (isHeld(ruling.postNum, span)) return { heldWhy: 'listed in unhighlighted-entity-identities.json held[]' }

    const direct = lookup(span)
    if (direct) return { hits: [{ canonical: direct.canonical, type: direct.type, aliasUsed: span, isNew: false }] }

    const listed = splits.get(listKey)
    const bits = listed ?? (() => {
      CONNECTOR.lastIndex = 0
      const parts = span.split(CONNECTOR).map(stripSpan).filter(Boolean)
      return parts.length > 1 ? parts : null
    })()
    if (bits) {
      const found = bits.map(b => ({ b, e: lookup(b), d: declared.get(stripSpan(b).toLowerCase()) }))
      if (found.every(f => f.e || f.d)) {
        return {
          hits: found.map(f => f.e
            ? { canonical: f.e.canonical, type: f.e.type, aliasUsed: f.b, isNew: false }
            : { canonical: f.d.canonical, type: f.d.type, aliasUsed: f.b, isNew: true }),
        }
      }
    }

    const d = declared.get(span.toLowerCase())
    if (d) return { hits: [{ canonical: d.canonical, type: d.type, aliasUsed: span, isNew: true }] }

    return { heldWhy: 'no certified identity, and none declared for this spelling' }
  }

  return { resolve, index }
}
