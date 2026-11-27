import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { validate, type Settings } from '../shared/settings'

export { LIMITS, type Settings } from '../shared/settings'

export function loadSettings(file: string, ids: readonly string[]): Settings {
  try {
    return validate(JSON.parse(readFileSync(file, 'utf8')), ids)
  } catch {
    return validate({}, ids)
  }
}

/** Write to a temp file and rename over the old one, so a crash never leaves half a file. */
export function saveSettings(file: string, s: Settings, ids: readonly string[]): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(validate(s, ids), null, 2) + '\n', { mode: 0o600 })
  renameSync(tmp, file)
}

/** Debounced saver: many changes (dragging, sliders) become one write. */
export function makeSaver(file: string, ids: readonly string[], delayMs = 400): (s: Settings) => void {
  let timer: NodeJS.Timeout | null = null
  return (s) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => saveSettings(file, s, ids), delayMs)
  }
}
