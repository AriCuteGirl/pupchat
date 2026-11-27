import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULTS, loadSettings, saveSettings, validate } from '../src/main/settings'

describe('validate', () => {
  it('fills defaults for empty or garbage input', () => {
    expect(validate({})).toEqual(DEFAULTS)
    expect(validate(null)).toEqual(DEFAULTS)
    expect(validate('nope')).toEqual(DEFAULTS)
  })
  it('clamps numbers and drops bad zoom keys', () => {
    const s = validate({ panelWidth: 99999, collapsed: 'yes', zoom: { whatsapp: 0.1, '../x': 1, discord: 'big' } })
    expect(s.panelWidth).toBe(1600)
    expect(s.collapsed).toBe(false)
    expect(s.zoom).toEqual({ whatsapp: 0.5 })
  })
})

describe('load/save', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pupchat-test-'))
  const file = join(dir, 'settings.json')

  it('round-trips and leaves no temp files', () => {
    saveSettings(file, { ...DEFAULTS, panelWidth: 1000, zoom: { whatsapp: 0.9 } })
    expect(loadSettings(file)).toEqual({ ...DEFAULTS, panelWidth: 1000, zoom: { whatsapp: 0.9 } })
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(1)
  })
  it('survives a damaged file', () => {
    writeFileSync(file, '{"panelWidth": 10')
    expect(loadSettings(file)).toEqual(DEFAULTS)
  })
  it('defaults when the file is missing', () => {
    expect(loadSettings(join(dir, 'missing.json'))).toEqual(DEFAULTS)
  })
})
