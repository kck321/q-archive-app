// Local writable data layer — the app's database when running offline / as a desktop app.
//
// Source of truth = IndexedDB, seeded once from the exported JSON bundle (public/data/*.json).
// The whole ~8 MB archive is held in memory for instant reads; every write mutates the
// in-memory store AND persists the affected collection back to IndexedDB (debounced), so
// edits survive restarts with zero network. No Firestore needed for browsing or editing.
//
// Reseed from a fresh export by bumping SEED_VERSION (or clearing the IndexedDB) and running
// `node scripts/export-firestore.mjs` to regenerate public/data/*.json.

import type { QPost, QQuestion, QTopic, QResource } from '../types'
import { fetchOverrides } from './sync'
import { IS_PUBLIC_SITE } from './appMode'

export interface AnalysisConfirmedDoc { id: string; key: string; category: string }
export interface InfographDoc { id: string; questionId?: string; [k: string]: unknown }

export type CollectionName = 'posts' | 'questions' | 'topics' | 'resources' | 'analysisConfirmed' | 'infographs'

export interface LocalStore {
  posts: QPost[]                 // sorted by postNum ascending
  questions: QQuestion[]
  topics: QTopic[]
  resources: QResource[]
  analysisConfirmed: AnalysisConfirmedDoc[]
  infographs: InfographDoc[]
  postsById: Map<string, QPost>
  postsByNum: Map<number, QPost>
}

const COLLECTIONS: CollectionName[] = ['posts', 'questions', 'topics', 'resources', 'analysisConfirmed', 'infographs']

// Bump to force a re-seed from the JSON bundle (discards local IndexedDB edits).
const SEED_VERSION = 3   // 3: certified question dataset (6,299 Q-authored, 134 normalisations)

