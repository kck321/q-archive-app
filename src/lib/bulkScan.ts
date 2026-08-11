import { db } from '../firebase'
import {
  collection, getDocs, query, orderBy, where,
  doc, limit, writeBatch, arrayUnion, updateDoc,
  startAfter, type QueryDocumentSnapshot, type Query, type QuerySnapshot
} from 'firebase/firestore'
import { detectQuestionsWithVerification, detectActionRequests, analyzePost, classifyQuestionsInArchive, findAnswersInThread } from './claude'
import { parseEightkunLink, fetchThreadReplies } from './eightkunApi'
import type { QPost } from '../types'

// ─── Rate limit config ────────────────────────────────────────────────────────
// Each post now makes multiple Claude calls (one per chunk + one verification pass).
// Posts are processed sequentially within each batch to stay under rate limits.
const BATCH_SIZE = 3        // posts per batch
const BATCH_DELAY_MS = 8000 // 8s between batches

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e: unknown) {
      const msg = String(e)
      const is429 = msg.includes('429') || msg.includes('rate_limit')
      if (is429 && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 15000
        console.log(`Rate limited — waiting ${waitMs / 1000}s before retry ${attempt + 1}`)
        await sleep(waitMs)
      } else {
        throw e
      }
    }
  }
  throw new Error('Max retries exceeded')
}

// ─── Reset for re-scan ────────────────────────────────────────────────────────
export async function resetForRescan(
  onProgress?: (msg: string) => void
): Promise<void> {
  onProgress?.('Deleting existing questions…')
  let deleted = 0
  while (true) {
    const snap = await getDocs(query(collection(db, 'questions'), limit(400)))
    if (snap.empty) break
    const batch = writeBatch(db)
    for (const d of snap.docs) batch.delete(d.ref)
    await batch.commit()
    deleted += snap.docs.length
    onProgress?.(`Deleted ${deleted} questions…`)
  }

  onProgress?.('Resetting post scan flags…')
  const postsSnap = await getDocs(query(collection(db, 'posts'), limit(5000)))
  for (let i = 0; i < postsSnap.docs.length; i += 400) {
    const batch = writeBatch(db)
    for (const d of postsSnap.docs.slice(i, i + 400)) {
      batch.update(d.ref, { questionsScanned: false, hasQuestions: false })
    }
    await batch.commit()
  }
  onProgress?.('Reset complete — starting fresh scan…')
}

// Clears threadScanned flag from all posts so the thread scan restarts from scratch.
// Keeps any threadAnswers / qThreadReplies already found.
export async function resetThreadScan(
  onProgress?: (msg: string) => void
): Promise<void> {
  onProgress?.('Loading posts with board links…')
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('postNum'), limit(5000)))
  const relevant = snap.docs.filter(d => {
    const link = (d.data() as QPost).link ?? ''
    return /4chan\.org|8kun\.top|8ch\.net/.test(link)
  })
  onProgress?.(`Resetting ${relevant.length} posts…`)
  for (let i = 0; i < relevant.length; i += 400) {
    const batch = writeBatch(db)
    for (const d of relevant.slice(i, i + 400)) {
      batch.update(d.ref, { threadScanned: false })
    }
    await batch.commit()
  }
  onProgress?.(`Done — ${relevant.length} posts ready for rescan.`)
}

// ─── Bulk scan ────────────────────────────────────────────────────────────────
export interface ScanProgress {
  scanned: number
  total: number
  questionsFound: number
  currentPost: number
}

