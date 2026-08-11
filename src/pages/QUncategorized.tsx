import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getAllPosts, addQuestions } from '../lib/posts'
import { loadLocalData } from '../lib/localData'
import type { QPost, QQuestion } from '../types'

// ── Same patterns as PostDetail ───────────────────────────────────────────────
const BRACKET_RX = /\[\[?[A-Z0-9][A-Z0-9 _\-]{0,30}\]?\]/g

const MIL_INTEL_TERMS = [
  'POTUS','FLOTUS','SCOTUS','DECLAS','FISA','NSA','CIA','FBI','DOJ','DNI','DHS','DOD','USMC',
  'SIGINT','HUMINT','PSYOP','JSOC','SOCOM','GITMO','EO','EAS','DEFCON','STRATFOR',
  'Q clearance','top secret','classified','compartmentalized','chain of command',
  'military intelligence','special operations','covert','clandestine','black site',
  'executive order','national security','martial law','military tribunal','UCMJ',
]

const Q_SIGNATURES = [
  'Future proves past','Think mirror','You are the news now','Where we go one we go all',
  'WWG1WGA','Trust the plan','The Great Awakening','Nothing can stop what is coming',
  'NCSWIC','Dark to light','Sheep no more','The storm is upon us','Pain coming',
  'Godfather III','White rabbit','Follow the white rabbit','Follow the money',
  'Follow the pen','Follow the watch','Patriots in control','We have it all',
  'Popcorn ready','Buckle up','God wins','In God we trust','For God and country',
  'Shall we play a game','Who controls the narrative','Expand your thinking',
  'The truth is behind you','These people are stupid','They never thought she would lose',
  'Do you believe in coincidences','The calm before the storm',
]

