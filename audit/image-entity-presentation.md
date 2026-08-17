# "Entities shown in this image" — the design, and why it does not ship yet

**Ruled** 2026-08-16. **Status: designed, not built.** There are zero records to show.

## The ruling this implements

> If an entity is demonstrably present in an image, preserve its certified mention and eventually
> present it under "Entities shown in this image."

That is the right destination for an occurrence whose evidence is visual: the mention is real, the
tooltip cannot render because there is no word on screen, and the honest presentation is one that
says *the image contains this*, next to the image.

## Why it is not built today

`audit/entity-provenance-review.json` classifies all 402 no-anchor records. **`image_provenance_confirmed`
is 0.** Not "none found yet" — nothing in the archive is capable of confirming it:

| what would confirm an image entity | present in the corpus |
|---|---|
| OCR text | no |
| image captions or alt text | no |
| annotations / detected entities | no |
| bounding boxes | no |
| a filename naming the entity | checked across all 402 — **0 matches** |

A media record holds exactly two fields, `filename` and `url`. 55 of the 402 drops carry an image;
none of them carries anything that establishes what is *in* it.

So building the surface now would ship a component that can never render, and — worse — would
invite the first plausible-looking record to be promoted into it just to give the feature something
to display. `scripts/audit-invisible-hover-provenance.mjs` **asserts the absence of those fields and
exits non-zero if one ever appears**, so this stays a deliberate gap rather than a forgotten one.

## The design, for when there is data

### Data

A new certified artifact, `public/data/image-entities.json`, written by an adjudication pass — never
by a detector running unattended:

```jsonc
{
  "certified": true,
  "note": "Entities established as present in an image attached to a drop. Adjudicated, never inferred.",
  "byPost": {
    "1234": [{
      "entityId": "qe-…",            // the permanent id — unchanged, never re-minted
      "displayName": "…",
      "filename": "…",               // WHICH image, when a drop carries several
      "synopsis": "…",               // the certified post-specific synopsis, reused verbatim
      "grade": "Strong|Partial",     // travels to the reader, as text hovers already do
      "basis": "ocr|annotation|owner adjudication",
      "box": { "x": 0.31, "y": 0.42, "w": 0.18, "h": 0.06 }  // OPTIONAL, fractional
    }]
  }
}
```

### Presentation

A labelled region **immediately below the image it describes** — `<section aria-labelledby>` with the
heading *Entities shown in this image* and a `<ul>`, exactly the pattern `LinkedSources.tsx` already
uses. Not a tooltip: a tooltip needs a word to attach to, and the absence of that word is the entire
reason this record exists.

Each row states, in this order:

1. the entity name (linking to its Analysis row),
2. **"detected in the image"** — never phrasing that implies Q wrote it,
3. the synopsis, prefixed so the reader knows what it explains: *"Referenced in the image attached
   to this drop: …"*,
4. its support grade, with the same wording and colours text hovers use.

### Coordinates

- **With reliable boxes** — an accessible image annotation: the image is wrapped, each entity gets a
  focusable overlay with an `aria-label`, and the list below stays as the non-visual equivalent.
  The list is never replaced by the overlay; it is the accessible path.
- **Without boxes** — the list alone, associated with the image by `aria-describedby`. **No invented
  coordinates.** A box in the wrong place is a false claim about a photograph, and it is not a
  smaller error than a wrong tooltip.

### What must never happen

- **No fabricated text anchor.** The drop's text is not rewritten, and no invisible span is injected
  to give a tooltip somewhere to land.
- **No count movement.** These occurrences are already certified and counted. This is a presentation
  for mentions that exist, not a new source of them.
- **No inference from an image's mere presence.** "This drop has a picture and the entity is
  unexplained, therefore it is in the picture" is the reasoning `image_provenance_unconfirmed`
  exists to refuse.

### The invariants it arrives with

- every row resolves to a live entity id
- every row names an image that exists on its drop
- the artifact is empty unless a source capable of confirming it exists (the assertion above)
- no row is also published as a text hover for the same (entity, post) — one occurrence, one
  presentation
- boxes, where present, are fractional and inside `[0,1]`

## Until then

All 55 `image_provenance_unconfirmed` records sit in `audit/entity-provenance-review.json`, private,
with their certified mention intact, their `qe-` id intact and their synopsis intact — waiting for
adjudication rather than being guessed at in either direction.
