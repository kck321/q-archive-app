// Global alias map: a canonical analysis term (e.g. "Anthony Weiner") can carry alternate
// spellings (e.g. "Anthony Wiener", "Wiener") that all highlight under the same name.
// Stored in localStorage for instant offline reads and synced to Firestore (one JSON doc).
import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { IS_PUBLIC_SITE } from './appMode'

const LS_KEY = 'q_aliases_v1'
// canonical term (lowercased) -> array of alias strings (as typed)
let map: Record<string, string[]> = loadLocal()
const listeners = new Set<() => void>()

function loadLocal(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function persistLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)) } catch { /* private mode */ }
  listeners.forEach(l => l())
}
async function persistCloud() {
  if (IS_PUBLIC_SITE) return                 // public build never writes
  try { await setDoc(doc(db, 'app', 'aliases'), { json: JSON.stringify(map), _updatedAt: Date.now() }) } catch { /* offline */ }
}

// ── Certified entity aliases ────────────────────────────────────────────────
//
// There were TWO alias registries and only one of them was wired to search.
//
// `map` above is the OWNER-EDITABLE one: eight hand-made groups (potus, hillary clinton, usa…),
// synced to Firestore, and the only reason searching "POTUS" folds Q+/Trump/45 together.
// entities.json is the CERTIFIED one: 1,335 entities, each with the aliases the adjudication and
// the owner rulings established — COVID-19 ← C19 ← COVID, Chinese Communist Party ← CCP, and so
// on. Nothing in the app read it, so a certified alias was invisible to the archive: searching
// "COVID-19" could not find the rows stored as "COVID" or "C19", while POTUS worked purely
// because someone had typed its group in by hand.
//
// Kept as a SEPARATE map rather than merged into `map`, because the two have different
// authorities. The editable map can be edited and deleted from the UI; a certified alias must not
// be, and must not be pushed to Firestore as though the owner had typed it. Where both describe
// the same term the editable map wins — an owner correction outranks a derived group.
let certified: Record<string, string[]> = {}
let certifiedIndex = new Map<string, string>()      // alias/canonical (lower) -> canonical (lower)
let certifiedSpelling = new Map<string, { text: string; n: number }>()   // lower -> as Q wrote it

/**
 * The certified entity records themselves, kept rather than discarded after the alias groups are
 * derived from them.
 *
 * THE ARCHIVE NEEDED THE POST LISTS, NOT JUST THE SPELLINGS. Ranking an entity by "every post whose
 * text contains one of its aliases" over-counts and mis-attributes: MI6 reads 14 posts against a
 * certified 11, and "CS" is claimed by Chuck Schumer, CrowdStrike AND Christopher Steele, so a
 * string-keyed union hands the same drop to all three. The adjudication already resolved every
 * occurrence to one entity, and `posts` is that answer. Reading it is the only way one row per
 * subject can also be one HONEST row per subject.
 */
export interface CertifiedEntity {
  id: string
  canonical: string
  type: string
  mentions: number
  /** The drops the adjudication attributed to THIS entity, alias spellings already resolved. */
  posts: number[]
  /** Every spelling, canonical first. */
  aliases: string[]
  /**
   * Which of the two disjoint public components this identity belongs to.
   *
   * `prose`       Q named it. `mentions` >= 1 and `posts` is the certified evidence.
   * `source_only` Q linked material this identity published, or an account belonging to it, and
   *               never wrote the name in visible prose. `mentions` is 0 and stays 0 — a source
   *               reference is NOT a mention — and `sourcePosts` is the evidence instead.
   */
  rowKind: 'prose' | 'source_only'
  /** The drops that LINKED this source, each labelled with what the link was. */
  sourcePosts: { post: number; kind: SourceKind }[]
  /**
   * postNum -> how many times Q named this entity in that drop, where it is more than once.
   *
   * Certified, per entity. The browser used to derive this from a Map keyed by post number alone
   * and shared across every entity in the frequency index, so in 443 drops one entity's repeat
   * count was painted onto every other entity in the same drop.
   */
  perPostMentions: Record<number, number>
  /**
   * spelling -> how many DISTINCT drops used it.
   *
   * Owner ruling 2026-08-17: the row's aliases read most-to-least posts. A mention total would rank
   * a name Q shouted twice in one drop above one he wrote once in each of two, which is not the
   * order that was asked for.
   */
  aliasPosts: Record<string, number>
  /**
   * The row this identity is published in — its own id unless the alias registry connects it to
   * another identity, in which case every member of the connected set carries the same rowId.
   *
   * Assigned by the artifact, not re-derived here. The rule has to resolve CHAINS ("The Washington
   * Post" -> "Washington Post" -> "WASH POST" is one subject, three identities) and a keyed grouping
   * in the component handled one hop and published the third as its own duplicate row.
   */
  rowId: string
}
let certifiedEntities: CertifiedEntity[] = []