export async function bulkScanAllPosts(
  onProgress: (p: ScanProgress) => void,
  signal?: AbortSignal
): Promise<{ scanned: number; questionsFound: number }> {
  const snap = await getDocs(
    query(collection(db, 'posts'), orderBy('postNum'), limit(5000))
  )

  const posts = snap.docs
    .map(d => d.data() as QPost)
    .filter(p => !(p as QPost & { questionsScanned?: boolean }).questionsScanned)

  const total = posts.length
  let scanned = 0
  let questionsFound = 0

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    if (signal?.aborted) break

    const chunk = posts.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)

    // Process each post sequentially:
    // 1. Split into 6-line chunks, extract questions from each
    // 2. Run verification pass to catch anything missed
    // 3. Deduplicate and save
    for (const post of chunk) {
      if (signal?.aborted) break

      onProgress({ scanned, total, questionsFound, currentPost: post.postNum })

      const detected = await withRetry(() =>
        detectQuestionsWithVerification(post.text)
      )

      for (const q of detected) {
        const newRef = doc(collection(db, 'questions'))
        batch.set(newRef, {
          postId: post.id,
          postNum: post.postNum,
          text: q.text,
          status: 'unprocessed',
          infographId: null,
          createdAt: Date.now(),
        })
      }

      batch.update(doc(db, 'posts', post.id), {
        questionsScanned: true,
        hasQuestions: detected.length > 0,
      })

      questionsFound += detected.length
      scanned++
      onProgress({ scanned, total, questionsFound, currentPost: post.postNum })
    }

    await batch.commit()

    if (i + BATCH_SIZE < posts.length && !signal?.aborted) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  return { scanned, questionsFound }
}

// ─── Bulk request scan ────────────────────────────────────────────────────────
export interface RequestScanProgress {
  scanned: number
  total: number
  requestsFound: number
  currentPost: number
}

export async function bulkScanAllRequests(
  onProgress: (p: RequestScanProgress) => void,
  signal?: AbortSignal
): Promise<{ scanned: number; requestsFound: number }> {
  const snap = await getDocs(
    query(collection(db, 'posts'), orderBy('postNum'), limit(5000))
  )

  const posts = snap.docs
    .map(d => d.data() as QPost & { requestsScanned?: boolean })
    .filter(p => !p.requestsScanned)

  const total = posts.length
  let scanned = 0
  let requestsFound = 0

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    if (signal?.aborted) break

    const chunk = posts.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)

    for (const post of chunk) {
      if (signal?.aborted) break

      onProgress({ scanned, total, requestsFound, currentPost: post.postNum })

      const found = await withRetry(() => detectActionRequests(post.text))

      batch.update(doc(db, 'posts', post.id), {
        requestsScanned: true,
        hasRequests: found.length > 0,
        actionRequests: found,
      })

      requestsFound += found.length
      scanned++
      onProgress({ scanned, total, requestsFound, currentPost: post.postNum })
    }

    await batch.commit()

    if (i + BATCH_SIZE < posts.length && !signal?.aborted) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  return { scanned, requestsFound }
}

// ─── Bulk analysis scan ───────────────────────────────────────────────────────
export interface AnalysisScanProgress {
  scanned: number
  total: number
  currentPost: number
  questionsFound: number
}

export async function bulkScanAllAnalysis(
  onProgress: (p: AnalysisScanProgress) => void,
  signal?: AbortSignal
): Promise<{ scanned: number; questionsFound: number }> {
  const snap = await getDocs(
    query(collection(db, 'posts'), orderBy('postNum'), limit(5000))
  )

  // Process posts that need either deep analysis OR question detection (or both)
  const posts = snap.docs
    .map(d => d.data() as QPost & { analysisScanned?: boolean; questionsScanned?: boolean })
    .filter(p => !p.analysisScanned || !p.questionsScanned)

  const total = posts.length
  let scanned = 0
  let questionsFound = 0

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    if (signal?.aborted) break

    const chunk = posts.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)

    for (const post of chunk) {
      if (signal?.aborted) break

      onProgress({ scanned, total, currentPost: post.postNum, questionsFound })

      const updates: Record<string, unknown> = {}

      // Deep analysis (if not already done)
      if (!post.analysisScanned) {
        const analysis = await withRetry(() => analyzePost(post.text))
        updates.postAnalysis = analysis
        updates.analysisScanned = true
      }

      // Question detection (if not already done)
      if (!post.questionsScanned) {
        const detected = await withRetry(() => detectQuestionsWithVerification(post.text))
        for (const q of detected) {
          const newRef = doc(collection(db, 'questions'))
          batch.set(newRef, {
            postId: post.id,
            postNum: post.postNum,
            text: q.text,
            status: 'unprocessed',
            infographId: null,
            createdAt: Date.now(),
          })
        }
        updates.questionsScanned = true
        updates.hasQuestions = detected.length > 0
        questionsFound += detected.length
      }

      if (Object.keys(updates).length > 0) {
        batch.update(doc(db, 'posts', post.id), updates)
      }

      scanned++
      onProgress({ scanned, total, currentPost: post.postNum, questionsFound })
    }

    await batch.commit()

    if (i + BATCH_SIZE < posts.length && !signal?.aborted) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  return { scanned, questionsFound }
}


