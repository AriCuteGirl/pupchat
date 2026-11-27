import { describe, expect, it } from 'vitest'
import { isCliCommand, parseCli } from '../src/main/cli'

describe('parseCli', () => {
  it('reads action flags and ignores foreign ones', () => {
    expect(parseCli(['/usr/bin/pupchat', '--toggle'])).toEqual({ action: 'toggle', service: null })
    expect(parseCli(['x', '--ozone-platform=wayland', '--hide'])).toEqual({
      action: 'hide',
      service: null
    })
    expect(parseCli(['x'])).toEqual({ action: null, service: null })
  })
  it('reads --quit and --settings', () => {
    expect(parseCli(['x', '--quit']).action).toBe('quit')
    expect(parseCli(['x', '--settings']).action).toBe('settings')
  })
  it('last action wins', () => {
    expect(parseCli(['x', '--show', '--hide']).action).toBe('hide')
  })
  it('service alone implies show and is validated', () => {
    expect(parseCli(['x', '--service=Discord'])).toEqual({ action: 'show', service: 'discord' })
    expect(parseCli(['x', '--toggle', '--service=whatsapp'])).toEqual({
      action: 'toggle',
      service: 'whatsapp'
    })
    expect(parseCli(['x', '--service=../../etc'])).toEqual({ action: null, service: null })
    expect(parseCli(['x', '--service='])).toEqual({ action: null, service: null })
  })
  it('does not treat single-dash or bare words as flags', () => {
    expect(parseCli(['x', 'toggle', '-show']).action).toBeNull()
  })
})

describe('isCliCommand', () => {
  it('accepts valid and rejects malformed data', () => {
    expect(isCliCommand({ action: 'show', service: null })).toBe(true)
    expect(isCliCommand({ action: 'nuke', service: null })).toBe(false)
    expect(isCliCommand({ action: null, service: 'a b' })).toBe(false)
    expect(isCliCommand(null)).toBe(false)
    expect(isCliCommand('toggle')).toBe(false)
  })
})
