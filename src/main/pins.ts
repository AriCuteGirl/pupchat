import { app, nativeImage, type WebContents } from 'electron'
import { readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { newId, validatePins, type Pin, type PinCategory, type Pins, CATEGORY_COLORS } from '../shared/pins'
export { moveWithin, nameFromTitle } from '../shared/pins'
import { isChatUrl } from '../shared/services'

const file = (): string => join(app.getPath('userData'), 'pins.json')

export function loadPins(): Pins {
  try {
    return validatePins(JSON.parse(readFileSync(file(), 'utf8')), isChatUrl)
  } catch {
    return { categories: [], items: [] }
  }
}

export function savePins(p: Pins): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(validatePins(p, isChatUrl), null, 1), { mode: 0o600 })
  renameSync(tmp, file())
}

/**
 * The open chat's avatar: the small square picture at the top of the chat area. Only that
 * one image address is read, once, when you pin. Runs in the page; returns '' if none.
 */
const FIND_HEADER_AVATAR = `(() => {
  const w = innerWidth
  const imgs = [...document.querySelectorAll('img')].filter((i) => {
    const r = i.getBoundingClientRect()
    const src = i.currentSrc || i.src
    return r.width >= 18 && r.width <= 72 && Math.abs(r.width - r.height) < 4 && r.top >= 0 && r.top < 150 &&
      r.left > w * 0.2 && /^https:/.test(src)
  })
  imgs.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || b.getBoundingClientRect().left - a.getBoundingClientRect().left)
  const i = imgs[0]
  return i ? (i.currentSrc || i.src) : ''
})()`

/**
 * Instagram in a narrow panel shows its chat list as a column of avatars only (no names in the
 * page). Newest chat first, so the top avatar is the person who just wrote. Returns its picture
 * address only, and only on Instagram's DM pages.
 */
export const FIND_TOP_CHAT_AVATAR = `(() => {
  if (!location.pathname.startsWith('/direct/')) return ''
  const imgs = [...document.querySelectorAll('img')].filter((i) => {
    const r = i.getBoundingClientRect()
    return r.width >= 40 && r.width <= 64 && Math.abs(r.width - r.height) < 4 && r.left < 120 && r.top > 40 && /^https:/.test(i.currentSrc || i.src)
  })
  imgs.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
  return imgs[0] ? (imgs[0].currentSrc || imgs[0].src) : ''
})()`

/** Grab and shrink an avatar to a 64 px PNG data URL (with the platform's own cookies). */
export async function grabAvatar(wc: WebContents, finder: string = FIND_HEADER_AVATAR): Promise<string> {
  try {
    const raw = (await wc.executeJavaScript(finder)) as unknown
    if (typeof raw !== 'string' || !/^https:\/\//.test(raw) || raw.length > 2000) return ''
    // Ask CDNs for a small version when they support a size parameter (Discord: ?size=64).
    const url = new URL(raw)
    if (url.searchParams.has('size')) url.searchParams.set('size', '64')
    const res = await wc.session.fetch(url.toString())
    if (!res.ok) return ''
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 3_000_000) return ''
    const img = nativeImage.createFromBuffer(buf)
    if (!img.isEmpty()) return img.resize({ width: 64, height: 64, quality: 'good' }).toDataURL()
    // The decoder can't read every format (Discord avatars are WebP): keep small images as they are.
    const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim()
    if (/^image\/(webp|png|jpeg)$/.test(type) && buf.length < 55_000) return `data:${type};base64,${buf.toString('base64')}`
    return ''
  } catch {
    return ''
  }
}

/**
 * Jump to a chat inside the already-open page, the way a link inside the site would
 * (history.pushState + popstate; hash change for Telegram). Falls back to loading the address.
 */
export async function goToChat(wc: WebContents, url: string): Promise<void> {
  const script = `(() => {
    const u = new URL(${JSON.stringify(url)})
    if (u.origin !== location.origin) return false
    if (u.hash && u.pathname === location.pathname && u.search === location.search) { location.hash = u.hash; return true }
    history.pushState(history.state, '', u.pathname + u.search + u.hash)
    dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
    return true
  })()`
  const target = new URL(url)
  const ok = await wc.executeJavaScript(script).catch(() => false)
  await new Promise((r) => setTimeout(r, 900))
  const now = new URL(wc.getURL())
  const arrived = now.pathname.replace(/\/$/, '') === target.pathname.replace(/\/$/, '') && now.hash === target.hash
  if (!ok || !arrived) await wc.loadURL(url).catch(() => {})
}

export function addCategory(p: Pins, service: string, name = 'New category'): PinCategory {
  const used = new Set(p.categories.filter((c) => c.service === service).map((c) => c.color))
  const color = CATEGORY_COLORS.find((c) => !used.has(c.color))?.color ?? CATEGORY_COLORS[0].color
  const c: PinCategory = { id: newId(), service, name, color, collapsed: false }
  p.categories.push(c)
  return c
}

export function addPin(p: Pins, pin: Omit<Pin, 'id'>): Pin {
  const item: Pin = { ...pin, id: newId() }
  p.items.push(item)
  return item
}