// ─── Referenced Post Image Scan ───────────────────────────────────────────────
// For each post with >>XXXXXXX references and no refMedia stored yet,
// fetch the image from 4plebs and save to Firestore as refMedia[].
export async function bulkScanRefImages(
  onProgress?: (done: number, total: number, postNum: number) => void,
  signal?: AbortSignal
): Promise<{ scanned: number; found: number }> {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('postNum')))
  const posts = snap.docs.map(d => d.data() as QPost)

  // Process posts that have >>references in text and either haven't been scanned
  // or previously scanned but found nothing (refMedia === [] — may have been a bad parse)
  // No 'g' flag — g flag causes lastIndex state bugs when reusing regex across .test() calls
  const candidates = posts.filter(p => {
    if (p.refMedia && p.refMedia.length > 0) return false // already has images, skip
    return />>(\d{6,})/.test(p.text)
  })

  const total = candidates.length
  let scanned = 0
  let found = 0

  const SCAN_BATCH = 10
  for (let i = 0; i < candidates.length; i += SCAN_BATCH) {
    if (signal?.aborted) break
    const chunk = candidates.slice(i, i + SCAN_BATCH)
    const batch = writeBatch(db)

    await Promise.all(chunk.map(async post => {
      const refs = Array.from(post.text.matchAll(/>>(\d{6,})/g)).map(m => m[1])
      const refMedia: { filename: string; url: string }[] = []
      // Detect board from source field — 4plebs only covers 4chan boards (pol)
      const board = (post.source ?? '').toLowerCase().includes('pol') ? 'pol' : 'pol'
      for (const num of refs) {
        try {
          const res = await fetch(`/4plebs-proxy/_/api/chan/post/?board=${board}&num=${num}`)
          if (!res.ok) continue
          const data = await res.json()
          // 4plebs API format: data.media.media_orig = filename, data.media.media_filename = original name
          const mediaOrig = data?.media?.media_orig
          const mediaFilename = data?.media?.media_filename
          if (!mediaOrig) continue
          refMedia.push({
            url: `https://i.4pcdn.org/${board}/${mediaOrig}`,
            filename: mediaFilename || mediaOrig,
          })
        } catch { /* skip */ }
      }
      // Always write refMedia (even empty) so we don't re-scan this post
      batch.update(doc(db, 'posts', post.id), { refMedia })
      if (refMedia.length > 0) found++
      scanned++
      onProgress?.(scanned, total, post.postNum)
    }))

    await batch.commit()
    if (i + SCAN_BATCH < candidates.length && !signal?.aborted) {
      await sleep(500) // small delay to avoid hammering 4plebs
    }
  }

  return { scanned, found }
}

// ─── Static Entity Scan ───────────────────────────────────────────────────────
// Terms that are ALWAYS named entities regardless of Claude analysis.
// Kept in sync with STATIC_ENTITIES in renderPostBody (PostDetail.tsx).
export const STATIC_ENTITIES = [
  'bad actor',
  'bad actors',
]

export interface StaticEntityScanProgress {
  scanned: number
  total: number
  found: number
  currentPost: number
}

export async function bulkScanStaticEntities(
  onProgress?: (p: StaticEntityScanProgress) => void,
  signal?: AbortSignal
): Promise<{ scanned: number; found: number }> {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('postNum'), limit(5000)))
  const posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as QPost))

  const total = posts.length
  let scanned = 0
  let found = 0

  // No API calls — pure text match, can commit in large batches
  const COMMIT_SIZE = 400
  let batch = writeBatch(db)
  let batchCount = 0

  for (const post of posts) {
    if (signal?.aborted) break

    onProgress?.({ scanned, total, found, currentPost: post.postNum })

    const matched: string[] = []

    for (const term of STATIC_ENTITIES) {
      const rx = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      if (rx.test(post.text ?? '')) {
        // Store the canonical casing that actually appeared in the text
        const m = post.text.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'))
        matched.push(m ? m[0] : term)
      }
    }

    if (matched.length > 0) {
      batch.update(doc(db, 'posts', post.id), {
        'postAnalysis.namedEntities': arrayUnion(...matched),
        analysisScanned: true,
      })
      found += matched.length
      batchCount++

      if (batchCount >= COMMIT_SIZE) {
        await batch.commit()
        batch = writeBatch(db)
        batchCount = 0
      }
    }

    scanned++
    onProgress?.({ scanned, total, found, currentPost: post.postNum })
  }

  if (batchCount > 0) await batch.commit()
  return { scanned, found }
}

