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
  return getAliasGroup(term).filter(g => g.toLowerCase().trim() !== t)
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