// ── Minimal IndexedDB key/value wrapper (one record per collection) ──────────
const DB_NAME = 'q-archive'
const STORE = 'collections'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Exposed so derived indexes (e.g. the analysis frequency) can be cached across sessions. */
export async function idbGetRaw<T>(key: string): Promise<T | undefined> { return idbGet<T>(key) }
export async function idbSetRaw(key: string, value: unknown): Promise<void> { return idbSet(key, value) }

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function fetchBundle<T>(name: string): Promise<T[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`)
  if (!res.ok) throw new Error(`Failed to load data bundle ${name}.json (${res.status})`)
  return res.json() as Promise<T[]>
}

function buildIndexes(store: Omit<LocalStore, 'postsById' | 'postsByNum'>): LocalStore {
  store.posts.sort((a, b) => a.postNum - b.postNum)
  return {
    ...store,
    postsById: new Map(store.posts.map(p => [p.id, p])),
    postsByNum: new Map(store.posts.map(p => [p.postNum, p])),
  }
}

let storePromise: Promise<LocalStore> | null = null
let cache: LocalStore | null = null

// Loads (and caches) the archive. On first ever run, seeds IndexedDB from the JSON bundle;
// afterwards reads straight from IndexedDB so local edits persist across restarts.
// Remove spurious duplicate questions while KEEPING genuine repeats: for each post+question,
// keep at most as many entries as the question actually appears in that post's body.
function dedupeQuestions(qs: QQuestion[], posts: QPost[]): QQuestion[] {
  const norm = (t: string) => (t ?? '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')
  const bodyById = new Map<string, string>()
  const bodyByNum = new Map<number, string>()
  for (const p of posts) {
    const b = (p.text ?? '').toLowerCase().replace(/\s+/g, ' ')
    bodyById.set(p.id, b); bodyByNum.set(p.postNum, b)
  }
  const allowed = new Map<string, number>()  // how many entries are legitimate per key
  const kept = new Map<string, number>()
  const out: QQuestion[] = []
  for (const q of qs) {
    const key = `${q.postId ?? q.postNum}|${norm(q.text)}`
    if (!allowed.has(key)) {
      const body = bodyById.get(q.postId) ?? bodyByNum.get(q.postNum) ?? ''
      const needle = norm(q.text)
      let occ = 0, idx = 0
      if (needle) { while ((idx = body.indexOf(needle, idx)) !== -1) { occ++; idx += needle.length } }
      allowed.set(key, Math.max(1, occ))  // genuine N-times → keep N; otherwise keep 1
    }
    const k = kept.get(key) ?? 0
    if (k < allowed.get(key)!) { out.push(q); kept.set(key, k + 1) }
  }
  return out
}

/**
 * Strip the board's own markup out of post text.
 *
 * 8chan renders `//text//` as italics, so every `https://` in a drop was stored as
 * `https:<em>//</em>example.com` — literal tags, in 1,448 posts (2,054 pairs), plus a few
 * <u>/<span>/<p>. They are in qalerts' data too, so this is the SOURCE's markup, not a bug
 * in our ingest — but it splits every URL in half, which is why the Twitter links in #2880
 * were not clickable and why "twitter" highlighted separately from ".com/…".
 *
 * Done here rather than in posts.json so the bundle stays byte-identical to the source and
 * the qalerts audit keeps passing. Applied to quoted posts and stored analysis items too,
 * or a claim carrying a tag would stop matching the text it came from.
 */
const MARKUP = /<\/?(?:em|u|span|p|b|i|strong|s)\b[^>]*>/gi
// HTML entities were stored raw as well: 607 "&gt;", 561 "&amp;", 26 "&lt;" across 575 posts.
// "&amp;" is what Q typed as "&", so leaving it makes the text wrong and unsearchable.
// "&gt;" is decoded LAST, so a decoded ">" can never be re-read as markup.
const ENTITIES: [RegExp, string][] = [
  [/&amp;/gi, '&'], [/&nbsp;/gi, ' '], [/&quot;/gi, '"'], [/&#0?39;|&apos;/gi, "'"],
  [/&lt;/gi, '<'], [/&gt;/gi, '>'],
]

function stripBoardMarkup(posts: QPost[]): void {
  const clean = (t: string) => {
    if (!t) return t
    let out = t.includes('<') ? t.replace(MARKUP, '') : t
    if (out.includes('&')) for (const [rx, ch] of ENTITIES) out = out.replace(rx, ch)
    return out
  }
  const cleanArr = (arr?: string[]) => Array.isArray(arr) ? arr.map(clean) : arr
  const cats = ['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks']
  for (const p of posts) {
    if (p.text) p.text = clean(p.text)
    const a = p.postAnalysis as Record<string, unknown> | undefined
    if (a) for (const c of cats) { if (Array.isArray(a[c])) a[c] = cleanArr(a[c] as string[]) }
    p.actionRequests = cleanArr(p.actionRequests)
    p.customBrackets = cleanArr(p.customBrackets)
    if (p.quotedPosts) for (const q of p.quotedPosts) { if (q.text) q.text = clean(q.text) }
  }
}

// Remove exact within-post duplicate items from a post's analysis/request/bracket arrays.
function dedupePostArrays(posts: QPost[]): void {
  const norm = (t: string) => (t ?? '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?.!,;:]+$/, '')
  const dd = (arr: string[]) => {
    const seen = new Set<string>(); const out: string[] = []
    for (const it of arr) { const k = norm(it); if (seen.has(k)) continue; seen.add(k); out.push(it) }
    return out.length === arr.length ? arr : out
  }
  const cats = ['claims', 'predictions', 'namedEntities', 'themes', 'impliedConclusions', 'verificationHooks']
  for (const p of posts) {
    const a = p.postAnalysis as Record<string, unknown> | undefined
    if (a) for (const c of cats) { if (Array.isArray(a[c])) a[c] = dd(a[c] as string[]) }
    if (Array.isArray(p.actionRequests)) p.actionRequests = dd(p.actionRequests)
    if (Array.isArray(p.customBrackets)) p.customBrackets = dd(p.customBrackets)
  }
}

export function loadLocalData(): Promise<LocalStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const seeded = await idbGet<number>('__seed_version__').catch(() => undefined)

      let raw: Omit<LocalStore, 'postsById' | 'postsByNum'>
      if (seeded === SEED_VERSION) {
        const [posts, questions, topics, resources, analysisConfirmed, infographs] = await Promise.all(
          COLLECTIONS.map(c => idbGet<unknown[]>(c).then(v => v ?? []))
        )
        raw = { posts, questions, topics, resources, analysisConfirmed, infographs } as typeof raw
      } else {
        const [posts, questions, topics, resources, analysisConfirmed, infographs] = await Promise.all([
          fetchBundle<QPost>('posts'),
          fetchBundle<QQuestion>('questions'),
          fetchBundle<QTopic>('topics'),
          fetchBundle<QResource>('resources'),
          fetchBundle<AnalysisConfirmedDoc>('analysisConfirmed'),
          fetchBundle<InfographDoc>('infographs'),
        ])
        raw = { posts, questions, topics, resources, analysisConfirmed, infographs }
        // Seed IndexedDB so subsequent runs (and edits) read from local storage.
        try {
          await Promise.all(COLLECTIONS.map(c => idbSet(c, (raw as Record<string, unknown>)[c])))
          await idbSet('__seed_version__', SEED_VERSION)
        } catch { /* private-mode / quota — fall back to in-memory only */ }
      }

      // Drop spurious duplicate questions (keeps genuine in-body repeats) so counts are
      // accurate. Idempotent — safe to run every load.
      raw.questions = dedupeQuestions(raw.questions as QQuestion[], raw.posts as QPost[])
      stripBoardMarkup(raw.posts as QPost[])
      for (const q of raw.questions as QQuestion[]) if (q.text) q.text = q.text.replace(MARKUP, '')
      dedupePostArrays(raw.posts as QPost[])

      cache = buildIndexes(raw)
      // Overlay cross-device edits from the cloud — DESKTOP/DEV ONLY.
      //
      // fetchOverrides() reads two whole collections, and Firestore bills one read per
      // DOCUMENT returned, so every public visitor would cost (postEdits + questionEdits)
      // reads. Measured Aug 2026: the free-tier quota was already exhausted by developer
      // use alone. The public bundle ships those edits baked in by
      // scripts/export-firestore.mjs instead, so it needs no reads at all and scales
      // without limit.
      if (!IS_PUBLIC_SITE) await applyCloudOverrides(cache)
      return cache
    })()
  }
  return storePromise
}