const URL_RX = /https?:\/\/[^\s<>'")\]]+/g

// Common English stopwords to filter out noise
const STOPWORDS = new Set([
  'the','and','that','this','with','have','from','they','will','been','are','was','were',
  'but','not','you','all','can','had','her','his','him','for','she','out','its','who',
  'did','get','put','too','use','how','our','any','may','say','each','which','there',
  'their','what','more','when','then','than','into','your','has','would','could','should',
  'about','some','them','over','these','those','just','also','only','very','well','even',
  'back','much','know','does','made','make','like','time','long','many','way','new','now',
  'where','here','come','most','need','see','said','one','two','three','four','five',
  'been','being','having','doing','going','every','other','such','after','before','while',
  'through','between','against','during','without','within','along','across','behind',
])

// ── Strip highlighted content from a post, return plain remainder ─────────────
// detectedQuestions: texts already in the questions collection for this post
function extractUnhighlighted(post: QPost, detectedQuestions: string[] = []): string {
  let text = post.text ?? ''

  // Remove URLs
  text = text.replace(URL_RX, ' ')

  // Remove bracket codes
  text = text.replace(BRACKET_RX, ' ')

  // Remove >>references
  text = text.replace(/>>(\d+)/g, ' ')

  // Remove mil-intel terms (case-insensitive)
  for (const term of MIL_INTEL_TERMS) {
    text = text.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
  }

  // Remove Q signatures (case-insensitive)
  for (const sig of Q_SIGNATURES) {
    text = text.replace(new RegExp(sig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
  }

  // Remove action requests stored on the post
  for (const q of (post as QPost & { actionRequests?: string[] }).actionRequests ?? []) {
    text = text.replace(new RegExp(q.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
  }

  // Remove questions already saved in the questions collection (these are highlighted in PostDetail)
  for (const q of detectedQuestions) {
    if (q.length > 4) {
      text = text.replace(new RegExp(q.slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
    }
  }

  // Remove postAnalysis highlighted text spans
  const pa = post.postAnalysis
  if (pa) {
    const allSpans = [
      ...(pa.namedEntities ?? []),
      ...(pa.claims ?? []),
      ...(pa.predictions ?? []),
      ...(pa.impliedConclusions ?? []),
      ...(pa.verificationHooks ?? []),
    ]
    for (const span of allSpans) {
      if (span && span.length > 3) {
        text = text.replace(new RegExp(span.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
      }
    }
  }

  return text
}

// ── Tokenize into meaningful words (3+ chars, not all-digits) ─────────────────
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\n\r\t,.!?;:'"()\[\]{}<>\/\\|~`@#$%^&*+=_]+/)
    .filter(w => w.length >= 3 && !/^\d+$/.test(w) && !STOPWORDS.has(w))
}

// ── Extract bigrams (2-word phrases) ─────────────────────────────────────────
function bigrams(words: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length >= 3 && words[i + 1].length >= 3) {
      out.push(`${words[i]} ${words[i + 1]}`)
    }
  }
  return out
}

// ── Extract sentence-level segments from unhighlighted text ──────────────────
interface Segment {
  text: string
  isQuestion: boolean
}

interface PostSegments {
  post: QPost
  segments: Segment[]
  questionCount: number
}

function splitSentences(text: string): string[] {
  return text
    .split(/[\n\r]+/)
    .flatMap(line => line.split(/(?<=[.!?])\s+/))
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length >= 8)
}

function isCoveredByDetected(sentence: string, detectedLower: string[]): boolean {
  const sl = sentence.toLowerCase()
  return detectedLower.some(q => {
    if (q.includes(sl) || sl.includes(q)) return true
    // Word-overlap fallback: if 70%+ of words in this sentence appear in the saved question
    const words = sl.split(/\s+/).filter(w => w.length > 2)
    if (words.length === 0) return false
    const matches = words.filter(w => q.includes(w)).length
    return matches / words.length >= 0.7
  })
}

function extractSegments(post: QPost, detectedQuestions: string[] = []): Segment[] {
  const detectedLower = detectedQuestions.map(q => q.toLowerCase())

  // Questions: check against ORIGINAL text so stripping doesn't break matching
  const originalSentences = splitSentences(post.text ?? '')
  const newQuestions = originalSentences
    .filter(s => s.trimEnd().endsWith('?'))
    .filter(s => !isCoveredByDetected(s, detectedLower))
    .map(s => ({ text: s, isQuestion: true as const }))

  // Non-question segments: use stripped text
  const stripped = extractUnhighlighted(post, detectedQuestions)
  const nonQuestions = splitSentences(stripped)
    .filter(s => !s.trimEnd().endsWith('?'))
    .map(s => ({ text: s, isQuestion: false as const }))

  return [...nonQuestions, ...newQuestions]
}

interface FreqEntry {
  term: string
  count: number
  postNums: number[]
}

type Mode = 'words' | 'phrases' | 'segments'

export default function QUncategorized() {
  const [posts, setPosts] = useState<QPost[]>([])
  const [questionsMap, setQuestionsMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<Mode>('segments')
  const [minCount, setMinCount] = useState(3)

  // Segments mode state
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    // Fetch posts and all existing questions in parallel
    Promise.all([
      getAllPosts(),
      loadLocalData(),
    ]).then(([p, store]) => {
      // Build postId -> question texts map
      const map: Record<string, string[]> = {}
      for (const q of store.questions) {
        if (!map[q.postId]) map[q.postId] = []
        map[q.postId].push(q.text)
      }
      setPosts(p)
      setQuestionsMap(map)
      setLoading(false)
    })
  }, [])

  // ── Word/phrase frequency ──────────────────────────────────────────────────
  const freq = useMemo<FreqEntry[]>(() => {
    if (loading || posts.length === 0 || mode === 'segments') return []

    const map = new Map<string, { count: number; postNums: Set<number> }>()

    for (const post of posts) {
      const raw = extractUnhighlighted(post, questionsMap[post.id] ?? [])
      const words = tokenize(raw)
      const terms = mode === 'words' ? words : bigrams(words)
      const seen = new Set<string>()
      for (const term of terms) {
        const entry = map.get(term) ?? { count: 0, postNums: new Set() }
        entry.count++
        entry.postNums.add(post.postNum)
        if (!seen.has(term)) seen.add(term)
        map.set(term, entry)
      }
    }

    return Array.from(map.entries())
      .map(([term, { count, postNums }]) => ({ term, count, postNums: Array.from(postNums).sort((a, b) => a - b) }))
      .sort((a, b) => b.count - a.count)
  }, [posts, loading, mode])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return freq.filter(e =>
      e.count >= minCount &&
      (q === '' || e.term.includes(q))
    )
  }, [freq, search, minCount])

  // ── Segments mode ─────────────────────────────────────────────────────────
  const allPostSegments = useMemo<PostSegments[]>(() => {
    if (loading || mode !== 'segments') return []
    return posts
      .map(post => {
        const segments = extractSegments(post, questionsMap[post.id] ?? [])
        return { post, segments, questionCount: segments.filter(s => s.isQuestion).length }
      })
      .filter(ps => ps.segments.length > 0)
  }, [posts, loading, mode])

  const filteredSegments = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return allPostSegments
    return allPostSegments
      .map(ps => ({
        ...ps,
        segments: ps.segments.filter(s => s.text.toLowerCase().includes(q)),
      }))
      .filter(ps => ps.segments.length > 0)
  }, [allPostSegments, search])

  const totalUnmappedQuestions = useMemo(
    () => allPostSegments.reduce((sum, ps) => sum + ps.questionCount, 0),
    [allPostSegments]
  )

  const handleSaveQuestions = useCallback(async () => {
    setSaving(true)
    setSaveError('')
    setSavedCount(0)
    try {
      // Collect all unmapped questions
      const toSave: { post: QPost; text: string }[] = []
      for (const { post, segments } of allPostSegments) {
        for (const seg of segments) {
          if (seg.isQuestion) toSave.push({ post, text: seg.text })
        }
      }

      // Use existing questions to avoid duplicates
      const store = await loadLocalData()
      const existingKeys = new Set(
        store.questions.map(q => `${q.postNum}::${q.text.toLowerCase().trim().slice(0, 60)}`)
      )

      const newOnes = toSave.filter(({ post, text }) => {
        const key = `${post.postNum}::${text.toLowerCase().trim().slice(0, 60)}`
        return !existingKeys.has(key)
      })

      const newQuestions: QQuestion[] = newOnes.map(({ post, text }) => ({
        id: crypto.randomUUID(),
        postId: post.id,
        postNum: post.postNum,
        text,
        status: 'unprocessed',
        infographId: null,
        createdAt: Date.now(),
      }))
      await addQuestions(newQuestions)
      setSavedCount(newQuestions.length)
    } catch (e) {
      setSaveError(String(e))
    } finally {
      setSaving(false)
    }
  }, [allPostSegments])

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-white mb-1">Unmapped Content</h1>
      <p className="text-gray-500 text-sm mb-5">
        {loading
          ? 'Scanning posts…'
          : mode === 'segments'
          ? `Text segments not covered by any highlight category — ${allPostSegments.length.toLocaleString()} posts with remaining content · ${totalUnmappedQuestions.toLocaleString()} unmapped questions detected`
          : `Words and phrases in Q post text not captured by any highlight category — ${filtered.length.toLocaleString()} unique terms across ${posts.length.toLocaleString()} posts`}
      </p>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder={mode === 'segments' ? 'Search segments…' : 'Search terms…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-q-panel border border-q-border rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600"
        />
        <div className="flex rounded-lg overflow-hidden border border-q-border">
          {(['segments', 'words', 'phrases'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                mode === m ? 'bg-blue-700 text-white' : 'bg-q-panel text-gray-400 hover:text-gray-200'
              }`}
            >
              {m === 'words' ? 'Single Words' : m === 'phrases' ? '2-Word Phrases' : 'Text Segments'}
            </button>
          ))}
        </div>
        {mode !== 'segments' && (
          <div className="flex items-center gap-2 bg-q-panel border border-q-border rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500">Min count</span>
            <input
              type="number"
              min={2}
              max={50}
              value={minCount}
              onChange={e => setMinCount(Math.max(2, Number(e.target.value)))}
              className="w-14 bg-transparent text-sm text-gray-200 focus:outline-none text-center"
            />
          </div>
        )}
        {mode === 'segments' && !loading && totalUnmappedQuestions > 0 && (
          <button
            onClick={handleSaveQuestions}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg border border-blue-700 transition-colors"
          >
            {saving ? `Saving… (${savedCount})` : `Save ${totalUnmappedQuestions} Questions`}
          </button>
        )}
      </div>

      {savedCount > 0 && !saving && (
        <p className="text-green-400 text-sm mb-4">✓ Saved {savedCount} new questions to the database</p>
      )}
      {saveError && (
        <p className="text-red-400 text-sm mb-4">{saveError}</p>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Scanning {posts.length} posts…</div>
      ) : mode === 'segments' ? (
        /* ── Segments view ──────────────────────────────────────────────── */
        <div className="space-y-3">
          {filteredSegments.slice(0, 200).map(({ post, segments }) => {
            const date = new Date(post.timestamp * 1000).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
            })
            const questionsInPost = segments.filter(s => s.isQuestion).length
            return (
              <div key={post.postNum} className="bg-q-panel border border-q-border rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 mb-2">
                  <Link
                    to={`/post/${post.postNum}?flash=1`}
                    className="text-xs font-mono text-blue-400 hover:underline"
                  >
                    #{post.postNum}
                  </Link>
                  <span className="text-xs text-gray-600">{date}</span>
                  {questionsInPost > 0 && (
                    <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full">
                      {questionsInPost} question{questionsInPost !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-xs text-gray-700">{segments.length} segment{segments.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-1">
                  {segments.map((seg, i) => (
                    <p
                      key={i}
                      className={`text-sm px-2 py-1 rounded leading-relaxed ${
                        seg.isQuestion
                          ? 'bg-blue-900/30 text-blue-200 border border-blue-800/40'
                          : 'text-gray-400'
                      }`}
                    >
                      {seg.isQuestion && <span className="text-blue-500 text-xs font-bold mr-1.5">?</span>}
                      {seg.text}
                    </p>
                  ))}
                </div>
              </div>
            )
          })}

          {filteredSegments.length > 200 && (
            <p className="text-gray-600 text-sm text-center pt-2">
              Showing 200 of {filteredSegments.length.toLocaleString()} posts — use search to narrow results
            </p>
          )}
          {filteredSegments.length === 0 && (
            <p className="text-gray-500 text-sm">No segments found.</p>
          )}
        </div>
      ) : (
        /* ── Word/phrase frequency view ─────────────────────────────────── */
        <div className="space-y-2">
          {filtered.slice(0, 300).map((entry, i) => (
            <div key={entry.term} className="bg-q-panel border border-q-border rounded-xl px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="text-xs text-gray-600 font-mono w-8 shrink-0 pt-0.5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-white font-medium">{entry.term}</span>
                    <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                      {entry.count}× total
                    </span>
                    <span className="text-gray-500 text-xs">
                      {entry.postNums.length} post{entry.postNums.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {entry.postNums.slice(0, 12).map(num => (
                      <Link
                        key={num}
                        to={`/post/${num}?flash=1&highlight=${encodeURIComponent(entry.term)}&rk=term`}
                        className="text-xs font-mono text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 px-1.5 py-0.5 rounded transition-colors"
                      >
                        #{num}
                      </Link>
                    ))}
                    {entry.postNums.length > 12 && (
                      <span className="text-xs text-gray-600">+{entry.postNums.length - 12} more</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filtered.length > 300 && (
            <p className="text-gray-600 text-sm text-center pt-2">
              Showing top 300 of {filtered.length.toLocaleString()} — narrow the search to see more
            </p>
          )}
          {filtered.length === 0 && !loading && (
            <p className="text-gray-500 text-sm">No terms found matching your filters.</p>
          )}
        </div>
      )}
    </div>
  )
}