// ─── Question Classification (archive-based) ─────────────────────────────────
const CLASSIFY_BATCH = 5   // questions per Claude call
const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'to','of','in','on','at','by','for','with','from','that','this','it','its',
  'he','she','they','we','who','what','when','where','why','how','which','if',
  'and','or','but','not','no','so','as','up','out','about','into','than','then',
])

function keywordsFrom(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w))
}

export interface ClassifyProgress {
  total: number
  done: number
  greenFound: number
  yellowFound: number
  redFound: number
  samePostFound: number
  currentQuestion: string
}

export async function bulkClassifyQuestions(
  onProgress: (p: ClassifyProgress) => void,
  signal?: AbortSignal
): Promise<{ classified: number }> {
  // Paginate to fetch ALL unprocessed questions (beyond 5000 limit)
  const PAGE = 1000
  const questions: { id: string; text: string; postId: string; postNum: number }[] = []
  let lastVisible: QueryDocumentSnapshot | null = null
  while (true) {
    const q: Query = lastVisible
      ? query(collection(db, 'questions'), where('status', '==', 'unprocessed'), orderBy('__name__'), startAfter(lastVisible), limit(PAGE))
      : query(collection(db, 'questions'), where('status', '==', 'unprocessed'), orderBy('__name__'), limit(PAGE))
    const snap: QuerySnapshot = await getDocs(q)
    for (const d of snap.docs) {
      const data = d.data() as { text: string; postId: string; postNum: number }
      questions.push({ id: d.id, text: data.text, postId: data.postId, postNum: data.postNum })
    }
    if (snap.docs.length < PAGE) break
    lastVisible = snap.docs[snap.docs.length - 1]
  }

  // Load all posts for keyword matching — paginated
  const allPosts: { id: string; postNum: number; text: string }[] = []
  let lastPost: QueryDocumentSnapshot | null = null
  while (true) {
    const q: Query = lastPost
      ? query(collection(db, 'posts'), orderBy('postNum'), startAfter(lastPost), limit(1000))
      : query(collection(db, 'posts'), orderBy('postNum'), limit(1000))
    const snap: QuerySnapshot = await getDocs(q)
    for (const d of snap.docs) {
      const data = d.data() as { postNum: number; text?: string }
      allPosts.push({ id: d.id, postNum: data.postNum, text: data.text ?? '' })
    }
    if (snap.docs.length < 1000) break
    lastPost = snap.docs[snap.docs.length - 1]
  }

  // Build postId → post map for fast source-post lookup
  const postById = new Map(allPosts.map(p => [p.id, p]))

  const total = questions.length
  let done = 0
  let greenFound = 0
  let yellowFound = 0
  let redFound = 0
  let samePostFound = 0

  for (let i = 0; i < questions.length; i += CLASSIFY_BATCH) {
    if (signal?.aborted) break
    const chunk = questions.slice(i, i + CLASSIFY_BATCH)

    onProgress({ total, done, greenFound, yellowFound, redFound, samePostFound, currentQuestion: chunk[0].text.slice(0, 60) })

    // Build enriched input with source post + keyword-matched posts
    const enriched = chunk.map(q => {
      const sourcePost = postById.get(q.postId)
      const kws = keywordsFrom(q.text)
      const scored = allPosts
        .filter(p => p.id !== q.postId)
        .map(p => {
          const lower = p.text.toLowerCase()
          const hits = kws.filter(k => lower.includes(k)).length
          return { postNum: p.postNum, text: p.text, hits }
        })
        .filter(p => p.hits > 0)
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 7)
      return {
        id: q.id,
        text: q.text,
        sourcePostNum: sourcePost?.postNum ?? q.postNum,
        sourcePostText: sourcePost?.text ?? '',
        relevantPosts: scored,
      }
    })

    const results = await withRetry(() => classifyQuestionsInArchive(enriched))

    for (const q of chunk) {
      const result = results[q.id]
      if (result && result.status && result.status !== 'unprocessed') {
        const update: Record<string, unknown> = { status: result.status }
        if (result.samePost) update.answeredInSamePost = true
        await updateDoc(doc(db, 'questions', q.id), update)
        if (result.status === 'green') greenFound++
        else if (result.status === 'yellow') yellowFound++
        else if (result.status === 'red') redFound++
        if (result.samePost) samePostFound++
      }
    }

    done += chunk.length
    onProgress({ total, done, greenFound, yellowFound, redFound, samePostFound, currentQuestion: chunk[chunk.length - 1].text.slice(0, 60) })

    if (i + CLASSIFY_BATCH < questions.length) await sleep(8000)
  }

  return { classified: greenFound + yellowFound + redFound }
}

