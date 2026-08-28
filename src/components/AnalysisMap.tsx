import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadRelationships, type PostMap, type Edge } from '../lib/relationships'
import { sidebarOrder } from '../lib/sectionInfo'

// The Analysis Map — everything certified about one drop, in one place.
//
// Eight sections were built one at a time and each is accurate on its own, which left a reader
// holding eight separate lists about the same 4,966 posts. This is the view that makes them one
// analysis: what this drop contains, and where those layers touch each other.
//
// Every number comes from relationships.json, built from the certified artifacts. Nothing here
// counts anything itself — a component that re-derived a category would be the exact mistake
// that cost this project the most, and it would be invisible until the totals disagreed.

const LABELS: Record<string, { label: string; anchor: string }> = {
  questions: { label: 'Questions', anchor: 'questions' },
  directives: { label: 'Directives', anchor: 'requests' },
  claims: { label: 'Claims', anchor: 'claims' },
  predictions: { label: 'Predictions', anchor: 'predictions' },
  evidence: { label: 'Evidence', anchor: 'links' },
  entities: { label: 'Entities', anchor: 'namedEntities' },
  themes: { label: 'Themes', anchor: 'themes' },
  emphasis: { label: 'Emphasis', anchor: 'emphasis' },
  brackets: { label: '[ Brackets ]', anchor: 'brackets' },
}

// CODES IS NOT A CATEGORY OF THIS ARCHIVE, AND THE CHIP SAID IT WAS (owner ruling, 2026-08-24).
//
//   "i see 'codes' we don't have this category it should be brackets right so i want to get rid
//    of that category"
//
// There are EIGHT sections and none of them is "Codes" — the eighth is "Q Codes & Brackets",
// id `brackets`. The map was drawing two chips that both linked there: `Codes`, from the certified
// count in relationships.json, and `[ Brackets ]`, from the literal spans in the drop. A reader
// saw a category, clicked it, and arrived somewhere else.
//
// The certified Codes layer is NOT touched — 1,986 items, still counted and still listed in its own
// section. What goes is the second chip.
const NOT_A_SECTION = new Set(['codes'])

/** How each relationship reads in a sentence, and why it is allowed to exist. */
const REL: Record<string, { label: string; why: string }> = {
  question_directive: { label: 'Question ↔ Directive', why: 'one unit that is both an instruction and a request for an answer — counted once in each section, never twice within one' },
  claim_conclusion: { label: 'Claim → Conclusion', why: 'an attribute of the assertion, not a separate population' },
  claim_source_provided: { label: 'Claim → Source provided', why: 'the drop points at something a reader can check' },
  prediction_source_provided: { label: 'Prediction → Source provided', why: 'the same attribute on a prediction, kept apart from the claims figure' },
  prediction_assertion: { label: 'Prediction → Assertion family', why: 'a prediction is an assertion; the sections stay separate' },
  entity_code: { label: 'Entity ↔ Code', why: 'Entities asks who is referenced, Codes asks how Q marked the reference' },
  emphasis_question: { label: 'Emphasis ↔ Question', why: 'the emphasised span overlaps a certified question' },
  emphasis_directive: { label: 'Emphasis ↔ Directive', why: 'the emphasised span overlaps a certified directive' },
  emphasis_claim: { label: 'Emphasis ↔ Claim', why: 'the emphasised span overlaps a certified claim' },
  theme_support: { label: 'Theme → Supporting line', why: 'the anchor word the Themes audit recorded, shown where it appears' },
  evidence_claim: { label: 'Evidence ↔ Claim', why: 'the reference appears inside the claim itself' },
  unresolved_occurrence: { label: 'Unresolved item', why: 'deliberately not decided — held in the Resolution Center' },
}

export default function AnalysisMap({ postNum, onJump, extraCounts }: { postNum: number; onJump?: (section: string) => void; extraCounts?: Record<string, number> }) {
  const [map, setMap] = useState<PostMap | null>(null)
  const [edges, setEdges] = useState<Edge[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let live = true
    loadRelationships().then(r => {
      if (!live) return
      setMap(r.analysisMap[String(postNum)] ?? null)
      setEdges(r.byPost[String(postNum)] ?? [])
    }).catch(() => { /* the map is additive; a post still reads without it */ })
    return () => { live = false }
  }, [postNum])

  if (!map) return null

  const counts = { ...map.counts, ...(extraCounts ?? {}) }
  // Chips in sidebar order (owner ruling 2026-08-28) — Object.entries would otherwise hand
  // back whatever key order relationships.json was serialized in.
  const entries = Object.entries(counts)
    .filter(([k, n]) => n > 0 && k !== 'unresolved' && !NOT_A_SECTION.has(k))
    .sort(([a], [b]) => sidebarOrder(a, b))
  const byType = edges.reduce<Record<string, Edge[]>>((a, e) => { (a[e.type] ??= []).push(e); return a }, {})

  return (
    <div className="mt-4 rounded-lg border border-q-border bg-q-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-200">Analysis map</h3>
        <span className="text-[11px] text-gray-500">certified layers in this drop</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {entries.map(([k, n]) => (
          <button key={k} onClick={() => onJump?.(LABELS[k]?.anchor ?? k)}
            title={`Jump to the ${LABELS[k]?.label ?? k} in this post`}
            className="text-xs px-2 py-1 rounded border border-q-border text-gray-300 hover:text-white hover:border-blue-500/60">
            {LABELS[k]?.label ?? k} <span className="font-bold text-amber-300/90">{n}</span>
          </button>
        ))}
        {counts.unresolved > 0 && (
          <Link to={`/resolve?q=${postNum}`}
            title="These are deliberately undecided — help resolve them"
            className="text-xs px-2 py-1 rounded border border-blue-600/50 text-blue-300 hover:bg-blue-600/10">
            Unresolved <span className="font-bold">{counts.unresolved}</span>
          </Link>
        )}
      </div>

      {edges.length > 0 && (
        <>
          <button onClick={() => setOpen(o => !o)}
            className="mt-2.5 text-xs text-gray-400 hover:text-gray-200">
            {open ? '▾' : '▸'} {edges.length} relationship{edges.length === 1 ? '' : 's'} between these layers
          </button>

          {open && (
            <div className="mt-2 space-y-2">
              {/* Where one occurrence belongs to two layers, the relationship is stated rather
                  than the text appearing twice with no explanation of why. */}
              {Object.entries(byType).map(([type, list]) => (
                <div key={type} className="rounded border border-q-border/60 p-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-200">{REL[type]?.label ?? type}</span>
                    <span className="text-[11px] text-gray-500">{list.length}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{REL[type]?.why}</p>
                  <ul className="mt-1 space-y-0.5">
                    {list.slice(0, 4).map((e, i) => (
                      <li key={i} className="text-[11px] text-gray-400 font-mono leading-relaxed">
                        <span className="text-gray-300">{String(e.from.text ?? e.from.id).slice(0, 64)}</span>
                        {e.to.attribute
                          ? <span className="text-gray-600"> → {e.to.attribute}</span>
                          : <span className="text-gray-600"> ↔ {String(e.to.text ?? e.to.id).slice(0, 48)}</span>}
                      </li>
                    ))}
                    {list.length > 4 && <li className="text-[11px] text-gray-600">+{list.length - 4} more</li>}
                  </ul>
                  <p className="text-[10px] text-gray-600 mt-1">Basis: {list[0]?.basis}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
