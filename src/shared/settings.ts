/** Everything PupChat remembers. Validation is pure so main, UI and tests share it. */

/** Bubble colors, as #rrggbb. */
export interface BubbleColors {
  out: string
  in: string
}

export const DEFAULT_COLORS: BubbleColors = { out: '#0a84ff', in: '#3a3a3c' }

export interface ServicePrefs {
  /** Shown in the list and loaded. */
  enabled: boolean
  /** Show PupChat banners for this platform's notifications. */
  notifications: boolean
  /** Mute this platform's sounds. */
  muted: boolean
  /** Allow microphone and camera (calls, voice messages). Off by default. */
  media: boolean
  /** Optional iMessage look (CSS only). Off by default. */
  skin: boolean
  /** This platform's own bubble colors; null = use the global ones. */
  colors: BubbleColors | null
  /** Discord: use the imported Equicord theme instead of the iMessage look. */
  theme: boolean
}

export interface Settings {
  version: 1
  /** Panel width with the platform list shown, in px. */
  panelWidth: number
  /** Platform list collapsed to the icon rail. */
  collapsed: boolean
  /** Zoom per platform id (1 = 100 %). */
  zoom: Record<string, number>
  /** Platform ids in list order. */
  order: string[]
  services: Record<string, ServicePrefs>
  /** Screen edge the panel docks to. */
  side: 'right' | 'left'
  /** How solid the glass is: 0.15 (very see-through) to 0.95 (almost solid). */
  glassOpacity: number
  /** With the iMessage look: how solid the chats' black tint is, 0.1 (clear) to 1 (solid). */
  chatGlass: number
  /** With the iMessage look: bubble colors for all platforms (each can override). */
  colors: BubbleColors
  /** Hide the panel when you click into another window. */
  hideOnBlur: boolean
  /** Minutes before an unused platform sleeps to save RAM; 0 = never. */
  sleepAfterMinutes: number
  /** Silence banners and platform sounds while the panel is hidden; badges keep working. */
  gameMode: boolean
  /** Start PupChat (hidden) when you log in. */
  launchAtLogin: boolean
  /** Global show/hide shortcut on Windows (Electron accelerator). */
  windowsHotkey: string
}

export const LIMITS = {
  minWidth: 520,
  maxWidth: 1600,
  minZoom: 0.5,
  maxZoom: 1.5,
  minGlass: 0.15,
  maxGlass: 0.95,
  minChatGlass: 0.1,
  maxChatGlass: 1
} as const

export const SLEEP_CHOICES = [0, 10, 30, 60, 120] as const

export const DEFAULT_SERVICE_PREFS: ServicePrefs = {
  enabled: true,
  notifications: true,
  muted: false,
  media: false,
  skin: false,
  colors: null,
  theme: false
}

export function defaults(ids: readonly string[]): Settings {
  return {
    version: 1,
    panelWidth: 1000,
    collapsed: false,
    zoom: {},
    order: [...ids],
    services: Object.fromEntries(ids.map((id) => [id, { ...DEFAULT_SERVICE_PREFS }])),
    side: 'right',
    glassOpacity: 0.38,
    chatGlass: 0.55,
    colors: { ...DEFAULT_COLORS },
    hideOnBlur: false,
    sleepAfterMinutes: 0,
    gameMode: false,
    launchAtLogin: false,
    windowsHotkey: 'Ctrl+Shift+Space'
  }
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
const HEX = /^#[0-9a-f]{6}$/i
const hex = (v: unknown, d: string): string => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d)
function colorsOf(v: unknown, d: BubbleColors): BubbleColors {
  const o = isObj(v) ? v : {}
  return { out: hex(o['out'], d.out), in: hex(o['in'], d.in) }
}
/** Electron accelerator: modifiers and one key, e.g. "Ctrl+Shift+Space". */
const HOTKEY = /^((Ctrl|Control|Alt|Shift|Super|Meta|CommandOrControl|CmdOrCtrl)\+){1,3}[A-Za-z0-9]{1,9}$/

