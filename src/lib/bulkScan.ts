import { db } from '../firebase'
import { collection, getDocs, query, orderBy, doc, limit, writeBatch, arrayUnion } from 'firebase/firestore'
import type { QPost } from '../types'

// ─── Rate limit config ────────────────────────────────────────────────────────
// Remote fetches are batched and paced so the 4plebs / 8kun archives are not hammered.
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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