/** Every certified entity, in registry order. Empty until loadCertifiedEntityAliases resolves. */
export function getCertifiedEntities(): CertifiedEntity[] { return certifiedEntities }

// ── The public view: the reconciled row model and its traceability ───────────
//
// The Named Entities header was recounting the browser's frequency index — which groups by
// normalised STRING — and printing the result above a list built from the registry, which is one
// row per IDENTITY. Those are different populations (879 strings against 1,201 identities), so the
// header and the list could never agree. The header now reads this artifact and nothing else.
export type SourceKind = 'publisher' | 'social_account' | 'linked_source'

export interface EntityPublicView {
  totals: {
    canonicalEntities: number
    /** Rows on screen. Fewer than `canonicalEntities` when the alias registry connects identities. */
    publicRows: number
    mergedRows: number
    mergedIdentities: number
    proseMentioned: number
    sourceOnly: number
    mentions: number
    dormantReserved: number
  }
  /** The disjoint components of the headline total, in display order. */
  breakdown: { key: string; label: string; count: number }[]
  kindLabels: Record<SourceKind, string>
  sourceNote: string
  dormantNote: string
}

let publicView: EntityPublicView | null = null

/**
 * The reconciled entity totals, or null until the artifact lands.
 *
 * Null is a REAL state and callers must handle it: this is a fetch, and a header that renders a
 * silent 0 while it is in flight is the same defect as a header that recounts the wrong thing.
 */
export function getEntityPublicView(): EntityPublicView | null { return publicView }

interface PublicViewFile extends EntityPublicView {
  rows?: Record<string, {
    kind?: 'prose' | 'source_only'
    sourcePosts?: { post: number; kind: SourceKind }[]
    perPostMentions?: Record<string, number>
    aliasPosts?: Record<string, number>
    rowId?: string
  }>
}