// ─── Thread Reply Scan (4chan / 8chan / 8kun) ─────────────────────────────────
export interface ThreadScanProgress {
  total: number
  done: number
  fetchFailed: number    // board API unreachable (CORS / network / thread deleted)
  repliesFound: number   // total anon replies fetched
  qRepliesFound: number  // Q tripcode replies found in threads
  answersFound: number   // questions answered across all threads
  currentPost: number
}

export async function bulkScanThreadAnswers(
  onProgress: (p: ThreadScanProgress) => void,
  signal?: AbortSignal
): Promise<{ scanned: number; answersFound: number; qRepliesFound: number }> {
  // Fetch all posts that have any board link (4chan, 8chan, or 8kun) not yet thread-scanned
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('postNum'), limit(5000)))
  const posts = snap.docs
    .map(d => d.data() as QPost & { threadScanned?: boolean })
    .filter(p => !p.threadScanned && p.link && /4chan\.org|8kun\.top|8ch\.net/.test(p.link))

  const total = posts.length
  let done = 0
  let fetchFailed = 0
  let repliesFound = 0
  let qRepliesFound = 0
  let answersFound = 0

  for (const post of posts) {
    if (signal?.aborted) break

    onProgress({ total, done, fetchFailed, repliesFound, qRepliesFound, answersFound, currentPost: post.postNum })

    const parsed = parseEightkunLink(post.link)
    if (!parsed) { done++; continue }

    try {
      const replies = await fetchThreadReplies(parsed.board, parsed.threadId, parsed.platform)

      // Separate anon replies from Q's own follow-up replies in the thread
      const anonReplies = replies.filter(r => !r.isQ)
      const qReplies = replies.filter(r => r.isQ)
      repliesFound += anonReplies.length
      qRepliesFound += qReplies.length

      // Build question list from post text (regex scan for ? sentences)
      const postQuestions: string[] = []
      for (const line of (post.text ?? '').split('\n')) {
        const t = line.trim()
        if (t.endsWith('?') && t.length > 8) postQuestions.push(t)
      }

      let answers: import('../types').ThreadAnswer[] = []
      if (postQuestions.length > 0 && anonReplies.length > 0) {
        answers = await withRetry(() =>
          findAnswersInThread(postQuestions, anonReplies.map(r => ({ no: r.no, text: r.text })))
        )
        answersFound += answers.length
      }

      await updateDoc(doc(db, 'posts', post.id), {
        threadReplyCount: anonReplies.length,
        threadAnswers: answers,
        // Store Q's own follow-up posts in the thread (tripcode-signed replies by Q)
        qThreadReplies: qReplies.map(r => ({ no: r.no, text: r.text, trip: r.trip ?? '' })),
        threadScanned: true,
      })
    } catch (e) {
      console.warn(`Thread scan failed for post #${post.postNum} (${parsed.platform}):`, e)
      // Do NOT mark as scanned on failure — leaves it available for retry
      fetchFailed++
    }

    done++
    onProgress({ total, done, fetchFailed, repliesFound, qRepliesFound, answersFound, currentPost: post.postNum })
    await sleep(2000) // gentle rate limit — board API + Claude
  }

  return { scanned: done - fetchFailed, answersFound, qRepliesFound }
}
