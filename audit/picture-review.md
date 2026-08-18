# Picture review queue — images needing a manual pass

Images whose Picture chip shows **two red dots** (`needsReview: true` in
`public/data/picture-analysis.json`). The vision audit described each one and indexed its
key phrases, but the FULL verbatim text could not be machine-extracted: all three are giant
stitched compilations of hundreds of forum posts, and automated transcription of that
content at that volume is blocked by the AI provider's content policy. A human can
transcribe them freely; the notes below say exactly where to look.

| # | Post | Filename | Local file (media-bundle) | Size |
|---|------|----------|---------------------------|------|
| 3 | #101 | LATEST Q VERIFIED NOV6.png | `1509926281137.jpg` | 1600×2378 |
| 83 | #128 | 1510280445405.jpg | `1510107905656.jpg` | 4096×3518 |
| 98 | #132 | Q Graphic.png | `1510320845603.jpg` | 1600×1714 |

## What each contains (from the completed visual pass)

- **#101 (n3):** Six-column stitch of 4chan /pol/ threads, Oct 31 – Nov 5 2017. Opens with
  the "Bread Crumbs – Q Clearance Patriot" post (No.147433975, with the *Washington
  Crossing the Delaware* `Patriots.jpg` thumbnail) and the SCI[F]/Military Intelligence
  question series. Contains the two long "Q Clearance Patriot / My fellow Americans"
  letters, the Nov 1–2 drop runs (No.147547888 → No.147687684 range), the Alice &
  Wonderland / Snow White / Godfather III signature posts, the "THE STRONGEST WEAPON IN THE
  UNITED STATES IS A PATRIOTIC AMERICAN" poster, and a "ONE NATION UNDER GOD" graphic.
  Right-hand columns run into Nov 4–5 (SA/Las Vegas question drops, No.148031295 etc.).
- **#128 (n83):** Largest stitch (4096px wide), seven-plus columns covering the same
  late-Oct/early-Nov 2017 threads at higher capture width, with the AF1 cloud photos and
  the same posters embedded. Overlaps #101 heavily — transcribing #101 first will cover
  most of it; then diff.
- **#132 (n98):** "Q Graphic" — the community's cleaned November 2017 compilation.
  Contains the `Q !ITPb.qbhqo` tripcode era posts and the Spy.png / AF1 photo inserts.
  Substantial overlap with the archive's own ingested drops #1–#112.

## How to work on one

1. Re-tile the image into readable crops (any Python with Pillow):

   ```python
   from PIL import Image
   im = Image.open(r'media-bundle/<file>').convert('RGB')
   W, H = im.size; cols, rows, scale = 3, 3, 2.0   # 4x4 and 1.5 for the 4096px one
   tw, th = W//cols, H//rows
   for r in range(rows):
       for c in range(cols):
           box = (max(0,c*tw-30), max(0,r*th-30), min(W,(c+1)*tw+30), min(H,(r+1)*th+30))
           t = im.crop(box); t = t.resize((int(t.width*scale), int(t.height*scale)))
           t.save(f'tile_r{r}c{c}.png')
   ```

2. Transcribe what you want indexed (the Q-authored drops matter most — most already exist
   as archive posts #1–#112, so cross-referencing post numbers may beat retyping).
3. Paste the text into that image's `"text"` field in `public/data/picture-analysis.json`,
   set `"needsReview": false` (or delete the key), and the two red dots revert to one dot
   automatically. The new text becomes searchable immediately — no other step.

## Withheld analyses (private review records)

Entries whose automated analysis was withheld. The picture-analysis record carries
`confidence: red` + `needsReview: true` (two red dots) and `ocrStatus: "withheld"`.
No content details are recorded here; the owner reviews the image directly.

| Seq (n) | Post | Image ID (hash) | Filename | Source | Status | ocrStatus |
|---------|------|-----------------|----------|--------|--------|-----------|
| 308 | #1779 | `488babf81f742bb2262cb0976324aa1216a5f3b46b80c607c57fbdbdc4b9c685` | #1.png | referenced | review_required | withheld |

## Rule going forward

Any future image whose full extraction can't be completed (compilation too large, text
blocked, illegible scan) gets `needsReview: true` + a flag naming the reason, and a row in
this file. Two red dots on the chip = "the owner still needs to look at this one."