/**
 * Accepts anything (a hand-edited or damaged file, data from the UI) and returns valid
 * settings for the known platform ids. Unknown keys and ids are dropped, numbers clamped.
 */
export function validate(raw: unknown, ids: readonly string[]): Settings {
  const d = defaults(ids)
  const o = isObj(raw) ? raw : {}
  const known = new Set(ids)

  const zoom: Record<string, number> = {}
  if (isObj(o['zoom']))
    for (const [k, v] of Object.entries(o['zoom'])) if (known.has(k) && isNum(v)) zoom[k] = clamp(v, LIMITS.minZoom, LIMITS.maxZoom)

  // Order: known ids once each, in the saved order; new platforms appended.
  const saved = Array.isArray(o['order']) ? o['order'].filter((x): x is string => typeof x === 'string') : []
  const order = [...new Set(saved.filter((x) => known.has(x)))]
  for (const id of ids) if (!order.includes(id)) order.push(id)

  const services: Record<string, ServicePrefs> = {}
  const rawServices = isObj(o['services']) ? o['services'] : {}
  for (const id of ids) {
    const r = isObj(rawServices[id]) ? rawServices[id] : {}
    services[id] = {
      enabled: bool(r['enabled'], true),
      notifications: bool(r['notifications'], true),
      muted: bool(r['muted'], false),
      media: bool(r['media'], false),
      skin: bool(r['skin'], false),
      colors: isObj(r['colors']) ? colorsOf(r['colors'], DEFAULT_COLORS) : null,
      theme: bool(r['theme'], false)
    }
  }
  // At least one platform stays enabled, or the panel would be empty.
  if (ids.length && !ids.some((id) => services[id]!.enabled)) services[order[0]!]!.enabled = true

  const sleep = isNum(o['sleepAfterMinutes']) ? o['sleepAfterMinutes'] : d.sleepAfterMinutes
  return {
    version: 1,
    panelWidth: isNum(o['panelWidth']) ? Math.round(clamp(o['panelWidth'], LIMITS.minWidth, LIMITS.maxWidth)) : d.panelWidth,
    collapsed: bool(o['collapsed'], d.collapsed),
    zoom,
    order,
    services,
    side: o['side'] === 'left' ? 'left' : 'right',
    glassOpacity: isNum(o['glassOpacity'])
      ? Math.round(clamp(o['glassOpacity'], LIMITS.minGlass, LIMITS.maxGlass) * 100) / 100
      : d.glassOpacity,
    chatGlass: isNum(o['chatGlass'])
      ? Math.round(clamp(o['chatGlass'], LIMITS.minChatGlass, LIMITS.maxChatGlass) * 100) / 100
      : d.chatGlass,
    colors: colorsOf(o['colors'], DEFAULT_COLORS),
    hideOnBlur: bool(o['hideOnBlur'], d.hideOnBlur),
    sleepAfterMinutes: (SLEEP_CHOICES as readonly number[]).includes(sleep) ? sleep : d.sleepAfterMinutes,
    gameMode: bool(o['gameMode'], d.gameMode),
    launchAtLogin: bool(o['launchAtLogin'], d.launchAtLogin),
    windowsHotkey:
      typeof o['windowsHotkey'] === 'string' && HOTKEY.test(o['windowsHotkey']) ? o['windowsHotkey'] : d.windowsHotkey
  }
}

/**
 * Text color for a bubble color. Like iMessage: white on saturated colors (blue, green,
 * orange, pink), black only on really light ones (yellow, white), by relative luminance.
 */
export function textOn(bg: string): '#000000' | '#ffffff' {
  const n = parseInt(bg.slice(1), 16)
  const lin = (c: number): number => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return L > 0.5 ? '#000000' : '#ffffff'
}

/** "#0a84ff" -> "10, 132, 255" */
export function rgbTriple(hexColor: string): string {
  const n = parseInt(hexColor.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

/** Colors in effect for a platform. */
export function colorsFor(s: Settings, id: string): BubbleColors {
  return s.services[id]?.colors ?? s.colors
}
