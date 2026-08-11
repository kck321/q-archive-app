import { useEffect, useState } from 'react'
import { getResources } from '../lib/posts'
import { mutateStore } from '../lib/localData'
import type { QResource } from '../types'
import { CAN_EDIT } from '../lib/appMode'

const DEFAULT_RESOURCES: Omit<QResource, 'id' | 'addedAt'>[] = [
  {
    category: 'doj',
    title: 'Epstein DOJ Court Documents',
    description: 'Official Department of Justice documents related to Jeffrey Epstein cases',
    url: 'https://www.justice.gov/usao-sdny/us-v-ghislaine-maxwell',
  },
  {
    category: 'doj',
    title: 'PACER Federal Court Records',
    description: 'Public Access to Court Electronic Records — federal case filings',
    url: 'https://pacer.uscourts.gov',
  },
  {
    category: 'wikileaks',
    title: 'WikiLeaks Document Archive',
    description: 'Official WikiLeaks searchable document archive',
    url: 'https://wikileaks.org',
  },
  {
    category: 'wikileaks',
    title: 'WikiLeaks Hillary Clinton Emails',
    description: 'Searchable archive of released Clinton email documents',
    url: 'https://wikileaks.org/clinton-emails/',
  },
  {
    category: 'quid',
    title: 'QAlerts.app',
    description: 'Primary source for this archive — all Q post data',
    url: 'https://qalerts.app',
  },
  {
    category: 'quid',
    title: 'Q Research Board (8kun)',
    description: 'Original posting board for Q drops',
    url: 'https://8kun.top/qresearch',
  },
]

const CATEGORY_CONFIG: Record<QResource['category'], { label: string; icon: string; color: string }> = {
  doj:       { label: 'DOJ / Legal',      icon: '⚖️',  color: 'text-blue-400' },
  wikileaks: { label: 'WikiLeaks',        icon: '📂',  color: 'text-green-400' },
  videos:    { label: 'Videos',           icon: '🎥',  color: 'text-red-400' },
  podcasts:  { label: 'Podcasts',         icon: '🎙',  color: 'text-purple-400' },
  quid:      { label: 'Q Resources',     icon: '⬡',  color: 'text-gray-400' },
  other:     { label: 'Other',            icon: '🔗',  color: 'text-gray-400' },
}

export default function Resources() {
  const [resources, setResources] = useState<QResource[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', url: '', category: 'other' as QResource['category'] })

  useEffect(() => {
    getResources().then(items => {
      setResources(items)
      setLoading(false)
    })
  }, [])

  async function seedDefaults() {
    const saved: QResource[] = DEFAULT_RESOURCES.map(r => ({ id: crypto.randomUUID(), addedAt: Date.now(), ...r }))
    await mutateStore('resources', store => { store.resources.push(...saved) })
    setResources(saved)
  }

  async function addResource() {
    if (!form.title || !form.url) return
    const newResource: QResource = { id: crypto.randomUUID(), addedAt: Date.now(), ...form }
    await mutateStore('resources', store => { store.resources.push(newResource) })
    setResources(prev => [...prev, newResource])
    setForm({ title: '', description: '', url: '', category: 'other' })
    setAdding(false)
  }

  async function deleteResource(id: string) {
    await mutateStore('resources', store => { store.resources = store.resources.filter(r => r.id !== id) })
    setResources(prev => prev.filter(r => r.id !== id))
  }

  const byCategory = resources.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []
    acc[r.category].push(r)
    return acc
  }, {} as Record<string, QResource[]>)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Resources</h1>
          <p className="text-gray-400 text-sm mt-1">
            External links — DOJ files, WikiLeaks, Q videos, podcasts, and more
          </p>
        </div>
        <div className="flex gap-2">
          {CAN_EDIT && resources.length === 0 && (
            <button
              onClick={seedDefaults}
              className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors"
            >
              Load Defaults
            </button>
          )}
          {CAN_EDIT && (
          <button
            onClick={() => setAdding(a => !a)}
            className="text-sm bg-gray-600 hover:bg-gray-500 text-white font-medium px-3 py-2 rounded-lg transition-colors"
          >
            + Add Link
          </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-q-panel border border-q-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-white text-sm">Add Resource Link</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Title"
              className="bg-gray-900 border border-q-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-q-accent"
            />
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as QResource['category'] }))}
              className="bg-gray-900 border border-q-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-q-accent"
            >
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <input
            value={form.url}
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            placeholder="https://…"
            className="w-full bg-gray-900 border border-q-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-q-accent"
          />
          <input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            className="w-full bg-gray-900 border border-q-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-q-accent"
          />
          <div className="flex gap-2">
            <button onClick={addResource} className="bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium px-4 py-2 rounded-lg">Save</button>
            <button onClick={() => setAdding(false)} className="text-gray-400 text-sm px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading…</div>
      ) : resources.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No resources yet. Click "Load Defaults" or "+ Add Link".
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(CATEGORY_CONFIG) as QResource['category'][]).map(cat => {
            const items = byCategory[cat] ?? []
            if (items.length === 0) return null
            const conf = CATEGORY_CONFIG[cat]
            return (
              <div key={cat}>
                <h2 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${conf.color}`}>
                  {conf.icon} {conf.label}
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {items.map(r => (
                    <div key={r.id} className="bg-q-panel border border-q-border rounded-xl p-4 flex items-start gap-3 group">
                      <div className="flex-1 min-w-0">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-white hover:text-q-accent transition-colors"
                        >
                          {r.title} ↗
                        </a>
                        {r.description && (
                          <p className="text-xs text-gray-500 mt-1">{r.description}</p>
                        )}
                        <p className="text-xs text-gray-700 mt-1 truncate">{r.url}</p>
                      </div>
                      {CAN_EDIT && <button
                        onClick={() => deleteResource(r.id)}
                        className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs shrink-0"
                      >
                        ✕
                      </button>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
