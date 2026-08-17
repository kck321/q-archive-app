// Where did an entity occurrence come from, when its name is nowhere in the rendered post?
//
//   node scripts/audit-invisible-hover-provenance.mjs
//
// OWNER RULING, 2026-08-16. A post-specific text hover may be public only when a visible textual
// anchor exists in the rendered post. These records have none, so they are excluded from the
// public bundle and classified `no_visible_text_anchor` — but that is a statement about the
// TOOLTIP, not about the occurrence. A certified mention is not invalid merely because a tooltip
// cannot render over it, and nothing here moves a certified count.
//
// So each record is sorted by WHAT ACTUALLY SUPPORTS IT, into the four categories the ruling
// named. Two things about that sorting are worth stating before the numbers are read:
//
//   1. `image_provenance_confirmed` is empty, and it is empty for a reason that can be checked
//      rather than asserted: the corpus carries no OCR, no image annotation and no bounding-box
//      data anywhere. Media entries hold a filename and a URL and nothing else. Marking a record
//      "confirmed" with no source capable of confirming it would be a vacuous pass wearing the
//      ruling's own vocabulary, so the script ASSERTS the absence of those fields instead of
//      assuming it, and fails loudly if one ever appears.
//
//   2. A fifth category had to be declared. 100-odd of these records are the publisher of a link
//      Q pasted — "Daily Beast" behind thedailybeast.com, "USA Today" behind usatoday.com. They
//      are not image-derived, and they are not metadata that goes unrendered: the URL is on
//      screen, in full, and the reader can see it. They simply are not spelled the way the entity
//      is. Forcing them into `no_supported_provenance` would say there is no evidence when there
//      plainly is some, which is the inference the ruling forbids. They are reported separately
//      and flagged as needing a ruling of their own.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { aliasLocation, urlSpans, runtimeText } from './lib/hoverValidation.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'public', 'data')
const OUT = path.join(ROOT, 'audit')
const MEDIA = path.join(ROOT, 'media-bundle')
const read = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))

const bundle = read(OUT, 'entity-hover-no-visible-anchor.json')
const entities = read(DATA, 'entities.json')
const posts = read(DATA, 'posts.json')
const byId = new Map(entities.entities.map(e => [e.id, e]))
const byNum = new Map(posts.map(p => [p.postNum, p]))

// ── the assertion that keeps "confirmed: 0" honest ──────────────────────────
// A zero is not evidence until the field is proved to exist. If an OCR or annotation field is
// ever added to the corpus, this script must be taught to read it rather than quietly keep
// reporting that nothing can be confirmed.
const OCR_FIELDS = ['ocr', 'ocrText', 'imageText', 'annotations', 'boundingBoxes', 'boxes', 'alt', 'caption', 'detectedEntities']
const mediaFieldNames = new Set()
for (const p of posts) for (const m of [...(p.media ?? []), ...(p.refMedia ?? [])]) for (const k of Object.keys(m ?? {})) mediaFieldNames.add(k)
const postFieldNames = new Set()
for (const p of posts) for (const k of Object.keys(p)) postFieldNames.add(k)
const ocrPresent = OCR_FIELDS.filter(f => mediaFieldNames.has(f) || postFieldNames.has(f))
if (ocrPresent.length) {
  console.error(`\n❌ image-derived fields exist that this audit does not read: ${ocrPresent.join(', ')}`)
  console.error(`   "image_provenance_confirmed: 0" would be a false negative. Teach the script to read them.\n`)
  process.exit(1)
}

// Which of these were PUBLIC in production (seed 77, f406402)? That subset is the population the
// ruling was written about — the records a reader could actually hover yesterday.
let prodPublicKeys = null
const prodFile = process.env.PROD_HOVERS
if (prodFile && fs.existsSync(prodFile)) {
  const prod = JSON.parse(fs.readFileSync(prodFile, 'utf8'))
  prodPublicKeys = new Set()
  for (const [id, byPost] of Object.entries(prod.byPost ?? {})) for (const pn of Object.keys(byPost)) prodPublicKeys.add(`${id} ${pn}`)
}

// Fields a reader never sees as post text but which the archive does carry. A media FILENAME is
// included deliberately: it is the name the uploader gave the image, so it is image-derived data
// even though it is not image CONTENT.
const METADATA_FIELDS = ['subject', 'name', 'link', 'trip']

