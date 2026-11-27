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
  const looksLikeAvatar = (src) => /\\/avatars\\/|profile|scontent|\\/avatar|userpic|\\/u\\//i.test(src)
  const imgs = [...document.querySelectorAll('img')].filter((i) => {
    const r = i.getBoundingClientRect()
    const src = i.currentSrc || i.src
    if (!/^https:/.test(src)) return false
    // The site's own interface icons (same domain as the page) are never someone's avatar.
    try { if (new URL(src).host === location.host) return false } catch { return false }
    return r.width >= 18 && r.width <= 72 && Math.abs(r.width - r.height) < 4 && r.top >= 0 && r.top < 150 && r.left > w * 0.2
  })
  imgs.sort((a, b) => {
    const pa = looksLikeAvatar(a.currentSrc || a.src) ? 0 : 1
    const pb = looksLikeAvatar(b.currentSrc || b.src) ? 0 : 1
    return pa - pb || a.getBoundingClientRect().top - b.getBoundingClientRect().top
  })
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

/**
 * The open chat's header: its heading (the person's or group's name) and the avatar next to it.
 * Read once, when you pin or refresh a pin. Pictures only this page can open (blob:) are
 * turned into an embedded image here.
 */
const READ_CHAT_HEADER = `(async () => {
  const w = innerWidth
  const heads = [...document.querySelectorAll('h1, h2, h3, [role="heading"]')].filter((h) => {
    const r = h.getBoundingClientRect()
    return r.top >= 0 && r.top < 90 && r.left > w * 0.12 && r.width > 0 && (h.innerText || '').trim()
  })
  heads.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
  const h = heads[0]
  if (!h) return null
  const name = h.innerText.split('\\n')[0].trim().slice(0, 64)
  let img = null
  for (let e = h, k = 0; k < 6 && e && !img; k++, e = e.parentElement)
    img = [...e.querySelectorAll('img')].find((i) => {
      const r = i.getBoundingClientRect()
      return r.width >= 18 && r.width <= 72 && Math.abs(r.width - r.height) < 4
    }) || null
  let avatar = img ? img.currentSrc || img.src : ''
  if (avatar.startsWith('blob:')) {
    try {
      const b = await (await fetch(avatar)).blob()
      avatar = b.size < 200000 ? await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => res(''); fr.readAsDataURL(b) }) : ''
    } catch { avatar = '' }
  }
  return { name, avatar }
})()`

/** Shrink a picture (https via the platform's session, or data:) to a 64 px data URL. */
async function pictureToDataUrl(wc: WebContents, src: string): Promise<string> {
  let buf: Buffer
  let type = ''
  if (src.startsWith('data:image/')) {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(src)
    if (!m) return ''
    type = m[1]!
    buf = Buffer.from(m[2]!, 'base64')
  } else if (/^https:\/\//.test(src) && src.length < 2000) {
    const url = new URL(src)
    if (url.searchParams.has('size')) url.searchParams.set('size', '64')
    const res = await wc.session.fetch(url.toString())
    if (!res.ok) return ''
    buf = Buffer.from(await res.arrayBuffer())
    type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim()
  } else return ''
  if (buf.length > 3_000_000) return ''
  const img = nativeImage.createFromBuffer(buf)
  if (!img.isEmpty()) return img.resize({ width: 64, height: 64, quality: 'good' }).toDataURL()
  if (/^image\/(webp|png|jpeg)$/.test(type) && buf.length < 55_000) return `data:${type};base64,${buf.toString('base64')}`
  return ''
}

/** Name and avatar of the open chat, from its header (falls back to the old avatar finder). */
export async function grabChatHeader(wc: WebContents): Promise<{ name: string; avatar: string }> {
  try {
    // Sites draw the chat header a moment after switching chats: wait for it (≈ 5 s max).
    let r: { name?: unknown; avatar?: unknown } | null = null
    for (let i = 0; i < 10; i++) {
      r = (await wc.executeJavaScript(READ_CHAT_HEADER)) as { name?: unknown; avatar?: unknown } | null
      if (r && typeof r.name === 'string' && r.name && typeof r.avatar === 'string' && r.avatar) break
      await new Promise((res) => setTimeout(res, 500))
    }
    const name = typeof r?.name === 'string' ? r.name : ''
    const src = typeof r?.avatar === 'string' ? r.avatar : ''
    const avatar = src ? await pictureToDataUrl(wc, src) : ''
    return { name, avatar: avatar || (await grabAvatar(wc)) }
  } catch {
    return { name: '', avatar: await grabAvatar(wc) }
  }
}

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

export function addCategory(p: Pins, name = 'New category'): PinCategory {
  const used = new Set(p.categories.map((c) => c.color))
  const color = CATEGORY_COLORS.find((c) => !used.has(c.color))?.color ?? CATEGORY_COLORS[0].color
  const c: PinCategory = { id: newId(), name, color, collapsed: false }
  p.categories.push(c)
  return c
}

export function addPin(p: Pins, pin: Omit<Pin, 'id'>): Pin {
  const item: Pin = { ...pin, id: newId() }
  p.items.push(item)
  return item
}