async function loadPublicView(): Promise<PublicViewFile | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/entity-public-view.json`)
    if (!res.ok) return null
    const data = await res.json() as PublicViewFile
    if (!data.totals || !Array.isArray(data.breakdown)) return null
    publicView = {
      totals: data.totals,
      breakdown: data.breakdown,
      kindLabels: data.kindLabels,
      sourceNote: data.sourceNote,
      dormantNote: data.dormantNote,
    }
    return data
  } catch { return null }
}

/** Load the certified entity alias groups from the shipped Entities artifact. */
export async function loadCertifiedEntityAliases(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/entities.json`)
    if (!res.ok) return
    const data = await res.json() as {
      entities?: {
        id?: string; canonical?: string; type?: string; mentions?: number
        posts?: number[]; aliases?: { text?: string; n?: number }[]
      }[]
    }
    const next: Record<string, string[]> = {}
    const idx = new Map<string, string>()
    const spell = new Map<string, { text: string; n: number }>()
    for (const e of data.entities ?? []) {
      const canon = (e.canonical ?? '').trim()
      if (!canon) continue
      const key = canon.toLowerCase()
      // The alias Q actually wrote is what the archive stores, so the canonical belongs in the
      // group too: "Dominion Voting Systems" never appears in a drop, only "Dominion.".
      // The BEST-ATTESTED spelling of every certified name, so the alias chips can be shown the
      // way Q wrote them. The editable registry is typed by hand and holds "trump" and "djt";
      // the registry knows those drops say Trump and DJT.
      const keep = (t: string, n: number) => {
        const k = t.toLowerCase()
        const cur = spell.get(k)
        if (!cur || n > cur.n) spell.set(k, { text: t, n })
      }
      keep(canon, Infinity)
      for (const a of e.aliases ?? []) { const t = (a.text ?? '').trim(); if (t) keep(t, a.n ?? 0) }
      const members = (e.aliases ?? []).map(a => (a.text ?? '').trim()).filter(Boolean)
      if (!members.length) continue
      next[key] = [...new Set(members.filter(m => m.toLowerCase() !== key))]
      idx.set(key, key)
      for (const m of next[key]) idx.set(m.toLowerCase(), key)
    }
    certified = next
    certifiedIndex = idx
    certifiedSpelling = spell
    // The public view is fetched alongside the registry rather than after it, so a row and its
    // traceability arrive together. A row that appeared before its source posts did would render
    // for one paint as an identity with no evidence — which is the one thing the reconciliation
    // exists to make impossible.
    const view = await loadPublicView()
    certifiedEntities = (data.entities ?? []).map(e => {
      const row = view?.rows?.[e.id ?? ''] ?? null
      const mentions = e.mentions ?? 0
      return {
        id: e.id ?? '',
        canonical: (e.canonical ?? '').trim(),
        type: e.type ?? '',
        mentions,
        posts: [...new Set(e.posts ?? [])].sort((a, b) => a - b),
        aliases: [...new Set([(e.canonical ?? '').trim(), ...(e.aliases ?? []).map(a => (a.text ?? '').trim())])]
          .filter(Boolean),
        // The artifact's kind leads; `mentions > 0` is the same test it applied and is the fallback
        // if the view is missing, so the row model degrades to prose-only rather than to nothing.
        rowKind: row?.kind ?? (mentions > 0 ? 'prose' : 'source_only'),
        sourcePosts: row?.sourcePosts ?? [],
        perPostMentions: row?.perPostMentions
          ? Object.fromEntries(Object.entries(row.perPostMentions).map(([n, v]) => [Number(n), v]))
          : {},
        aliasPosts: row?.aliasPosts ?? {},
        rowId: row?.rowId ?? e.id ?? '',
      }
    }).filter(e => e.id && e.canonical)
    listeners.forEach(l => l())
  } catch { /* artifact missing or malformed — the editable map still works */ }
}

/** The certified group `term` belongs to (canonical + every alias), or null. */
function certifiedGroup(term: string): string[] | null {
  const canonKey = certifiedIndex.get(term.toLowerCase().trim())
  if (!canonKey) return null
  const members = certified[canonKey] ?? []
  const canonical = members.find(m => m.toLowerCase() === canonKey) ?? canonKey
  return [...new Set([canonical, ...members])]
}

/**
 * Every certified entity alias (lowercased). Used to fold an alias row into its canonical row —
 * and ONLY for entity rows: this set holds single tokens like "US" and "CCP" that could equally
 * be the text of a claim or a code, and hiding those would delete a row from a section the
 * ruling never touched.
 */
export function getCertifiedEntityAliasSet(): Set<string> {
  const s = new Set<string>()
  for (const [key, arr] of Object.entries(certified)) {
    for (const a of arr) if (a.toLowerCase() !== key) s.add(a.toLowerCase().trim())
  }
  return s
}

