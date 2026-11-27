import { describe, expect, it } from 'vitest'
import { isExternalSafe, isServiceUrl } from '../src/main/navigation'
import { SERVICES } from '../src/shared/services'

const wa = SERVICES.find((s) => s.id === 'whatsapp')!

describe('isServiceUrl', () => {
  it('allows the service and its subdomains over https', () => {
    expect(isServiceUrl(wa, 'https://web.whatsapp.com/')).toBe(true)
    expect(isServiceUrl(wa, 'https://static.whatsapp.net/x.js')).toBe(true)
    expect(isServiceUrl(wa, 'https://whatsapp.com/')).toBe(true)
  })
  it('rejects other hosts, look-alikes and non-https', () => {
    expect(isServiceUrl(wa, 'https://example.com/')).toBe(false)
    expect(isServiceUrl(wa, 'https://evilwhatsapp.com/')).toBe(false)
    expect(isServiceUrl(wa, 'https://whatsapp.com.evil.io/')).toBe(false)
    expect(isServiceUrl(wa, 'http://web.whatsapp.com/')).toBe(false)
    expect(isServiceUrl(wa, 'not a url')).toBe(false)
  })
})

describe('isExternalSafe', () => {
  it('only lets http(s) out', () => {
    expect(isExternalSafe('https://example.com')).toBe(true)
    expect(isExternalSafe('http://example.com')).toBe(true)
    expect(isExternalSafe('file:///etc/passwd')).toBe(false)
    expect(isExternalSafe('javascript:alert(1)')).toBe(false)
    expect(isExternalSafe('smb://host/share')).toBe(false)
  })
})
