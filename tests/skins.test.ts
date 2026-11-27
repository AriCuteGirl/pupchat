import { expect, it } from 'vitest'
import { SERVICES } from '../src/shared/services'

// skins.ts has no Electron imports, so it can be tested directly.
const { skinCss, interFontFace } = await import('../src/main/skins')

it('has a skin for every platform', () => {
  for (const s of SERVICES) expect(skinCss(s.id), s.id).toBeTruthy()
  expect(skinCss('unknown')).toBeNull()
})

it('skins never load anything remote or run anything', () => {
  for (const s of SERVICES) {
    const css = skinCss(s.id)!
    expect(css, s.id).not.toMatch(/url\(|@import|<|javascript:|expression\(|behavior:/i)
  }
})

it('the embedded font only uses data: URLs and local() fonts', () => {
  const face = interFontFace('AAAA', 'BBBB')
  const css = skinCss('whatsapp', face)!
  const urls = [...css.matchAll(/url\(([^)]*)\)/g)].map((m) => m[1])
  expect(urls).toEqual(['data:font/woff2;base64,BBBB', 'data:font/woff2;base64,AAAA'])
  expect(css).toContain('local("Inter")')
})
