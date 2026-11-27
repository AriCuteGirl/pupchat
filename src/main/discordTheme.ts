import { app, net } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromeUserAgent } from './userAgent'

/**
 * Discord themes (Equicord/Vencord/BetterDiscord style CSS) for PupChat's Discord.
 * Imported once: remote @imports are inlined and small images embedded, so the result works
 * inside Discord's security policy and needs no extra requests at runtime (except Google
 * Fonts, which Discord itself allows). Stored locally; applied as CSS only.
 */

export interface ThemeInfo {
  source: string
  importedAt: string
  bytes: number
}

const MAX_CSS = 3_000_000
const MAX_ASSET = 300_000
const UA = chromeUserAgent(process.versions.chrome, process.platform)

function themeDir(): string {
  return join(app.getPath('userData'), 'themes')
}
const cssFile = (): string => join(themeDir(), 'discord.css')
const infoFile = (): string => join(themeDir(), 'discord.json')

export function loadThemeCss(): string | null {
  try {
    return readFileSync(cssFile(), 'utf8')
  } catch {
    return null
  }
}

export function themeInfo(): ThemeInfo | null {
  try {
    return JSON.parse(readFileSync(infoFile(), 'utf8')) as ThemeInfo
  } catch {
    return null
  }
}

async function get(url: string, kind: 'text' | 'bytes'): Promise<string | Buffer | null> {
  if (!/^https:\/\//i.test(url)) return null
  try {
    const res = await net.fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > (kind === 'text' ? MAX_CSS : MAX_ASSET)) return null
    return kind === 'text' ? buf.toString('utf8') : buf
  } catch {
    return null
  }
}

const MIME: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
}

/** Inline https @imports (3 levels) and embed small https images as data: URLs. */
export async function inlineCss(css: string, depth = 0): Promise<string> {
  // @import url('x') / @import "x"
  const importRe = /@import\s+(?:url\(\s*)?['"]?(https:\/\/[^'")\s]+)['"]?\s*\)?[^;]*;/gi
  let out = ''
  let last = 0
  for (const m of css.matchAll(importRe)) {
    out += css.slice(last, m.index)
    last = (m.index ?? 0) + m[0].length
    const url = m[1]!
    const isGoogleFonts = /^https:\/\/fonts\.googleapis\.com\//i.test(url)
    const fetched = depth < 3 ? ((await get(url, 'text')) as string | null) : null
    if (fetched) out += `\n/* inlined: ${url} */\n` + (isGoogleFonts ? fetched : await inlineCss(fetched, depth + 1)) + '\n'
    else out += m[0] // keep as is; may not load inside Discord
  }
  out += css.slice(last)

  // url(https://...image) -> data: (small images only)
  const urlRe = /url\(\s*(['"]?)(https:\/\/[^'")\s]+\.(svg|png|jpe?g|gif|webp))(\?[^'")\s]*)?\1\s*\)/gi
  const seen = new Map<string, string | null>()
  for (const m of out.matchAll(urlRe)) {
    const url = m[2]! + (m[4] ?? '')
    if (seen.has(url)) continue
    const bytes = (await get(url, 'bytes')) as Buffer | null
    seen.set(url, bytes ? `url("data:${MIME[m[3]!.toLowerCase()]};base64,${bytes.toString('base64')}")` : null)
  }
  return out.replace(urlRe, (whole, _q, base: string, _ext, query?: string) => seen.get(base + (query ?? '')) ?? whole)
}

function save(css: string, source: string): ThemeInfo {
  mkdirSync(themeDir(), { recursive: true })
  const info: ThemeInfo = { source, importedAt: new Date().toISOString(), bytes: Buffer.byteLength(css) }
  writeFileSync(cssFile() + '.tmp', css)
  renameSync(cssFile() + '.tmp', cssFile())
  writeFileSync(infoFile(), JSON.stringify(info, null, 2))
  return info
}

/** Doesn't look like CSS (e.g. a plugin pasted into Quick CSS)? Then skip it. */
function looksLikeCss(text: string): boolean {
  return !/@cc_on|WScript|require\(|module\.exports|=>\s*{/.test(text.slice(0, 20000))
}

/** Read the themes enabled in Equicord (or Vencord/Vesktop) and import them. */
export async function importFromEquicord(): Promise<ThemeInfo> {
  const roots = ['Equicord', 'equicord', 'Vencord', 'vesktop'].map((d) => join(homedir(), '.config', d))
  const root = roots.find((r) => existsSync(join(r, 'settings', 'settings.json')))
  if (!root) throw new Error('No Equicord settings found in ~/.config/Equicord')
  const s = JSON.parse(readFileSync(join(root, 'settings', 'settings.json'), 'utf8')) as Record<string, unknown>
  const parts: string[] = []
  const names: string[] = []

  for (const link of Array.isArray(s['enabledThemeLinks']) ? s['enabledThemeLinks'] : []) {
    if (typeof link !== 'string') continue
    const css = (await get(link, 'text')) as string | null
    if (css && looksLikeCss(css)) {
      parts.push(`/* theme: ${link} */\n` + (await inlineCss(css)))
      names.push(link.split('/').pop()!.replace(/\.theme\.css$|\.css$/, ''))
    }
  }
  const local = Array.isArray(s['enabledThemes']) ? s['enabledThemes'] : []
  for (const file of local) {
    if (typeof file !== 'string' || file.includes('/') || file.includes('..')) continue
    const p = join(root, 'themes', file)
    if (!existsSync(p)) continue
    const css = readFileSync(p, 'utf8')
    if (looksLikeCss(css)) {
      parts.push(`/* theme: ${file} */\n` + (await inlineCss(css)))
      names.push(file.replace(/\.theme\.css$|\.css$/, ''))
    }
  }
  if (s['useQuickCss'] === true) {
    const qp = join(root, 'settings', 'quickCss.css')
    const q = existsSync(qp) ? readFileSync(qp, 'utf8') : ''
    if (q.trim() && looksLikeCss(q)) {
      parts.push('/* Quick CSS */\n' + (await inlineCss(q)))
      names.push('Quick CSS')
    }
  }
  if (!parts.length) throw new Error('No enabled Equicord themes found')
  return save(parts.join('\n\n'), `Equicord: ${names.join(', ')}`)
}
