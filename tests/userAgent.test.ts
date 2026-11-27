import { expect, it } from 'vitest'
import { chromeUserAgent } from '../src/main/userAgent'

it('builds a reduced Chrome UA without Electron', () => {
  const ua = chromeUserAgent('142.0.7444.59', 'linux')
  expect(ua).toBe(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
  )
  expect(chromeUserAgent('142.1', 'win32')).toContain('Windows NT 10.0')
  expect(ua).not.toMatch(/Electron/)
})
