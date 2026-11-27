/** Unread state derived from a page title only. The title itself is never stored or logged. */
export type Unread = number | 'dot'

/**
 * Reads the unread count web clients put in their title:
 *   "(3) WhatsApp", "(12+) Instagram", "Discord (5)", "• Discord | #general" (unread, no count).
 * Returns 0 when there is nothing unread.
 */
export function parseUnread(title: string): Unread {
  const t = title.trim()
  const lead = /^\((\d{1,4})\+?\)/.exec(t)
  if (lead) return Number(lead[1])
  const trail = /\((\d{1,4})\+?\)$/.exec(t)
  if (trail) return Number(trail[1])
  if (/^[•●∙]/.test(t)) return 'dot'
  return 0
}

/** Unread for a platform, honoring "ignore the bare dot" (Discord server activity). */
export function unreadFor(title: string, ignoreDot = false): Unread {
  const u = parseUnread(title)
  return ignoreDot && u === 'dot' ? 0 : u
}

/** Sum for the paw: dots count as one so you still see something is waiting. */
export function totalUnread(values: readonly Unread[]): number {
  return values.reduce<number>((sum, u) => sum + (u === 'dot' ? 1 : u), 0)
}

/** Short label for the UI: 3 → "3", 120 → "99+", "dot" → "". */
export function badgeLabel(u: Unread): string {
  if (u === 'dot') return ''
  return u > 99 ? '99+' : String(u)
}

/** How many new unread a change means: 0 when it didn't grow (a dot counts as 1). */
export function unreadGrowth(before: Unread, after: Unread): number {
  const n = (u: Unread): number => (u === 'dot' ? 1 : u)
  return Math.max(0, n(after) - n(before))
}
