import { expect, it } from 'vitest'
import { SERVICES } from '../src/shared/services'

// skins.ts has no Electron imports, so it can be tested directly.
const { skinCss } = await import('../src/main/skins')

it('has a skin for every platform', () => {
  for (const s of SERVICES) expect(skinCss(s.id), s.id).toBeTruthy()
  expect(skinCss('unknown')).toBeNull()
})

it('skins only set CSS variables: no remote loads, imports or selectors beyond *', () => {
  for (const s of SERVICES) {
    const css = skinCss(s.id)!
    expect(css, s.id).not.toMatch(/url\(|@import|<|javascript:|expression\(/i)
    const body = css.replace(/^\s*\*\s*\{/, '').replace(/\}\s*$/, '')
    for (const line of body.split(';').map((l) => l.trim()).filter(Boolean))
      expect(line, `${s.id}: ${line}`).toMatch(/^--[\w-]+:\s[^;{}]+!important$/)
  }
})
