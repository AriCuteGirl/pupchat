import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Everything PupChat remembers. Step 5 adds the rest of the settings here. */
export interface Settings {
  version: 1
  /** Panel width with the platform list shown, in px. */
  panelWidth: number
  /** Platform list collapsed to the icon rail. */
  collapsed: boolean
  /** Zoom per platform id (1 = 100 %). */
  zoom: Record<string, number>
}

export const LIMITS = {
  minWidth: 520,
  maxWidth: 1600,
  minZoom: 0.5,
  maxZoom: 1.5
} as const

export const DEFAULTS: Settings = { version: 1, panelWidth: 1000, collapsed: false, zoom: {} }

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Accepts anything (e.g. a hand-edited or damaged file) and returns valid settings. */
export function validate(raw: unknown): Settings {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const zoom: Record<string, number> = {}
  if (typeof o['zoom'] === 'object' && o['zoom'] !== null) {
    for (const [k, v] of Object.entries(o['zoom'] as Record<string, unknown>)) {
      if (/^[a-z0-9-]{1,32}$/.test(k) && isNum(v)) zoom[k] = clamp(v, LIMITS.minZoom, LIMITS.maxZoom)
    }
  }
  return {
    version: 1,
    panelWidth: isNum(o['panelWidth'])
      ? Math.round(clamp(o['panelWidth'], LIMITS.minWidth, LIMITS.maxWidth))
      : DEFAULTS.panelWidth,
    collapsed: typeof o['collapsed'] === 'boolean' ? o['collapsed'] : DEFAULTS.collapsed,
    zoom
  }
}

export function loadSettings(file: string): Settings {
  try {
    return validate(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return validate({})
  }
}

/** Write to a temp file and rename over the old one, so a crash never leaves half a file. */
export function saveSettings(file: string, s: Settings): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(validate(s), null, 2) + '\n', { mode: 0o600 })
  renameSync(tmp, file)
}

/** Debounced saver: many changes while dragging become one write. */
export function makeSaver(file: string, delayMs = 400): (s: Settings) => void {
  let timer: NodeJS.Timeout | null = null
  return (s) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => saveSettings(file, s), delayMs)
  }
}
