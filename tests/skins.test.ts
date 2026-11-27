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

it('every skin is well-formed CSS (balanced braces and parentheses)', () => {
  for (const s of SERVICES) {
    const css = skinCss(s.id)!
    expect((css.match(/\{/g) ?? []).length, s.id).toBe((css.match(/\}/g) ?? []).length)
    expect((css.match(/\(/g) ?? []).length, s.id).toBe((css.match(/\)/g) ?? []).length)
  }
})

it('chat glass strength is clamped and formatted', async () => {
  const { glassCss } = await import('../src/main/skins')
  expect(glassCss(0.55)).toBe('html { --pup-a: 0.55 !important; }')
  expect(glassCss(7)).toContain('--pup-a: 1.00')
  expect(glassCss(-1)).toContain('--pup-a: 0.00')
})

it('color stylesheet only accepts real colors', async () => {
  const { colorsCss } = await import('../src/main/skins')
  expect(colorsCss('#ff375f', '#3a3a3c', '#ffffff', '#ffffff', '255, 55, 95', '58, 58, 60')).toContain('--pup-out: #ff375f')
  expect(colorsCss('red;}*{display:none', '#3a3a3c', '#fff', '#fff', '1, 2, 3', '1, 2, 3')).toBe('')
})