/** Subscribe to alias changes (so views re-highlight). Returns an unsubscribe fn. */
export function subscribeAliases(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/**
 * The other names in `term`'s group, from ANY member — not just the canonical.
 *
 * The map is stored canonical-first ({potus: [Q+, Trump, 45]}), so a plain
 * `map[term]` lookup answered correctly for POTUS and returned NOTHING for Q+, Trump or
 * 45. Connecting a new name to any one member did fold it into the whole group — that part
 * always worked — but standing on an alias, the group looked empty, so it appeared not to
 * have. Reading has to be group-aware the same way writing is.
 */
export function getAliasesFor(term: string): string[] {
  const t = term.toLowerCase().trim()
  if (!t) return []
  const editable = getAliasGroup(term)
  // Union with the certified entity group, so a name carries BOTH the owner's hand-made
  // connections and the ones the adjudication certified. Neither registry is complete on its own.
  const cert = certifiedGroup(term) ?? []
  const seen = new Set<string>([t])
  const out: string[] = []
  for (const g of [...editable, ...cert]) {
    const k = g.toLowerCase().trim()
    if (!k || seen.has(k)) continue
    seen.add(k); out.push(g)
  }
  return out
}

/** Set of every alias string (lowercased) — used to fold alias entities into their canonical. */
export function getAliasSet(): Set<string> {
  const s = new Set<string>()
  for (const arr of Object.values(map)) for (const a of arr) s.add(a.toLowerCase().trim())
  return s
}

/** The canonical term an alias belongs to, or null. */
export function canonicalOf(term: string): string | null {
  const t = term.toLowerCase().trim()
  for (const [canon, arr] of Object.entries(map)) {
    if (arr.some(a => a.toLowerCase().trim() === t)) return canon
  }
  return null
}

/** All terms in an alias group (canonical + aliases) given any member. Returns just the
 *  term itself if it isn't connected to anything. Used to expand searches. */
export function getAliasGroup(term: string): string[] {
  const t = term.toLowerCase().trim()
  const canon = map[t] ? t : canonicalOf(t)
  if (!canon) return [term]
  return [canon, ...(map[canon] ?? [])]
}

/**
 * Every spelling of `term` from BOTH registries — the owner-editable groups and the certified
 * entity aliases. This is what every READ path should use: search matching, the "across the
 * archive" presence bar, highlighting. `getAliasGroup` stays editable-only because the write
 * paths (addAlias/removeAlias) may only ever mutate the map the owner owns.
 *
 * OWNER RULE: a searched term always shows the aliases tied to it. Anything that resolves a term
 * to its other spellings goes through here, or the next alias ruling is invisible again.
 */
export function getFullAliasGroup(term: string): string[] {
  const t = term.toLowerCase().trim()
  if (!t) return [term]
  const seen = new Set<string>()
  const out: string[] = []
  for (const g of [...getAliasGroup(term), ...(certifiedGroup(term) ?? [])]) {
    const k = g.toLowerCase().trim()
    if (!k || seen.has(k)) continue
    seen.add(k); out.push(g)
  }
  return out.length ? out : [term]
}

/**
 * Heal the alias map so no name ever lives in two groups: repeatedly merge any two groups that
 * share a member (case-insensitive), keeping the larger group's canonical as the surviving name.
 * This is what makes "connect X to any ONE member of a group" fold X into the WHOLE group.
 * Returns true if anything changed.
 */
function normalizeAliases(): boolean {
  let changed = false
  let mergedSomething = true
  while (mergedSomething) {
    mergedSomething = false
    const canons = Object.keys(map)
    for (let i = 0; i < canons.length && !mergedSomething; i++) {
      const A = canons[i]
      if (!map[A]) continue
      const membersA = new Set([A, ...map[A]].map(s => s.toLowerCase().trim()))
      for (let j = i + 1; j < canons.length; j++) {
        const B = canons[j]
        if (!map[B]) continue
        const membersB = [B, ...map[B]].map(s => s.toLowerCase().trim())
        if (!membersB.some(m => membersA.has(m))) continue
        // Overlap → merge. Keep whichever group is larger (so an established entity's main name wins).
        const keep = map[A].length >= map[B].length ? A : B
        const drop = keep === A ? B : A
        const keepKey = keep.toLowerCase().trim()
        const seen = new Set<string>([keepKey])
        const union: string[] = []
        for (const m of [keep, ...map[keep], drop, ...map[drop]]) {
          const k = m.toLowerCase().trim()
          if (!k || seen.has(k)) continue
          seen.add(k); union.push(m)
        }
        delete map[drop]
        map[keepKey] = union
        changed = true; mergedSomething = true
        break
      }
    }
  }
  return changed
}

export async function addAlias(canonical: string, alias: string): Promise<void> {
  const key = canonical.toLowerCase().trim()
  const a = alias.trim()
  if (!key || !a || a.toLowerCase() === key) return
  const arr = map[key] ?? []
  if (!arr.some(x => x.toLowerCase() === a.toLowerCase())) map[key] = [...arr, a]
  // If `alias` (or `canonical`) already belongs to a group, fold this pair into that whole group
  // instead of leaving a separate two-name group.
  normalizeAliases()
  persistLocal()
  await persistCloud()
}

/**
 * Disconnect `alias` from `anchor`'s group. Works from ANY member, and can remove the
 * canonical itself (another member is promoted to canonical) — otherwise the × next to a
 * canonical name shown on an alias row would silently do nothing.
 */
export async function removeAlias(anchor: string, alias: string): Promise<void> {
  const a = anchor.toLowerCase().trim()
  const key = map[a] ? a : canonicalOf(a)
  if (!key) return
  const target = alias.toLowerCase().trim()
  const members = map[key] ?? []

  if (target === key) {
    // Removing the canonical: promote the first remaining member to canonical.
    if (members.length <= 1) delete map[key]
    else {
      const [promoted, ...rest] = members
      delete map[key]
      map[promoted.toLowerCase().trim()] = rest
    }
  } else {
    const next = members.filter(x => x.toLowerCase().trim() !== target)
    if (next.length) map[key] = next
    else delete map[key]
  }
  persistLocal()
  await persistCloud()
}

/**
 * Load the alias map at startup.
 *
 * Public build: from the baked `data/aliases.json` bundle — zero Firestore reads.
 * Desktop/dev: from Firestore, so edits made on another device show up.
 */
export async function loadAliasesFromCloud(): Promise<void> {
  if (IS_PUBLIC_SITE) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/aliases.json`)
      if (!res.ok) return                     // not generated yet — run the export script
      const bundled = await res.json() as Record<string, string[]>
      for (const [k, v] of Object.entries(bundled)) {
        map[k] = [...new Set([...(map[k] ?? []), ...v])]
      }
      normalizeAliases()
      persistLocal()
    } catch { /* missing or malformed bundle — carry on with whatever is local */ }
    return
  }
  try {
    const snap = await getDoc(doc(db, 'app', 'aliases'))
    if (!snap.exists()) return
    const cloud = JSON.parse((snap.data() as { json?: string }).json ?? '{}') as Record<string, string[]>
    for (const [k, v] of Object.entries(cloud)) {
      map[k] = [...new Set([...(map[k] ?? []), ...v])]
    }
    // Merging cloud + local can reintroduce cross-group overlaps — heal, and push the fix back up.
    if (normalizeAliases()) persistCloud()
    persistLocal()
  } catch { /* offline / no doc */ }
}

// Heal any pre-existing split groups (e.g. an entity connected to just one member of a larger group)
// as soon as the module loads, so views render the fully-merged groups immediately.
if (normalizeAliases()) persistLocal()

/**
 * How an alias should be SPELLED on screen.
 *
 * The editable registry is typed by hand, so it carries "trump", "djt" and
 * "united states of america" — and the entity cards showed them exactly that way, beside
 * properly-cased names, as though the archive did not know better. It does: the certified
 * registry records the form Q actually wrote, and how often, so the best-attested spelling wins.
 *
 * When a name is not in the certified registry, only ALL-LOWERCASE text is touched. HUSSEIN, DJT,
 * Q+ and "4,10,20" are already the form Q wrote and must survive untouched — a blanket title-case
 * would quietly rewrite them.
 *
 * Display only. Every lookup, fold and match in this file is lowercased, so changing the shown
 * spelling cannot change what counts as the same subject.
 */
export function displayAlias(text: string): string {
  const t = (text ?? '').trim()
  if (!t) return text
  // ANYTHING ALREADY CARRYING A CAPITAL IS LEFT ALONE. HUSSEIN and DONALD J. TRUMP are how Q
  // writes them, and "best attested" alone would have swapped a shouted spelling for a quiet one
  // in both directions. Only all-lowercase text — the hand-typed kind — is repaired.
  if (/[A-Z]/.test(t) || !/[a-z]/.test(t)) return t
  const cert = certifiedSpelling.get(t.toLowerCase())
  // An ALL-CAPS certified spelling is only adopted for a short single token, where it is an
  // acronym (DJT, HRC). For a phrase it is Q shouting — "UNITED STATES OF AMERICA" is not the
  // capitalisation this label wants — so the phrase is title-cased instead.
  if (cert && (/[a-z]/.test(cert.text) || (!cert.text.includes(" ") && cert.text.length <= 5))) return cert.text
  // "United States of America", not "United States Of America". Joining words stay lowercase
  // unless they open the name.
  const SMALL = new Set(['of', 'the', 'and', 'in', 'for', 'to', 'a', 'an', 'at', 'by', 'on', 'or'])
  return t.replace(/(^|[\s.\-/])([a-z]+)/g, (_, lead: string, w: string) =>
    lead + (lead !== '' && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1)))
}
