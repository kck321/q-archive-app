/**
 * How long ago a drop was posted: "7y, 11m, 2d, 4h ago".
 *
 * Calendar-aware rather than fixed-length months — stepping the year and month first means
 * "11m" really is eleven calendar months, not eleven lots of 30 days, which drifts by days
 * over the seven-plus years this archive spans.
 */
export function timeAgo(timestamp: number, now: number = Date.now()): string {
  const then = new Date(timestamp * 1000)
  const nowD = new Date(now)
  if (Number.isNaN(then.getTime()) || then > nowD) return ''

  let years = nowD.getFullYear() - then.getFullYear()
  let months = nowD.getMonth() - then.getMonth()
  let days = nowD.getDate() - then.getDate()
  let hours = nowD.getHours() - then.getHours()

  if (hours < 0) { hours += 24; days -= 1 }
  if (days < 0) {
    // Days in the month before the current one — the month we are borrowing from.
    months -= 1
    days += new Date(nowD.getFullYear(), nowD.getMonth(), 0).getDate()
  }
  if (months < 0) { months += 12; years -= 1 }

  const parts: string[] = []
  if (years) parts.push(`${years}y`)
  if (months) parts.push(`${months}m`)
  if (days) parts.push(`${days}d`)
  // Hours are shown even at zero when nothing bigger exists, so a fresh post is not blank.
  if (hours || parts.length === 0) parts.push(`${hours}h`)

  return `${parts.join(', ')} ago`
}
