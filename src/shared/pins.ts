/**
 * Pinned chats from all platforms in one list, grouped in colored categories (like Equicord's
 * PinDMs, but in PupChat). Categories are global: a category can hold chats from any platform.
 */

export interface PinCategory {
  id: string
  name: string
  /** #rrggbb */
  color: string
  collapsed: boolean
}

export interface Pin {
  id: string
  service: string
  /** The chat's address on the platform (validated against the platform's chat URL pattern). */
  url: string
  name: string
  /** Small avatar as a data: URL ('' = show an initial). */
  avatar: string
  /** Category id, or '' for "Pinned" (no category). */
  category: string
}

export interface Pins {
  categories: PinCategory[]
  items: Pin[]
}

export const CATEGORY_COLORS = [
  { color: '#91d7e3', name: 'Sky' },
  { color: '#f5bde6', name: 'Pink' },
  { color: '#c6a0f6', name: 'Mauve' },
  { color: '#ed8796', name: 'Red' },
  { color: '#f5a97f', name: 'Peach' },
  { color: '#eed49f', name: 'Yellow' },
  { color: '#a6da95', name: 'Green' },
  { color: '#8aadf4', name: 'Blue' },
  { color: '#cad3f5', name: 'White' }
] as const

const ID = /^[a-z0-9]{6,20}$/
const HEX = /^#[0-9a-f]{6}$/i
const AVATAR = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : ''

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

/**
 * Accepts anything (damaged file, IPC data) and returns valid pins. `isChatUrl(service, url)`
 * decides which addresses are real chats of that platform.
 */
export function validatePins(raw: unknown, isChatUrl: (service: string, url: string) => boolean): Pins {
  const o = isObj(raw) ? raw : {}
  const categories: PinCategory[] = []
  const seen = new Set<string>()
  for (const c of Array.isArray(o['categories']) ? o['categories'] : []) {
    // (Older files had a per-platform `service` on categories; it's simply ignored now.)
    if (!isObj(c) || typeof c['id'] !== 'string' || !ID.test(c['id']) || seen.has(c['id'])) continue
    seen.add(c['id'])
    categories.push({
      id: c['id'],
      name: text(c['name'], 40) || 'Pinned',
      color: typeof c['color'] === 'string' && HEX.test(c['color']) ? c['color'].toLowerCase() : CATEGORY_COLORS[0].color,
      collapsed: c['collapsed'] === true
    })
    if (categories.length >= 50) break
  }
  const items: Pin[] = []
  const seenItems = new Set<string>()
  for (const p of Array.isArray(o['items']) ? o['items'] : []) {
    if (!isObj(p) || typeof p['id'] !== 'string' || !ID.test(p['id']) || seenItems.has(p['id'])) continue
    const service = text(p['service'], 32)
    const url = typeof p['url'] === 'string' ? p['url'] : ''
    if (!service || !isChatUrl(service, url)) continue
    if (items.some((x) => x.service === service && x.url === url)) continue
    seenItems.add(p['id'])
    const cat = typeof p['category'] === 'string' ? p['category'] : ''
    items.push({
      id: p['id'],
      service,
      url,
      name: text(p['name'], 64) || 'Chat',
      avatar: typeof p['avatar'] === 'string' && p['avatar'].length < 80_000 && AVATAR.test(p['avatar']) ? p['avatar'] : '',
      category: categories.some((c) => c.id === cat) ? cat : ''
    })
    if (items.length >= 300) break
  }
  return { categories, items }
}

/** Words sites put in titles/headers that aren't anyone's name (English and Czech). */
export function isGenericName(x: string): boolean {
  return /^(chats?|inbox|direct|messages?|messenger|friends|přátelé|zprávy|zpráva|konverzace|doručená pošta)$/i.test(x.trim())
}

/** Chat name from the page title: "(2) Discord | @mia" -> "mia". '' if there's nothing useful. */
export function nameFromTitle(title: string, platform: string): string {
  const parts = title
    .replace(/^\(\d+\+?\)\s*/, '')
    .replace(/^[•●∙]\s*/, '')
    .split(/\s+[|•·–-]\s+/)
    .map((x) => x.trim().replace(/^@/, ''))
    .filter((x) => x && x.toLowerCase() !== platform.toLowerCase() && !isGenericName(x))
  return (parts[0] ?? '').slice(0, 64)
}


/** Move an item inside its own group by -1 / +1 (skipping items of other groups). */
export function moveWithin<T extends { id: string }>(list: T[], id: string, delta: -1 | 1, sameGroup: (a: T, b: T) => boolean): void {
  const i = list.findIndex((x) => x.id === id)
  if (i < 0) return
  const me = list[i]!
  let j = i + delta
  while (j >= 0 && j < list.length && !sameGroup(list[j]!, me)) j += delta
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
}
