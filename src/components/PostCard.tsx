import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { updatePost, getQuestionsForPost, addQuestions, removeQuestionById, addQuestionToMatchingPosts } from '../lib/posts'
import { useAdmin } from './AdminContext'
import { getAliasesFor, addAlias, removeAlias, subscribeAliases } from '../lib/aliases'
import { sourceLink } from '../lib/sourceLink'
import QuotedPosts from './QuotedPosts'
import { linkify } from '../lib/linkify'
import { mediaUrl, dedupeMedia } from '../lib/mediaUrl'
import { timeAgo } from '../lib/timeAgo'
import { highlightText } from '../lib/postHighlight'
import { useHighlightsEnabled } from '../lib/highlightPrefs'
import { CAN_EDIT } from '../lib/appMode'
import type { QPost, QQuestion, PostAnalysis } from '../types'

interface Props {
  post: QPost
  questionTexts?: string[]
  searchKeyword?: string
  onAddQuestion?: (postId: string, postNum: number, text: string) => Promise<void>
}


function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function PostCard({ post, questionTexts = [], searchKeyword = '', onAddQuestion }: Props) {
  const { unlocked: adminUnlocked, requireAdmin } = useAdmin()
  const [localQuestions, setLocalQuestions] = useState<QQuestion[]>([])
  const [qMsg, setQMsg] = useState<string | null>(null)
  useEffect(() => { getQuestionsForPost(post.id).then(setLocalQuestions).catch(() => {}) }, [post.id])
  const [selectMode, setSelectMode] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  // Analysis editing state — syncs with fresh prop data when parent re-fetches
  const [localAnalysis, setLocalAnalysis] = useState<PostAnalysis>(() => post.postAnalysis ?? {})
  const [localRequests, setLocalRequests] = useState<string[]>(() => post.actionRequests ?? [])
  useEffect(() => { setLocalAnalysis(post.postAnalysis ?? {}) }, [post.postAnalysis])
  useEffect(() => { setLocalRequests(post.actionRequests ?? []) }, [post.actionRequests])
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [addingToKey, setAddingToKey] = useState<string | null>(null)
  const addingToKeyRef = useRef<string | null>(null)
  addingToKeyRef.current = addingToKey
  const [addInput, setAddInput] = useState('')

  // Alias editing on analysis chips (e.g. connect "Q+" / "Donald J. Trump" to the "Trump" entity).
  // aliasFor = which chip's input is open ("<key>::<item>"); aliasTick re-renders on alias changes.
  const [aliasFor, setAliasFor] = useState<string | null>(null)
  const [aliasInput, setAliasInput] = useState('')
  const [, setAliasTick] = useState(0)
  useEffect(() => subscribeAliases(() => setAliasTick(t => t + 1)), [])
  useHighlightsEnabled()   // re-render this card when the language toggle flips

  const CATS: { key: keyof PostAnalysis; label: string; color: string; chip: string }[] = [
    { key: 'namedEntities',      label: 'Named Entities',      color: 'text-cyan-400',   chip: 'bg-cyan-500/20 text-cyan-200 border-cyan-700/50' },
    { key: 'claims',             label: 'Claims',              color: 'text-amber-400',  chip: 'bg-amber-500/20 text-amber-200 border-amber-700/50' },
    { key: 'predictions',        label: 'Predictions',         color: 'text-violet-400', chip: 'bg-violet-500/20 text-violet-200 border-violet-700/50' },
    { key: 'impliedConclusions', label: 'Impl. Conclusions',   color: 'text-orange-400', chip: 'bg-orange-500/20 text-orange-200 border-orange-700/50' },
    { key: 'verificationHooks',  label: 'Checkable Claims',        color: 'text-fuchsia-400', chip: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-700/50' },
    { key: 'themes',             label: 'Themes',              color: 'text-indigo-400', chip: 'bg-indigo-500/20 text-indigo-200 border-indigo-700/50' },
    { key: 'emphasis',           label: 'Emphasis',            color: 'text-slate-400',  chip: 'bg-slate-500/20 text-slate-200 border-slate-600/50' },
  ]

  async function handleAddItem(key: keyof PostAnalysis, text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const current = (localAnalysis[key] as string[] | undefined) ?? []
    if (current.some(i => i.toLowerCase() === trimmed.toLowerCase())) return
    const updated = [...current, trimmed]
    const newAnalysis = { ...localAnalysis, [key]: updated }
    setLocalAnalysis(newAnalysis)
    await updatePost(post.id, { postAnalysis: newAnalysis, analysisScanned: true })
  }

  async function handleRemoveItem(key: keyof PostAnalysis, text: string) {
    const current = (localAnalysis[key] as string[] | undefined) ?? []
    const updated = current.filter(i => i !== text)
    const newAnalysis = { ...localAnalysis, [key]: updated }
    setLocalAnalysis(newAnalysis)
    await updatePost(post.id, { postAnalysis: newAnalysis })
  }

  async function handleAddRequest(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    if (localRequests.some(r => r.toLowerCase() === trimmed.toLowerCase())) return
    const updated = [...localRequests, trimmed]
    setLocalRequests(updated)
    await updatePost(post.id, { actionRequests: updated, hasRequests: true })
  }

  async function handleRemoveRequest(text: string) {
    const updated = localRequests.filter(r => r !== text)
    setLocalRequests(updated)
    await updatePost(post.id, { actionRequests: updated, hasRequests: updated.length > 0 })
  }

  async function handleAddQuestionText(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    if (localQuestions.some(q => q.text.toLowerCase().trim() === trimmed.toLowerCase())) return
    const newQ: QQuestion = {
      id: crypto.randomUUID(), postId: post.id, postNum: post.postNum,
      text: trimmed, status: 'unprocessed', infographId: null, createdAt: Date.now(),
    }
    await addQuestions([newQ])
    setLocalQuestions(prev => [...prev, newQ])
  }

  async function handleRemoveQuestionLocal(qid: string) {
    setLocalQuestions(prev => prev.filter(q => q.id !== qid))
    removeQuestionById(qid).catch(() => {})
  }

  function handleAddQuestionAll(text: string) {
    requireAdmin(`add question "${text}" to every post that contains it`, async () => {
      setQMsg('Adding…')
      const { added, matched } = await addQuestionToMatchingPosts(text)
      setLocalQuestions(await getQuestionsForPost(post.id))
      setQMsg(`✓ Added "${text}" to ${added} post${added === 1 ? '' : 's'} (of ${matched} containing it).`)
    })
  }


  function cancel() {
    setSelectMode(false)
    setSelectedText('')
    setSaved(false)
    window.getSelection()?.removeAllRanges()
  }

  function handleMouseUp() {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !preRef.current?.contains(sel.anchorNode)) return
    const text = sel.toString().trim()
    if (text.length >= 3) {
      setSelectedText(text)
      if (addingToKeyRef.current) setAddInput(text)
    }
  }

  async function handleSave() {
    if (!selectedText || !onAddQuestion || saving) return
    setSaving(true)
    try {
      await onAddQuestion(post.id, post.postNum, selectedText)
      setSaved(true)
      window.getSelection()?.removeAllRanges()
      setTimeout(() => {
        setSelectMode(false)
        setSelectedText('')
        setSaved(false)
      }, 1500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`bg-q-panel rounded-xl p-4 transition-all ${
      selectMode
        ? 'border-2 border-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.2)]'
        : 'border border-q-border hover:border-gray-600'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link to={`/post/${post.id}?flash=1`} className="text-gray-400 font-bold text-sm hover:text-white shrink-0">
            #{post.postNum}
          </Link>
          <span className="text-xs text-gray-500 shrink-0">{formatDate(post.timestamp)}</span>
          <span className="text-xs text-gray-600 shrink-0 ml-2" title="How long ago this drop was posted">{timeAgo(post.timestamp)}</span>
          {post.source && (() => {
            const src = sourceLink(post)
            if (!src.url) {
              return (
                <span title={src.hint} className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded shrink-0">
                  {src.label}
                </span>
              )
            }
            return (
              <a
                href={src.url}
                target="_blank"
                rel="noreferrer"
                title={src.hint}
                onClick={e => e.stopPropagation()}
                className="text-xs bg-gray-800 text-gray-400 hover:text-blue-300 hover:bg-gray-700 px-2 py-0.5 rounded shrink-0 transition-colors"
              >
                {src.label} {src.kind === 'archived' ? '🗄' : '↗'}
              </a>
            )
          })()}
          {questionTexts.length > 0 && (
            <span className="text-xs bg-blue-900/50 text-blue-400 border border-blue-800/60 px-2 py-0.5 rounded font-medium">
              {questionTexts.length} question{questionTexts.length !== 1 ? 's' : ''}
            </span>
          )}
          {post.hasRequests && (
            <span className="text-xs bg-green-900/50 text-green-400 border border-green-800/60 px-2 py-0.5 rounded font-medium">
              {post.actionRequests?.length ?? 0} request{(post.actionRequests?.length ?? 0) !== 1 ? 's' : ''}
            </span>
          )}
          {post.postAnalysis && (post.postAnalysis.claims?.length ?? 0) > 0 && (
            <span className="text-xs bg-amber-900/50 text-amber-400 border border-amber-800/60 px-2 py-0.5 rounded font-medium">
              {post.postAnalysis.claims!.length} claim{post.postAnalysis.claims!.length !== 1 ? 's' : ''}
            </span>
          )}
          {post.postAnalysis && (post.postAnalysis.predictions?.length ?? 0) > 0 && (
            <span className="text-xs bg-violet-900/50 text-violet-400 border border-violet-800/60 px-2 py-0.5 rounded font-medium">
              {post.postAnalysis.predictions!.length} prediction{post.postAnalysis.predictions!.length !== 1 ? 's' : ''}
            </span>
          )}
          {post.postAnalysis && (post.postAnalysis.namedEntities?.length ?? 0) > 0 && (
            <span className="text-xs bg-cyan-900/50 text-cyan-400 border border-cyan-800/60 px-2 py-0.5 rounded font-medium">
              {post.postAnalysis.namedEntities!.length} entities
            </span>
          )}
          {post.postAnalysis && (post.postAnalysis.impliedConclusions?.length ?? 0) > 0 && (
            <span className="text-xs bg-orange-900/50 text-orange-400 border border-orange-800/60 px-2 py-0.5 rounded font-medium">
              {post.postAnalysis.impliedConclusions!.length} conclusion{post.postAnalysis.impliedConclusions!.length !== 1 ? 's' : ''}
            </span>
          )}
          {post.postAnalysis && (post.postAnalysis.verificationHooks?.length ?? 0) > 0 && (
            <span className="text-xs bg-fuchsia-900/50 text-fuchsia-400 border border-fuchsia-800/60 px-2 py-0.5 rounded font-medium">
              {post.postAnalysis.verificationHooks!.length} checkable claim{post.postAnalysis.verificationHooks!.length !== 1 ? 's' : ''}
            </span>
          )}
          {post.postAnalysis && (post.postAnalysis.emphasis?.length ?? 0) > 0 && (
            <span className="text-xs bg-slate-800/60 text-slate-300 border border-slate-600/60 px-2 py-0.5 rounded font-medium">
              {post.postAnalysis.emphasis!.length} emphasis
            </span>
          )}
          {(post.qThreadReplies?.length ?? 0) > 0 && (
            <span className="text-xs bg-yellow-900/50 text-yellow-300 border border-yellow-700/60 px-2 py-0.5 rounded font-medium">
              🔐 Q replied ×{post.qThreadReplies!.length}
            </span>
          )}
        </div>
      </div>

      {/* Selection mode instruction banner */}
      {selectMode && (
        <div className="mb-3 flex items-center gap-2 bg-blue-900/30 border border-blue-600 rounded-lg px-3 py-2">
          <span className="text-blue-400 text-sm">👆</span>
          <p className="text-xs text-blue-300 font-medium">
            Highlight the missed question text in the post below, then click <span className="text-white font-bold">Save Additional Question</span>
          </p>
        </div>
      )}

      {/* What this drop is replying to. Shown here as well as on the post page: a drop whose
          whole body is ">>2950820" is otherwise an empty row in the results list, and a
          search can match the quoted text alone. */}
      <QuotedPosts quoted={post.quotedPosts ?? []} searchKeyword={searchKeyword} />

      {/* Full post text */}
      <pre
        ref={preRef}
        onMouseUp={handleMouseUp}
        className={`text-gray-300 post-text whitespace-pre-wrap break-words rounded-lg p-3 overflow-x-auto transition-colors ${
          selectMode
            ? 'bg-blue-950/30 cursor-text select-text'
            : 'bg-black/20'
        }`}
      >
        {linkify(highlightText(post.text, questionTexts, searchKeyword, localRequests, localAnalysis))}
      </pre>

      {/* Attachments. These were missing from the card entirely, so a search result never
          showed the image even when the image WAS the post. */}
      {dedupeMedia(post.media).length > 0 && (
        <div className="mt-3 space-y-2">
          {dedupeMedia(post.media).map(m => {
            if (!m.url) return null
            const isNonImage = /\.(pdf|mp4|webm|mov|doc|docx|xls|xlsx)$/i.test(m.url)
            return isNonImage ? (
              <a key={m.url} href={mediaUrl(m.url)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline bg-gray-800 px-2 py-1 rounded">
                📎 {m.filename || m.url}
              </a>
            ) : (
              <a key={m.url} href={mediaUrl(m.url)} target="_blank" rel="noreferrer"
                className="block rounded-lg overflow-hidden border border-gray-700 hover:border-gray-500">
                <img
                  src={mediaUrl(m.url)}
                  alt={m.filename}
                  loading="lazy"
                  className="max-w-full h-auto block"
                  onError={e => { (e.currentTarget.closest('a') as HTMLElement).style.display = 'none' }}
                />
              </a>
            )
          })}
        </div>
      )}

      {/* Inline Analysis Editor */}
      <div className="mt-3">
        {CAN_EDIT && (
        <button
          onClick={() => { if (analysisOpen) setAnalysisOpen(false); else requireAdmin("edit this post's analysis", () => setAnalysisOpen(true)) }}
          className="text-xs text-gray-500 hover:text-violet-300 border border-gray-700 hover:border-violet-700/60 bg-gray-800/40 hover:bg-violet-900/20 px-3 py-1 rounded-lg transition-colors"
        >
          🔬 {analysisOpen ? '▲ Hide Analysis' : adminUnlocked ? '▼ Edit Analysis' : '🔒 Edit Analysis'}
        </button>
        )}

        {analysisOpen && (
          <div className="mt-2 bg-black/20 border border-violet-800/30 rounded-xl p-3 space-y-2">
            {selectedText && !addingToKey && (
              <p className="text-xs text-blue-400">
                📋 "<span className="text-blue-200">{selectedText.length > 50 ? selectedText.slice(0, 50) + '…' : selectedText}</span>" — click <span className="font-semibold">+ add</span> to use
              </p>
            )}
            {/* Questions row */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium w-28 shrink-0 text-blue-400">Questions</span>
                {addingToKey === 'questions' ? (
                  <form className="flex gap-1 flex-1" onSubmit={e => {
                    e.preventDefault()
                    handleAddQuestionText(addInput)
                    setAddInput(''); setAddingToKey(null)
                  }}>
                    <input autoFocus value={addInput} onChange={e => setAddInput(e.target.value)}
                      placeholder="Highlight text above, or type…"
                      className="flex-1 bg-gray-800 border border-blue-700 rounded px-2 py-0.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 min-w-0" />
                    <button type="submit" className="text-xs bg-blue-800 hover:bg-blue-700 text-white px-2 py-0.5 rounded">Add</button>
                    <button type="button" onClick={() => { setAddingToKey(null); setAddInput('') }} className="text-xs text-gray-500 hover:text-white px-1">✕</button>
                  </form>
                ) : (
                  <button onClick={() => { setAddingToKey('questions'); setAddInput(selectedText) }}
                    className={`text-xs ml-1 shrink-0 transition-colors ${selectedText ? 'text-blue-400 hover:text-blue-200 font-medium' : 'text-gray-600 hover:text-gray-300'}`}>
                    {selectedText ? '📋 + add' : '+ add'}
                  </button>
                )}
              </div>
              {localQuestions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {localQuestions.map(q => (
                    <span key={q.id} className="text-xs border border-blue-700/50 bg-blue-900/20 text-blue-200 px-2 py-0.5 rounded flex items-center gap-1 group">
                      {q.text}
                      <button onClick={() => handleAddQuestionAll(q.text)}
                        title={`Admin: add this question to every post containing "${q.text}"`}
                        className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-white transition-all leading-none">⇉ add all</button>
                      <button onClick={() => handleRemoveQuestionLocal(q.id)}
                        className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-red-300 transition-all leading-none">✕</button>
                    </span>
                  ))}
                </div>
              )}
              {qMsg && (
                <p className="text-[11px] text-green-300 mt-1 flex items-center gap-2">
                  {qMsg}<button onClick={() => setQMsg(null)} className="text-gray-500 hover:text-white">✕</button>
                </p>
              )}
            </div>

            {/* Requests row */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium w-28 shrink-0 text-green-400">Requests</span>
                {addingToKey === 'request' ? (
                  <form className="flex gap-1 flex-1" onSubmit={e => {
                    e.preventDefault()
                    handleAddRequest(addInput)
                    setAddInput(''); setAddingToKey(null)
                  }}>
                    <input autoFocus value={addInput} onChange={e => setAddInput(e.target.value)}
                      placeholder="Highlight text above, or type…"
                      className="flex-1 bg-gray-800 border border-green-700 rounded px-2 py-0.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-green-400 min-w-0" />
                    <button type="submit" className="text-xs bg-green-800 hover:bg-green-700 text-white px-2 py-0.5 rounded">Add</button>
                    <button type="button" onClick={() => { setAddingToKey(null); setAddInput('') }} className="text-xs text-gray-500 hover:text-white px-1">✕</button>
                  </form>
                ) : (
                  <button onClick={() => { setAddingToKey('request'); setAddInput(selectedText) }}
                    className={`text-xs ml-1 shrink-0 transition-colors ${selectedText ? 'text-blue-400 hover:text-blue-200 font-medium' : 'text-gray-600 hover:text-gray-300'}`}>
                    {selectedText ? '📋 + add' : '+ add'}
                  </button>
                )}
              </div>
              {localRequests.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {localRequests.map((req, i) => (
                    <span key={i} className="text-xs border border-green-700/50 bg-green-900/20 text-green-200 px-2 py-0.5 rounded flex items-center gap-1 group">
                      {req}
                      <button onClick={() => handleRemoveRequest(req)}
                        className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-red-300 transition-all leading-none">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Analysis categories */}
            {CATS.map(({ key, label, color, chip }) => {
              const items = (localAnalysis[key] as string[] | undefined) ?? []
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium w-28 shrink-0 ${color}`}>{label}</span>
                    {addingToKey === key ? (
                      <form className="flex gap-1 flex-1" onSubmit={e => {
                        e.preventDefault()
                        handleAddItem(key, addInput)
                        setAddInput(''); setAddingToKey(null)
                      }}>
                        <input
                          autoFocus
                          value={addInput}
                          onChange={e => setAddInput(e.target.value)}
                          placeholder="Highlight text above, or type…"
                          className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white min-w-0"
                        />
                        <button type="submit" className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded">Add</button>
                        <button type="button" onClick={() => { setAddingToKey(null); setAddInput('') }} className="text-xs text-gray-500 hover:text-white px-1">✕</button>
                      </form>
                    ) : (
                      <button
                        onClick={() => { setAddingToKey(key); setAddInput(selectedText) }}
                        className={`text-xs ml-1 shrink-0 transition-colors ${selectedText ? 'text-blue-400 hover:text-blue-200 font-medium' : 'text-gray-600 hover:text-gray-300'}`}
                      >
                        {selectedText ? '📋 + add' : '+ add'}
                      </button>
                    )}
                  </div>
                  {items.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-0">
                      {items.map((item, i) => {
                        const aliases = getAliasesFor(item)
                        const aliasId = `${key}::${item}`
                        return (
                          <React.Fragment key={i}>
                          <span className={`text-xs border px-2 py-0.5 rounded flex items-center gap-1 group ${chip}`}>
                            {item}
                            {aliases.length > 0 && (
                              <span className="opacity-75 text-[10px] italic">
                                also: {aliases.map((al, j) => (
                                  <span key={al} className="not-italic">
                                    {j > 0 && ', '}{al}
                                    {adminUnlocked && (
                                      <button onClick={() => removeAlias(item, al)} title={`Remove alias "${al}"`}
                                        className="ml-0.5 hover:text-red-300">×</button>
                                    )}
                                  </span>
                                ))}
                              </span>
                            )}
                            {adminUnlocked && (
                              <button onClick={() => { const open = aliasFor === aliasId; setAliasFor(open ? null : aliasId); setAliasInput(open ? '' : selectedText) }}
                                title="Connect an alternate name to this entity (e.g. add &quot;Q+&quot; or &quot;Donald J. Trump&quot; to &quot;Trump&quot;) — highlight a word in the post first to drop it in"
                                className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-white transition-all leading-none">{selectedText ? '📋 🔤 alias' : '🔤 alias'}</button>
                            )}
                            {adminUnlocked && (
                              <button
                                onClick={() => handleRemoveItem(key, item)}
                                className="opacity-0 group-hover:opacity-100 ml-0.5 text-[10px] hover:text-red-300 transition-all leading-none"
                              >✕</button>
                            )}
                          </span>
                          {aliasFor === aliasId && (
                            <form className="inline-flex items-center gap-1"
                              onSubmit={e => { e.preventDefault(); const v = aliasInput.trim(); if (v) addAlias(item, v); setAliasInput(''); setAliasFor(null) }}>
                              <input autoFocus value={aliasInput} onChange={e => setAliasInput(e.target.value)}
                                placeholder="alt name (e.g. Q+, Donald J. Trump)"
                                className="bg-gray-800 border border-cyan-700 rounded px-2 py-0.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 w-52" />
                              <button type="submit" className="text-xs bg-cyan-800 hover:bg-cyan-700 text-white px-2 py-0.5 rounded">Add</button>
                              <button type="button" onClick={() => { setAliasFor(null); setAliasInput('') }} className="text-xs text-gray-500 hover:text-white px-1">✕</button>
                            </form>
                          )}
                          </React.Fragment>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>


      {/* Selected text preview + save */}
      {selectMode && (
        <div className="mt-3 space-y-2">
          {selectedText ? (
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1 font-medium">Selected question text:</p>
              <p className="text-sm text-white leading-snug">"{selectedText}"</p>
            </div>
          ) : (
            <div className="bg-gray-800/50 border border-dashed border-gray-600 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">No text selected yet — highlight text above</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!selectedText || saving || saved}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                saved
                  ? 'bg-green-700 text-green-200'
                  : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40'
              }`}
            >
              {saved ? '✓ Question Saved!' : saving ? 'Saving…' : 'Save Additional Question'}
            </button>
            <button
              onClick={cancel}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer: topic tags + Add Question button */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex flex-wrap gap-1">
          {post.topicTags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