const glue = s => String(s).toLowerCase().replace(/%[0-9a-f]{2}/gi, '').replace(/[^a-z0-9]+/g, '')

const rows = []
for (const r of bundle.records) {
  const e = byId.get(r.entityId)
  const p = byNum.get(r.postNum)
  if (!e || !p) { console.error(`missing entity or post for ${r.auditOccurrenceId}`); process.exit(1) }
  const aliases = [...new Set([...e.aliases.map(a => a.text), e.canonical])]
  const text = runtimeText(p.text ?? '')

  // ── metadata that is never rendered as post text ──────────────────────────
  const metaHits = []
  for (const f of METADATA_FIELDS) {
    const v = String(p[f] ?? '')
    if (!v) continue
    for (const a of aliases) if (aliasLocation(v, a).inProse) metaHits.push({ field: f, alias: a, value: v.slice(0, 160) })
  }
  for (const a of aliases) {
    const tags = (p.topicTags ?? []).join(' | ')
    if (tags && aliasLocation(tags, a).inProse) metaHits.push({ field: 'topicTags', alias: a, value: tags.slice(0, 160) })
  }

  // ── image evidence ────────────────────────────────────────────────────────
  const media = p.media ?? []
  const refMedia = p.refMedia ?? []
  const filenames = [...media, ...refMedia].map(m => m.filename ?? '').filter(Boolean)
  const filenameHits = []
  for (const fn of filenames) for (const a of aliases) if (aliasLocation(fn.replace(/[_-]+/g, ' '), a).inProse) filenameHits.push({ filename: fn, alias: a })
  // Whether the image is even held locally decides whether a human COULD adjudicate it offline.
  const localFiles = [...media, ...refMedia].map(m => {
    const hash = String(m.url ?? '').split('/').pop() ?? ''
    return hash && fs.existsSync(path.join(MEDIA, hash)) ? hash : null
  }).filter(Boolean)

  // ── URL evidence the token-boundary detector cannot see ───────────────────
  // "Daily Beast" is not a token of "thedailybeast.com" once punctuation is folded, and matching
  // across word boundaries is exactly how "US" starts matching inside "because". So the glued
  // comparison lives HERE, as a reporting signal for a human, and never in the classifier.
  const urlHits = []
  for (const [, , url] of urlSpans(text)) {
    const ws = url.replace(/^https?:\/\//i, '')
    const qi = ws.indexOf('?')
    const hostPath = qi === -1 ? ws : ws.slice(0, qi)
    const si = hostPath.indexOf('/')
    const host = si === -1 ? hostPath : hostPath.slice(0, si)
    const rest = (si === -1 ? '' : hostPath.slice(si)) + (qi === -1 ? '' : ws.slice(qi))
    for (const a of aliases) {
      if (glue(a).length < 4) continue
      if (glue(host).includes(glue(a))) urlHits.push({ part: 'hostname', url, host, alias: a })
      else if (glue(rest).includes(glue(a))) urlHits.push({ part: 'path-or-query', url, host, alias: a })
    }
  }
  const hostHit = urlHits.find(h => h.part === 'hostname')

  // ── the substring defect, one layer below the hover ───────────────────────
  // "God" is a certified entity in 47 of these drops, and every one of them says "Godfather III".
  // The occurrence was extracted by substring at ingest — invariant 4, in the certified data
  // rather than in a renderer. Reported, not acted on: it is a count-changing finding.
  let substringOf = null
  for (const a of aliases) {
    const g = glue(a)
    if (g.length < 3) continue
    for (const w of text.split(/\s+/)) {
      const gw = glue(w)
      if (gw !== g && gw.includes(g)) { substringOf = { alias: a, insideWord: w.slice(0, 60) }; break }
    }
    if (substringOf) break
  }

  // ── the category ──────────────────────────────────────────────────────────
  // Priority, stated so it can be re-ranked: certified metadata that names the entity outright
  // beats a domain that merely carries its brand, which beats an image nothing can be checked
  // against, which beats nothing at all.
  //
  // A glued PATH or QUERY match is deliberately NOT treated as provenance. The owner already
  // ruled on that class: a slug is generated by the publisher's CMS and a query term is what Q
  // searched for, so neither is Q naming a thing. Promoting one to "supported" here would let the
  // cleanup's own policy be contradicted by the audit meant to complement it. The evidence is
  // still recorded on the row, so the reason for the verdict is visible.
  const category = filenameHits.length ? 'image_provenance_confirmed'
    : metaHits.length ? 'nonvisual_metadata_provenance'
      : hostHit ? 'url_source_provenance'
        : (media.length || refMedia.length) ? 'image_provenance_unconfirmed'
          : 'no_supported_provenance'

  const entriesInPost = (p.postAnalysis?.namedEntities ?? [])
    .filter(t => aliases.some(a => a.toLowerCase() === t.toLowerCase())).length

  rows.push({
    auditOccurrenceId: r.auditOccurrenceId,
    postNum: r.postNum,
    entityId: r.entityId,
    canonical: e.canonical,
    entityType: e.type,
    aliases,
    matchedAlias: r.matchedAlias,
    wasPublicInProduction: prodPublicKeys ? prodPublicKeys.has(`${r.entityId} ${r.postNum}`) : null,
    hoverClassification: 'no_visible_text_anchor',
    provenanceCategory: category,
    migratesToLinkedSource: category === 'url_source_provenance',
    originalSourceField: 'postAnalysis.namedEntities',
    auditEvidenceBasis: r.evidenceBasis ?? null,
    auditContextSupport: r.contextSupport ?? null,
    auditLocalRole: r.localRole ?? null,
    certifiedOccurrencesInPost: entriesInPost,
    evidence: {
      mediaAttached: media.length,
      referencedMedia: refMedia.length,
      mediaFilenames: filenames,
      mediaHeldLocally: localFiles.length,
      filenameNamesEntity: filenameHits,
      metadataMatches: metaHits,
      urlBrandMatches: urlHits.slice(0, 6),
      aliasIsSubstringOfALongerWord: substringOf,
      ocrAvailable: false,
      boundingBoxesAvailable: false,
    },
    whyProvenanceInsufficient:
      category === 'no_supported_provenance'
        ? (substringOf
          ? `No visible text, no image and no certified metadata names this entity. The alias "${substringOf.alias}" does occur inside the longer word "${substringOf.insideWord}", which is how the occurrence was most likely extracted — a substring match, not a mention.`
          : urlHits.length
            ? `No visible text, no image and no certified metadata names this entity. Its brand does appear glued into the path or query of a link (${urlHits[0].url.slice(0, 90)}), but the owner has already ruled that a path slug and a query term are not entity mentions, so that is not provenance for one.`
            : 'No visible text, no attached or referenced image, and no certified metadata field names this entity in this drop.')
        : category === 'image_provenance_unconfirmed'
          ? `The drop carries ${media.length + refMedia.length} image(s), but the archive holds no OCR, caption or annotation data, so the image cannot be shown to contain the entity. ${localFiles.length} of them are held locally and could be adjudicated by eye.`
          : category === 'url_source_provenance'
            ? `The entity is the publisher behind a link in this drop (${hostHit?.host ?? urlHits[0]?.host}), but its name is not spelled as a token of the URL, so neither the visible-anchor rule nor the URL classifier can act on it. Outside the four categories the ruling named — needs its own ruling.`
            : category === 'nonvisual_metadata_provenance'
              ? 'The entity is named in a certified metadata field that is not rendered as post text.'
              : 'The entity is named by the filename of an image attached to this drop.',
    certifiedCountChange: 'none — this is a ruling about the tooltip, not about the occurrence',
  })
}

// ── report ──────────────────────────────────────────────────────────────────
const byCat = rows.reduce((a, r) => (a[r.provenanceCategory] = (a[r.provenanceCategory] ?? 0) + 1, a), {})
const publicSubset = rows.filter(r => r.wasPublicInProduction)
const byCatPublic = publicSubset.reduce((a, r) => (a[r.provenanceCategory] = (a[r.provenanceCategory] ?? 0) + 1, a), {})
const occurrencesAtStake = rows.reduce((n, r) => n + r.certifiedOccurrencesInPost, 0)
const needsAdjudication = rows.filter(r => r.provenanceCategory !== 'nonvisual_metadata_provenance' && r.provenanceCategory !== 'image_provenance_confirmed')
const occurrencesNeedingAdjudication = needsAdjudication.reduce((n, r) => n + r.certifiedOccurrencesInPost, 0)
const substringDefect = rows.filter(r => r.evidence.aliasIsSubstringOfALongerWord)

const ORDER = ['image_provenance_confirmed', 'image_provenance_unconfirmed', 'nonvisual_metadata_provenance', 'no_supported_provenance', 'url_source_provenance']
console.log('\nNO VISIBLE TEXT ANCHOR — PROVENANCE\n')
console.log(`  records classified no_visible_text_anchor : ${rows.length}`)
if (prodPublicKeys) console.log(`    of those, public in production          : ${publicSubset.length}`)
console.log('')
for (const k of ORDER) {
  const all = byCat[k] ?? 0
  const pub = byCatPublic[k] ?? 0
  const flag = k === 'url_source_provenance' ? '   ← ruled a fifth category, 2026-08-17' : ''
  console.log(`    ${String(all).padStart(4)}  ${prodPublicKeys ? `(${String(pub).padStart(3)} public)  ` : ''}${k}${flag}`)
}
console.log(`\n  certified occurrences behind them : ${occurrencesAtStake}`)
console.log(`  needing provenance adjudication   : ${needsAdjudication.length} records / ${occurrencesNeedingAdjudication} occurrences`)
console.log(`  alias found inside a longer word  : ${substringDefect.length} records  (the extraction defect below the hover)`)
console.log(`  distinct entities involved        : ${new Set(rows.map(r => r.entityId)).size}`)
console.log(`  distinct posts involved           : ${new Set(rows.map(r => r.postNum)).size}`)

const topEntities = [...rows.reduce((m, r) => m.set(r.canonical, (m.get(r.canonical) ?? 0) + 1), new Map())]
  .sort((a, b) => b[1] - a[1]).slice(0, 10)
console.log(`\n  most affected entities:`)
for (const [c, n] of topEntities) console.log(`    ${String(n).padStart(4)}  ${c}`)

fs.writeFileSync(path.join(OUT, 'entity-provenance-review.json'), JSON.stringify({
  note: 'PRIVATE REVIEW QUEUE. Entity occurrences whose name appears nowhere in the rendered post. Their hovers are excluded from the public bundle as no_visible_text_anchor under the owner ruling of 2026-08-16. NO certified count changes here — this is a ruling about tooltips, not about occurrences.',
  ruling: 'A post-specific text hover may be public only when a visible textual anchor exists in the rendered post. An occurrence is not invalid merely because a tooltip cannot render over it.',
  coordinateSystem: 'runtimeText() — the text the browser paints. The same question asked of posts.json raw text condemns entities the reader can plainly see.',
  categories: {
    image_provenance_confirmed: 'The entity is demonstrably present in an attached image or certified image-derived data. Only a media filename can establish this today; the corpus carries no OCR, annotation or bounding-box data of any kind, and the script asserts their absence rather than assuming it.',
    image_provenance_unconfirmed: 'The drop carries an image, but nothing available establishes that the entity is in it.',
    nonvisual_metadata_provenance: 'The entity is named in a certified metadata field that is never rendered as post text.',
    no_supported_provenance: 'No visible text, no image, and no certified metadata supports the occurrence.',
    url_source_provenance: 'The entity is the publisher behind a link in the drop, but its name is not a token of the URL, so the URL classifier cannot see it and the visible-anchor rule cannot act on it. Needs its own ruling.',
  },
  categoryPriority: ['image_provenance_confirmed', 'nonvisual_metadata_provenance', 'url_source_provenance (hostname)', 'image_provenance_unconfirmed', 'url_source_provenance (path or query)', 'no_supported_provenance'],
  totals: {
    records: rows.length,
    publicInProduction: prodPublicKeys ? publicSubset.length : null,
    byCategory: byCat,
    byCategoryAmongProductionPublic: prodPublicKeys ? byCatPublic : null,
    imageProvenanceConfirmed: byCat.image_provenance_confirmed ?? 0,
    certifiedOccurrencesAtStake: occurrencesAtStake,
    recordsNeedingAdjudication: needsAdjudication.length,
    occurrencesNeedingAdjudication,
    substringExtractionSuspects: substringDefect.length,
    distinctEntities: new Set(rows.map(r => r.entityId)).size,
    distinctPosts: new Set(rows.map(r => r.postNum)).size,
  },
  certifiedUnchanged: { entityRows: entities.entities.length, mentions: entities.totals.mentions },
  rows,
}, null, 1))

console.log(`\n  wrote audit/entity-provenance-review.json`)
console.log(`  certified totals unchanged: ${entities.entities.length} rows / ${entities.totals.mentions} mentions\n`)
