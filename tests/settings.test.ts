import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadSettings, saveSettings } from '../src/main/settings'
import { defaults, validate } from '../src/shared/settings'

const IDS = ['whatsapp', 'instagram', 'discord']

describe('validate', () => {
  it('fills defaults for empty or garbage input', () => {
    expect(validate({}, IDS)).toEqual(defaults(IDS))
    expect(validate(null, IDS)).toEqual(defaults(IDS))
    expect(validate('nope', IDS)).toEqual(defaults(IDS))
    expect(validate([1, 2], IDS)).toEqual(defaults(IDS))
  })
  it('clamps numbers and drops unknown zoom keys', () => {
    const s = validate({ panelWidth: 99999, collapsed: 'yes', glassOpacity: 3, zoom: { whatsapp: 0.1, '../x': 1, discord: 'big' } }, IDS)
    expect(s.panelWidth).toBe(1600)
    expect(s.collapsed).toBe(false)
    expect(s.glassOpacity).toBe(0.95)
    expect(s.zoom).toEqual({ whatsapp: 0.5 })
  })
  it('keeps a valid order, drops unknown/duplicate ids, appends new platforms', () => {
    expect(validate({ order: ['discord', 'evil', 'discord', 'whatsapp'] }, IDS).order).toEqual(['discord', 'whatsapp', 'instagram'])
  })
  it('reads per-platform prefs and never disables every platform', () => {
    const s = validate({ services: { whatsapp: { enabled: false, muted: true }, instagram: { enabled: false }, discord: { enabled: false } } }, IDS)
    expect(s.services['whatsapp']).toEqual({ enabled: true, notifications: true, muted: true, media: false, skin: false })
    expect(s.services['discord']!.enabled).toBe(false)
  })
  it('only accepts known sleep choices, sides and hotkeys', () => {
    expect(validate({ sleepAfterMinutes: 30 }, IDS).sleepAfterMinutes).toBe(30)
    expect(validate({ chatGlass: 5 }, IDS).chatGlass).toBe(1)
    expect(validate({ chatGlass: 0 }, IDS).chatGlass).toBe(0.1)
    expect(validate({ sleepAfterMinutes: 7 }, IDS).sleepAfterMinutes).toBe(0)
    expect(validate({ side: 'top' }, IDS).side).toBe('right')
    expect(validate({ side: 'left' }, IDS).side).toBe('left')
    expect(validate({ windowsHotkey: 'Ctrl+Alt+P' }, IDS).windowsHotkey).toBe('Ctrl+Alt+P')
    expect(validate({ windowsHotkey: 'rm -rf /' }, IDS).windowsHotkey).toBe('Ctrl+Shift+Space')
  })
})

describe('load/save', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pupchat-test-'))
  const file = join(dir, 'settings.json')

  it('round-trips and leaves no temp files', () => {
    const s = { ...defaults(IDS), panelWidth: 1100, zoom: { whatsapp: 0.9 } }
    saveSettings(file, s, IDS)
    expect(loadSettings(file, IDS)).toEqual(s)
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(1)
  })
  it('survives a damaged file', () => {
    writeFileSync(file, '{"panelWidth": 10')
    expect(loadSettings(file, IDS)).toEqual(defaults(IDS))
  })
  it('defaults when the file is missing', () => {
    expect(loadSettings(join(dir, 'missing.json'), IDS)).toEqual(defaults(IDS))
  })
})