// Pull edits from Firestore and apply them on top of the local store, then persist so the
// overlaid data survives the next offline launch. Failures are silent (stays local-only).
async function applyCloudOverrides(store: LocalStore): Promise<void> {
  const ov = await fetchOverrides().catch(() => null)
  if (!ov) return
  let postsTouched = false
  let questionsTouched = false

  for (const [postId, fields] of Object.entries(ov.posts)) {
    const p = store.postsById.get(postId)
    if (p) { Object.assign(p, fields); postsTouched = true }
  }

  for (const qe of ov.questions) {
    if (qe.deleted) {
      const before = store.questions.length
      store.questions = store.questions.filter(q => q.id !== qe.id)
      if (store.questions.length !== before) questionsTouched = true
    } else {
      const { deleted: _d, ...qdata } = qe
      const idx = store.questions.findIndex(q => q.id === qe.id)
      if (idx >= 0) store.questions[idx] = qdata as QQuestion
      else store.questions.push(qdata as QQuestion)
      questionsTouched = true
    }
  }

  // Keep hasQuestions consistent with the synced question set.
  if (questionsTouched) {
    const withQ = new Set(store.questions.map(q => q.postId))
    for (const p of store.posts) {
      const has = withQ.has(p.id)
      if (!!p.hasQuestions !== has) { p.hasQuestions = has; postsTouched = true }
    }
    try { await idbSet('questions', store.questions) } catch { /* best-effort */ }
  }
  if (postsTouched) { try { await idbSet('posts', store.posts) } catch { /* best-effort */ } }
}

// ── Writes ───────────────────────────────────────────────────────────────────
// Debounced persistence of changed collections back to IndexedDB.
const dirty = new Set<CollectionName>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(async () => {
    flushTimer = null
    if (!cache || dirty.size === 0) return
    const cols = [...dirty]
    dirty.clear()
    try {
      await Promise.all(cols.map(c => idbSet(c, (cache as unknown as Record<string, unknown[]>)[c])))
    } catch { /* persistence best-effort; in-memory store is still correct this session */ }
  }, 400)
}

// Apply a synchronous mutation to the in-memory store, mark the touched collections dirty,
// and schedule a persist. Returns the result of `fn`.
// Anything that derives an expensive cache from the store registers here so a write can
// drop it. Without this, caching derived data silently serves stale results after an edit.
const invalidators = new Set<() => void>()
export function onStoreMutated(fn: () => void): () => void {
  invalidators.add(fn)
  return () => { invalidators.delete(fn) }
}

export async function mutateStore<T>(
  collections: CollectionName | CollectionName[],
  fn: (store: LocalStore) => T,
): Promise<T> {
  const store = await loadLocalData()
  const result = fn(store)
  for (const c of Array.isArray(collections) ? collections : [collections]) dirty.add(c)
  // Keep post indexes consistent if the posts array identity/order changed.
  if (dirty.has('posts')) {
    store.posts.sort((a, b) => a.postNum - b.postNum)
    store.postsById.clear(); store.postsByNum.clear()
    for (const p of store.posts) { store.postsById.set(p.id, p); store.postsByNum.set(p.postNum, p) }
  }
  invalidators.forEach(fn => fn())
  scheduleFlush()
  return result
}
