// THREE SEGMENTS, ONE CARD, ONE TAB STOP.
//
// When a glossary term is cut into pieces by the certified annotation layer, only ONE piece may be
// interactive. The ruling is explicit about why: a control per word would put a button inside a
// button wherever the entity layer already owns one of the words, and it would give a keyboard user
// three stops for one term while a mouse user sees a single phrase. So the renderer promotes one
// segment to a control and leaves the rest as plain marked text.
//
// That is correct for the keyboard and wrong for the pointer, unless something reconnects them: a
// reader whose cursor lands on "COURT" is pointing at the term, and nothing would happen. This
// module is that reconnection. Every segment carries `data-gloss-occ="<occurrence id>"`; three
// listeners on the document translate a pointer event on any of them into open/close/toggle on the
// one registered anchor.
//
// DELEGATION RATHER THAN LISTENERS PER SEGMENT, for the same reason HoverCard registers its own
// dismissal handlers on open and removes them on close: a drop can carry dozens of marked segments,
// and per-segment handlers are per-segment leaks. Three listeners exist while at least one split
// occurrence is mounted, and none when the reader navigates away.

export const OCC_ATTR = 'data-gloss-occ'
export const ANCHOR_ATTR = 'data-gloss-anchor'

export interface OccurrenceAnchor {
  /** The trigger element, read live — it is remounted whenever the card opens or closes. */
  element: () => HTMLElement | null
  open: () => void
  close: () => void
  toggle: () => void
}

const anchors = new Map<string, OccurrenceAnchor[]>()
let installed = false

const asElement = (t: EventTarget | Node | null): Element | null =>
  t instanceof Element ? t : t instanceof Node ? t.parentElement : null

/** The marked segment an event happened inside, or null. */
function segmentOf(target: EventTarget | Node | null): HTMLElement | null {
  const el = asElement(target)
  return el ? (el.closest(`[${OCC_ATTR}]`) as HTMLElement | null) : null
}

/**
 * Is `el` part of occurrence `id`?
 *
 * HoverCard asks this before dismissing on an outside click. Without it, a tap on "COURT" is an
 * outside click that closes the card a moment before the delegated handler reopens it — the card
 * flickers, and a second tap looks like it does nothing.
 */
export function inOccurrence(target: EventTarget | Node | null, id: string): boolean {
  const seg = segmentOf(target)
  return Boolean(seg && seg.getAttribute(OCC_ATTR) === id)
}

/**
 * The anchor that owns this segment.
 *
 * Occurrence ids are derived from the drop, so the same drop rendered twice on one page — a post
 * that quotes itself — would register two anchors under one id. Picking by document order gives
 * each copy its own card instead of opening a card in the other copy of the drop, which is a
 * cheap guarantee for a case that should not arise and would be baffling if it did.
 */
function anchorFor(id: string, from: Element): OccurrenceAnchor | null {
  const list = anchors.get(id)
  if (!list?.length) return null
  if (list.length === 1) return list[0]
  let best: OccurrenceAnchor | null = null
  let firstAfter: OccurrenceAnchor | null = null
  for (const a of list) {
    const el = a.element()
    if (!el) continue
    const rel = from.compareDocumentPosition(el)
    if (rel & Node.DOCUMENT_POSITION_PRECEDING || rel & Node.DOCUMENT_POSITION_CONTAINS) best = a
    else if (!firstAfter) firstAfter = a
  }
  return best ?? firstAfter ?? list[0]
}

/** The anchor handles its own pointer events; these listeners are only for the other segments. */
const delegated = (target: EventTarget | Node | null): { seg: HTMLElement; id: string } | null => {
  const seg = segmentOf(target)
  if (!seg || seg.hasAttribute(ANCHOR_ATTR)) return null
  const id = seg.getAttribute(OCC_ATTR)
  return id ? { seg, id } : null
}

function onOver(e: MouseEvent) {
  const d = delegated(e.target)
  if (d) anchorFor(d.id, d.seg)?.open()
}

function onOut(e: MouseEvent) {
  const d = delegated(e.target)
  if (!d) return
  // Moving between two segments of the same term, or onto the card itself, is not leaving.
  const to = e.relatedTarget
  if (to && (inOccurrence(to, d.id) || asElement(to)?.closest('[role="tooltip"]'))) return
  anchorFor(d.id, d.seg)?.close()
}

function onClick(e: MouseEvent) {
  const d = delegated(e.target)
  if (!d) return
  // The post body is clickable in places; a tap on a glossed word is about the word.
  e.preventDefault()
  e.stopPropagation()
  anchorFor(d.id, d.seg)?.toggle()
}

// CAPTURE, for the same reason the trigger stops propagation on its own click: a marked segment
// sits inside a post body that has its own click handling, and a reader tapping a glossed word is
// asking about the word, not about whatever the paragraph does. Capture also puts these ahead of
// HoverCard's outside-click dismissal, which is where the flicker would otherwise come from.
function install() {
  if (installed) return
  document.addEventListener('mouseover', onOver, true)
  document.addEventListener('mouseout', onOut, true)
  document.addEventListener('click', onClick, true)
  installed = true
}

function uninstall() {
  if (!installed) return
  document.removeEventListener('mouseover', onOver, true)
  document.removeEventListener('mouseout', onOut, true)
  document.removeEventListener('click', onClick, true)
  installed = false
}

/** Registers an anchor and returns the matching unregister, for a `useEffect` cleanup. */
export function registerOccurrence(id: string, anchor: OccurrenceAnchor): () => void {
  const list = anchors.get(id) ?? []
  list.push(anchor)
  anchors.set(id, list)
  install()
  return () => {
    const cur = anchors.get(id)
    if (!cur) return
    const i = cur.indexOf(anchor)
    if (i >= 0) cur.splice(i, 1)
    if (!cur.length) anchors.delete(id)
    if (!anchors.size) uninstall()
  }
}
