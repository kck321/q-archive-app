import type { ReactEventHandler } from 'react'
import { MEDIA_CROP } from '../lib/mediaCrop'

// TRIM THE BAKED-IN BLACK BORDER — owner ruling, 2026-08-26.
//
// "there is alot of blank space in alot of the pictures... i just want the main portion of the
// picture showing." Confirmed on #1410: the black bars are pixels IN the source file (mostly
// phone screenshots of a photo viewer, letterboxed by the viewer itself), not a CSS artifact —
// so cropping means knowing, per attachment, exactly which pixels are real content.
//
// We don't own these files (qalerts mirrors almost all of them, with no CORS header, so a
// browser canvas can never read their pixels), so scripts/build-media-crop.mjs did the pixel
// read ONCE, offline, and recorded a crop rectangle for the 771 attachments that actually have
// one. This renders that rectangle with plain CSS — the SAME remote image still loads, sized and
// shifted so only the cropped region is visible and the container's own box is exactly that
// region's aspect ratio (no leftover dead space in the layout, not just visually hidden).
//
// The math (see the container/img styles below): an image scaled so its crop width fills the
// container, shifted by the crop's own top-left, expressed purely as percentages of the crop
// box itself — so it needs no knowledge of the container's actual rendered pixel size.
export function CroppedMedia({
  url, alt, className, imgClassName, loading = 'lazy', onError, onLoad,
}: {
  /** The loadable url — pass mediaUrl(m.url), already host-rewritten. MEDIA_CROP is keyed by
   *  this SAME resolved form, not the raw recorded url, since two posts can record one image
   *  two different ways (a source post's own entry vs. an already-rewritten quote of it). */
  url: string
  alt?: string
  /** Classes for the OUTER box — border/rounding/hover treatment belongs here now, not on the img. */
  className?: string
  imgClassName?: string
  loading?: 'lazy' | 'eager'
  onError?: ReactEventHandler<HTMLImageElement>
  onLoad?: ReactEventHandler<HTMLImageElement>
}) {
  const crop = MEDIA_CROP[url]

  // No recorded border for this attachment — render exactly as before. Most attachments (917 of
  // 1,688 scanned) take this path untouched.
  if (!crop) {
    return <img src={url} alt={alt} loading={loading} onError={onError} onLoad={onLoad}
      className={`${className ?? ''} ${imgClassName ?? ''}`} />
  }

  const widthPct = (crop.naturalWidth / crop.cropWidth) * 100
  const leftPct = -(crop.cropX / crop.cropWidth) * 100
  const topPct = -(crop.cropY / crop.cropHeight) * 100

  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', aspectRatio: `${crop.cropWidth} / ${crop.cropHeight}` }}>
      <img
        src={url}
        alt={alt}
        loading={loading}
        onError={onError}
        onLoad={onLoad}
        className={`block max-w-none ${imgClassName ?? ''}`}
        style={{ position: 'absolute', width: `${widthPct}%`, left: `${leftPct}%`, top: `${topPct}%` }}
      />
    </div>
  )
}
