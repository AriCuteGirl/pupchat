import { ipcMain, Menu, type BrowserWindow, type WebContentsView } from 'electron'
import { CH, type ServiceStatus, type ShellState } from '../shared/ipc'
import { LAYOUT, viewBounds } from '../shared/layout'
import { isChatUrl, SERVICES, type ServiceDef } from '../shared/services'
import { CATEGORY_COLORS, type Pins } from '../shared/pins'
import { addCategory, addPin, goToChat, grabAvatar, loadPins, moveWithin, nameFromTitle, savePins } from './pins'
import { colorsFor, LIMITS, rgbTriple, textOn, validate, type Settings } from '../shared/settings'
import { unreadFor, unreadGrowth, type Unread } from './badge'
import { closePageGracefully } from './closePage'
import { importFromEquicord, loadThemeCss, themeInfo } from './discordTheme'
import { colorsCss, EMBEDDED_FONT_OK, glassCss, interFontFace, skinCss } from './skins'
import { readFileSync } from 'node:fs'
import { resourcePath } from './tray'
import { createServiceView } from './serviceView'
import { servicesToSleep } from './sleep'

interface Slot {
  /** The page's current address (for pinning the open chat). */
  url: string
  /** The page's current title (only used to prefill a pin's name). */
  title: string
  /** insertCSS key of the iMessage look, when applied to the current page. */
  skinKey: string | null
  /** insertCSS key of the chat glass strength, and the value it was made for. */
  glassKey: string | null
  glassFor: number
  /** insertCSS key of the bubble colors, and the CSS it was made from. */
  colorsKey: string | null
  colorsFor: string
  /** insertCSS key of an imported theme (Discord), and the theme text version applied. */
  themeKey: string | null
  themeFor: number
  def: ServiceDef
  view: WebContentsView | null
  status: ServiceStatus
  unread: Unread
  needsLogin: boolean
  lastUsed: number
  retryTimer: NodeJS.Timeout | null
}

/** Inter embedded for the iMessage look (read once, only when first needed). */
let fontFaceCache: string | null = null
function fontFace(): string {
  if (fontFaceCache !== null) return fontFaceCache
  try {
    const b64 = (f: string): string => readFileSync(resourcePath('fonts', f)).toString('base64')
    fontFaceCache = interFontFace(b64('inter-latin-wght-normal.woff2'), b64('inter-latin-ext-wght-normal.woff2'))
  } catch (e) {
    console.warn('[pupchat] Inter font not found:', e)
    fontFaceCache = ''
  }
  return fontFaceCache
}

/** Chromium net errors that mean "no connection", not "the site is broken". */
const OFFLINE_CODES = new Set([-106, -105, -109, -118, -130, -137, -21])
const OFFLINE_RETRY_MS = 15_000
export const SERVICE_IDS = SERVICES.map((s) => s.id)

/** Owns the service views inside the panel window and the state the shell UI renders. */
export class Shell {
  private slots = new Map<string, Slot>()
  private active: string
  private settingsOpen = false
  private hotkeyProblem = false
  private pins: Pins = loadPins()
  /** Bumped on every theme import, so pages re-apply the new CSS. */
  private themeVersion = 0
  private themeText: string | null = loadThemeCss()
  private listeners: Array<(s: ShellState) => void> = []
  private settingsListeners: Array<(s: Settings, prev: Settings) => void> = []
  private growthListeners: Array<(id: string, name: string, added: number, total: Unread) => void> = []
  isPanelVisible: () => boolean = () => true

  constructor(
    private readonly win: BrowserWindow,
    private readonly settings: Settings,
    private readonly save: (s: Settings) => void
  ) {
    for (const def of SERVICES)
      this.slots.set(def.id, {
        def,
        view: null,
        status: 'idle',
        unread: 0,
        needsLogin: false,
        lastUsed: 0,
        retryTimer: null,
        url: '',
        title: '',
        skinKey: null,
        glassKey: null,
        glassFor: -1,
        colorsKey: null,
        colorsFor: '',
        themeKey: null,
        themeFor: -1
      })
    this.active = this.listed()[0]!.def.id
    win.on('resize', () => this.layout())
    this.registerIpc()
    this.select(this.active)
    setInterval(() => this.tick(), 60_000).unref()
  }

  /** Enabled platforms in your order. */
  private listed(): Slot[] {
    return this.settings.order
      .filter((id) => this.settings.services[id]?.enabled)
      .flatMap((id) => {
        const s = this.slots.get(id)
        return s ? [s] : []
      })
  }

  get isCollapsed(): boolean {
    return this.settings.collapsed
  }

  get panelWidth(): number {
    return this.settings.panelWidth
  }

  get current(): Settings {
    return this.settings
  }

  activeView(): WebContentsView | null {
    return this.slots.get(this.active)?.view ?? null
  }

  activeId(): string {
    return this.active
  }

  /** A platform's page, if it's loaded. */
  pageOf(id: string): Electron.WebContents | null {
    return this.slots.get(id)?.view?.webContents ?? null
  }

  get isSettingsOpen(): boolean {
    return this.settingsOpen
  }

  /** Which platform a page belongs to (for notifications coming from it). */
  serviceOf(wc: Electron.WebContents): { id: string; name: string } | null {
    for (const s of this.slots.values()) if (s.view?.webContents === wc) return { id: s.def.id, name: s.def.name }
    return null
  }

  onState(fn: (s: ShellState) => void): void {
    this.listeners.push(fn)
  }

  /** A platform's unread count went up (from its page title). */
  onUnreadGrowth(fn: (id: string, name: string, added: number, total: Unread) => void): void {
    this.growthListeners.push(fn)
  }

  /** Called after settings change, with the previous values. */
  onSettings(fn: (s: Settings, prev: Settings) => void): void {
    this.settingsListeners.push(fn)
  }

  state(): ShellState {
    return {
      services: this.listed().map((s) => ({
        id: s.def.id,
        name: s.def.name,
        status: s.status,
        unread: s.unread,
        needsLogin: s.needsLogin
      })),
      active: this.active,
      collapsed: this.settings.collapsed,
      panelWidth: this.settings.panelWidth,
      activeZoom: this.zoomOf(this.active),
      settings: structuredClone(this.settings),
      settingsOpen: this.settingsOpen,
      platform: process.platform,
      hotkeyProblem: this.hotkeyProblem,
      pins: this.pins,
      current: this.currentChat(),
      pinPlatforms: SERVICES.filter((x) => x.chatUrl).map((x) => x.id),
      discordTheme: themeInfo()
    }
  }

  private emit(): void {
    const s = this.state()
    if (!this.win.isDestroyed()) this.win.webContents.send(CH.state, s)
    for (const fn of this.listeners) fn(s)
  }

  select(id: string): void {
    const slot = this.slots.get(id)
    if (!slot || !this.settings.services[id]?.enabled) return
    this.active = id
    this.settingsOpen = false
    slot.lastUsed = Date.now()
    if (!slot.view) this.load(slot) // lazy: loads the first time you open it, or wakes it up
    this.syncVisibility()
    this.layout()
    this.emit()
    slot.view?.webContents.focus()
  }

  /** Ctrl+1..9: the n-th platform in the list. */
  selectIndex(n: number): void {
    const s = this.listed()[n]
    if (s) this.select(s.def.id)
  }

  setCollapsed(c: boolean): void {
    this.updateSettings({ collapsed: c })
  }

  setPanelWidth(px: number): void {
    this.updateSettings({ panelWidth: Math.round(Math.min(LIMITS.maxWidth, Math.max(LIMITS.minWidth, px))) })
  }

  /** The global shortcut couldn't be registered (another app holds it). */
  setHotkeyProblem(problem: boolean): void {
    if (problem === this.hotkeyProblem) return
    this.hotkeyProblem = problem
    this.emit()
  }

  setSettingsOpen(open: boolean): void {
    if (open === this.settingsOpen) return
    this.settingsOpen = open
    this.syncVisibility()
    this.emit()
    if (!open) this.activeView()?.webContents.focus()
  }

  /** Validate, store and apply a settings change. */
  updateSettings(patch: Partial<Settings>): void {
    const prev = structuredClone(this.settings)
    const next = validate({ ...this.settings, ...patch }, SERVICE_IDS)
    if (JSON.stringify(next) === JSON.stringify(prev)) return
    Object.assign(this.settings, next)
    this.save(this.settings)

    // Platforms switched off: close their pages properly; move away if it was the open one.
    for (const id of SERVICE_IDS) {
      const slot = this.slots.get(id)!
      if (prev.services[id]?.enabled && !next.services[id]?.enabled) this.unload(slot, 'idle')
    }
    if (!next.services[this.active]?.enabled) {
      const first = this.listed()[0]
      if (first) this.select(first.def.id)
    }
    this.applyAudio()
    for (const s of this.slots.values()) void this.applySkin(s)
    this.layout()
    this.emit()
    for (const fn of this.settingsListeners) fn(this.settings, prev)
  }

  private zoomOf(id: string): number {
    return this.settings.zoom[id] ?? 1
  }

  /** Ctrl+= / Ctrl+- / Ctrl+0 on the active platform; remembered per platform. */
  zoomActive(step: 1 | -1 | 0): void {
    const id = this.active
    const z = step === 0 ? 1 : Math.round((this.zoomOf(id) + step * 0.1) * 10) / 10
    const next = Math.min(LIMITS.maxZoom, Math.max(LIMITS.minZoom, z))
    const zoom = { ...this.settings.zoom }
    if (next === 1) delete zoom[id]
    else zoom[id] = next
    this.updateSettings({ zoom })
    this.slots.get(id)?.view?.webContents.setZoomFactor(next)
  }

  /** Back to the platform's start page. Also used by "Try again". */
  retry(id: string): void {
    const slot = this.slots.get(id)
    if (!slot) return
    if (!slot.view) return this.select(id)
    slot.view.webContents.loadURL(slot.def.url).catch(() => {})
  }

  reload(id: string): void {
    this.slots.get(id)?.view?.webContents.reload()
  }

  /** Sounds: muted per platform, and all of them in game mode while the panel is hidden. */
  applyAudio(): void {
    const quiet = this.settings.gameMode && !this.isPanelVisible()
    for (const s of this.slots.values())
      s.view?.webContents.setAudioMuted(Boolean(this.settings.services[s.def.id]?.muted) || quiet)
  }

  // ---- Pinned chats ---------------------------------------------------------------

  private currentChat(): { pinnable: boolean; pinnedId: string | null } {
    const slot = this.slots.get(this.active)
    const url = slot?.url ?? ''
    const pinnable = Boolean(slot && isChatUrl(slot.def.id, url))
    const pinned = this.pins.items.find((p) => p.service === this.active && p.url === url)
    return { pinnable, pinnedId: pinned?.id ?? null }
  }

  private savePinsAndEmit(): void {
    savePins(this.pins)
    this.emit()
  }

  /** Pin the open chat; if it's already pinned, unpin it. */
  async pinCurrent(): Promise<void> {
    const slot = this.slots.get(this.active)
    const wc = slot?.view?.webContents
    if (!slot || !wc || !isChatUrl(slot.def.id, slot.url)) return
    const existing = this.pins.items.find((p) => p.service === slot.def.id && p.url === slot.url)
    if (existing) return this.unpin(existing.id)
    const url = slot.url
    const avatar = await grabAvatar(wc)
    addPin(this.pins, {
      service: slot.def.id,
      url,
      name: nameFromTitle(slot.title, slot.def.name) || slot.def.name,
      avatar,
      category: ''
    })
    this.savePinsAndEmit()
  }

  unpin(id: string): void {
    this.pins.items = this.pins.items.filter((p) => p.id !== id)
    this.savePinsAndEmit()
  }

  async openPin(id: string): Promise<void> {
    const pin = this.pins.items.find((p) => p.id === id)
    if (!pin) return
    this.select(pin.service)
    const slot = this.slots.get(pin.service)
    // Wait for a freshly opened platform to load before jumping.
    for (let i = 0; i < 40 && slot && slot.status !== 'ready'; i++) await new Promise((r) => setTimeout(r, 250))
    const wc = slot?.view?.webContents
    if (wc && slot.url !== pin.url) await goToChat(wc, pin.url)
    wc?.focus()
  }

  renamePin(id: string, name: string): void {
    const pin = this.pins.items.find((p) => p.id === id)
    const clean = name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 64)
    if (pin && clean) {
      pin.name = clean
      this.savePinsAndEmit()
    }
  }

  renameCategory(id: string, name: string): void {
    const c = this.pins.categories.find((x) => x.id === id)
    const clean = name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40)
    if (c && clean) {
      c.name = clean
      this.savePinsAndEmit()
    }
  }

  toggleCategory(id: string): void {
    const c = this.pins.categories.find((x) => x.id === id)
    if (c) {
      c.collapsed = !c.collapsed
      this.savePinsAndEmit()
    }
  }

  private startRename(kind: 'pin' | 'category', id: string): void {
    this.win.webContents.send(CH.startRename, { kind, id })
  }

  private newCategoryFor(service: string, pinId?: string): void {
    const c = addCategory(this.pins, service)
    const pin = pinId ? this.pins.items.find((p) => p.id === pinId) : undefined
    if (pin) pin.category = c.id
    this.savePinsAndEmit()
    this.startRename('category', c.id)
  }

  /** Right-click on a pinned chat. */
  pinMenu(id: string): void {
    const pin = this.pins.items.find((p) => p.id === id)
    if (!pin) return
    const cats = this.pins.categories.filter((c) => c.service === pin.service)
    const sameGroup = (a: { service: string; category: string }, b: { service: string; category: string }): boolean =>
      a.service === b.service && a.category === b.category
    Menu.buildFromTemplate([
      { label: 'Open', click: () => void this.openPin(id) },
      { label: 'Rename…', click: () => this.startRename('pin', id) },
      {
        label: 'Move to',
        submenu: [
          { label: 'Pinned (no category)', type: 'radio', checked: pin.category === '', click: () => ((pin.category = ''), this.savePinsAndEmit()) },
          ...cats.map((c) => ({
            label: c.name,
            type: 'radio' as const,
            checked: pin.category === c.id,
            click: () => ((pin.category = c.id), this.savePinsAndEmit())
          })),
          { type: 'separator' as const },
          { label: 'New category…', click: () => this.newCategoryFor(pin.service, id) }
        ]
      },
      { label: 'Move up', click: () => (moveWithin(this.pins.items, id, -1, sameGroup), this.savePinsAndEmit()) },
      { label: 'Move down', click: () => (moveWithin(this.pins.items, id, 1, sameGroup), this.savePinsAndEmit()) },
      { type: 'separator' },
      { label: 'Unpin', click: () => this.unpin(id) }
    ]).popup({ window: this.win })
  }

  /** Right-click on a category header. */
  categoryMenu(id: string): void {
    const c = this.pins.categories.find((x) => x.id === id)
    if (!c) return
    const sameService = (a: { service: string }, b: { service: string }): boolean => a.service === b.service
    Menu.buildFromTemplate([
      { label: 'Rename…', click: () => this.startRename('category', id) },
      {
        label: 'Color',
        submenu: CATEGORY_COLORS.map((col) => ({
          label: col.name,
          type: 'radio' as const,
          checked: c.color === col.color,
          click: () => ((c.color = col.color), this.savePinsAndEmit())
        }))
      },
      { label: c.collapsed ? 'Expand' : 'Collapse', click: () => this.toggleCategory(id) },
      { label: 'Move up', click: () => (moveWithin(this.pins.categories, id, -1, sameService), this.savePinsAndEmit()) },
      { label: 'Move down', click: () => (moveWithin(this.pins.categories, id, 1, sameService), this.savePinsAndEmit()) },
      { type: 'separator' },
      { label: 'New category…', click: () => this.newCategoryFor(c.service) },
      {
        label: 'Delete category',
        click: () => {
          for (const p of this.pins.items) if (p.category === id) p.category = ''
          this.pins.categories = this.pins.categories.filter((x) => x.id !== id)
          this.savePinsAndEmit()
        }
      }
    ]).popup({ window: this.win })
  }

  /** Import the Equicord themes for Discord and apply them. */
  async importDiscordTheme(): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await importFromEquicord()
      this.themeText = loadThemeCss()
      this.themeVersion++
      const services = structuredClone(this.settings.services)
      services['discord'] = { ...services['discord']!, theme: true }
      this.updateSettings({ services })
      const slot = this.slots.get('discord')
      if (slot) void this.applySkin(slot)
      this.emit()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  /** Add or remove the iMessage look (or an imported theme) on a platform's page (CSS only). */
  private async applySkin(slot: Slot): Promise<void> {
    const wc = slot.view?.webContents
    if (!wc || wc.isDestroyed()) return
    // An imported theme (Discord) replaces the iMessage look.
    const useTheme = Boolean(this.settings.services[slot.def.id]?.theme) && slot.def.id === 'discord' && !!this.themeText
    if (slot.themeKey && (!useTheme || slot.themeFor !== this.themeVersion)) {
      const key = slot.themeKey
      slot.themeKey = null
      await wc.removeInsertedCSS(key).catch(() => {})
    }
    if (useTheme && !slot.themeKey) {
      slot.themeKey = await wc.insertCSS(this.themeText!, { cssOrigin: 'author' })
      slot.themeFor = this.themeVersion
    }
    const want = Boolean(this.settings.services[slot.def.id]?.skin) && !useTheme
    const css = skinCss(slot.def.id, EMBEDDED_FONT_OK.has(slot.def.id) ? fontFace() : '')
    if (want && css && !slot.skinKey) {
      slot.skinKey = await wc.insertCSS(css, { cssOrigin: 'author' })
    } else if (!want && slot.skinKey) {
      const key = slot.skinKey
      slot.skinKey = null
      await wc.removeInsertedCSS(key).catch(() => {})
    }
    // Chat glass strength: a tiny separate stylesheet, swapped when the slider moves.
    const alpha = this.settings.chatGlass
    if (slot.glassKey && (!want || slot.glassFor !== alpha)) {
      const key = slot.glassKey
      slot.glassKey = null
      await wc.removeInsertedCSS(key).catch(() => {})
    }
    if (want && !slot.glassKey) {
      slot.glassKey = await wc.insertCSS(glassCss(alpha), { cssOrigin: 'author' })
      slot.glassFor = alpha
    }
    // Bubble colors (global or this platform's own): another tiny stylesheet.
    const c = colorsFor(this.settings, slot.def.id)
    const colors = colorsCss(c.out, c.in, textOn(c.out), textOn(c.in), rgbTriple(c.out), rgbTriple(c.in))
    if (slot.colorsKey && (!want || slot.colorsFor !== colors)) {
      const key = slot.colorsKey
      slot.colorsKey = null
      await wc.removeInsertedCSS(key).catch(() => {})
    }
    if (want && colors && !slot.colorsKey) {
      slot.colorsKey = await wc.insertCSS(colors, { cssOrigin: 'author' })
      slot.colorsFor = colors
    }
  }

  /**
   * Only the open platform is visible, and only while the panel is shown. A hidden panel
   * makes every page a background tab (document.visibilityState = "hidden"), which is when
   * sites send their own notifications (sender + preview), and they use less CPU while you play.
   */
  syncVisibility(): void {
    const panel = this.isPanelVisible()
    for (const s of this.slots.values())
      s.view?.setVisible(panel && !this.settingsOpen && s.def.id === this.active && s.status === 'ready')
  }

  private setStatus(slot: Slot, status: ServiceStatus): void {
    slot.status = status
    if (slot.retryTimer) clearTimeout(slot.retryTimer)
    slot.retryTimer = null
    // Offline: try again by itself every 15 s until the connection is back.
    if (status === 'offline') slot.retryTimer = setTimeout(() => this.retry(slot.def.id), OFFLINE_RETRY_MS)
    this.syncVisibility()
    this.emit()
  }

  private checkLogin(slot: Slot, url: string): void {
    let path = ''
    try {
      path = new URL(url).pathname
    } catch {
      return
    }
    const needsLogin = (slot.def.loginPaths ?? []).some((p) => path.startsWith(p))
    if (needsLogin !== slot.needsLogin) {
      slot.needsLogin = needsLogin
      this.emit()
    }
  }

  private load(slot: Slot): void {
    const id = slot.def.id
    const view = createServiceView(slot.def, { allowMedia: () => Boolean(this.settings.services[id]?.media) })
    slot.view = view
    view.setBorderRadius(LAYOUT.viewRadius)
    view.setVisible(false)
    view.setBackgroundColor('#00000000')
    this.win.contentView.addChildView(view)
    const wc = view.webContents
    slot.status = 'loading'
    this.applyAudio()
    wc.on('did-start-loading', () => {
      if (slot.status !== 'ready') this.setStatus(slot, 'loading')
    })
    // A new document loses inserted CSS: re-apply the look on every load.
    wc.on('dom-ready', () => {
      slot.skinKey = null
      slot.glassKey = null
      slot.colorsKey = null
      slot.themeKey = null
      void this.applySkin(slot)
    })
    wc.on('did-finish-load', () => {
      wc.setZoomFactor(this.zoomOf(id))
      this.setStatus(slot, 'ready')
    })
    wc.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      // -3 = aborted (e.g. a redirect replaced the load); not a real failure.
      if (!isMainFrame || code === -3) return
      this.setStatus(slot, OFFLINE_CODES.has(code) ? 'offline' : 'error')
    })
    // A crashed page is reloaded by the view; show the loading pup meanwhile, not a blank area.
    wc.on('render-process-gone', () => this.setStatus(slot, 'loading'))
    const onUrl = (url: string): void => {
      slot.url = url
      this.checkLogin(slot, url)
      if (slot.def.id === this.active) this.emit() // the pin button follows the open chat
    }
    wc.on('did-navigate', (_e, url) => onUrl(url))
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (isMainFrame) onUrl(url)
    })
    // Badges come from the title only; the title is not kept.
    wc.on('page-title-updated', (_e, title) => {
      slot.title = title
      const u = unreadFor(title, slot.def.ignoreDot)
      if (u !== slot.unread) {
        const added = unreadGrowth(slot.unread, u)
        slot.unread = u
        this.emit()
        if (added > 0) for (const fn of this.growthListeners) fn(slot.def.id, slot.def.name, added, u)
      }
    })
  }

  /** Close the page properly (keeps logins) and forget its view. */
  private unload(slot: Slot, status: ServiceStatus): void {
    if (slot.retryTimer) clearTimeout(slot.retryTimer)
    slot.retryTimer = null
    if (slot.view) {
      const view = slot.view
      this.win.contentView.removeChildView(view)
      void closePageGracefully(view.webContents)
    }
    slot.view = null
    slot.skinKey = null
    slot.glassKey = null
    slot.colorsKey = null
    slot.themeKey = null
    slot.unread = 0
    slot.needsLogin = false
    slot.status = status
  }

  private tick(): void {
    const now = Date.now()
    const active = this.slots.get(this.active)
    if (active && this.isPanelVisible()) active.lastUsed = now
    const ids = servicesToSleep(
      [...this.slots.values()].map((s) => ({ id: s.def.id, awake: s.view !== null, lastUsed: s.lastUsed })),
      this.active,
      now,
      this.settings.sleepAfterMinutes
    )
    for (const id of ids) this.unload(this.slots.get(id)!, 'asleep')
    if (ids.length) this.emit()
  }

  /** Close every platform page properly (see closePageGracefully). Used before quitting. */
  async closeAll(): Promise<void> {
    const pages = [...this.slots.values()].flatMap((s) => (s.view ? [s.view] : []))
    const t = Date.now()
    await Promise.all(pages.map((v) => closePageGracefully(v.webContents)))
    console.log(`[pupchat] closed ${pages.length} platform page(s) in ${Date.now() - t} ms`)
  }

  layout(): void {
    const { width, height } = this.win.getContentBounds()
    const b = viewBounds({ width, height }, this.settings.collapsed)
    for (const s of this.slots.values()) s.view?.setBounds(b)
  }

  private registerIpc(): void {
    const fromShell = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean =>
      e.sender === this.win.webContents
    ipcMain.handle(CH.getState, (e) => (fromShell(e) ? this.state() : null))
    ipcMain.on(CH.select, (e, id: unknown) => {
      if (fromShell(e) && typeof id === 'string' && this.slots.has(id)) this.select(id)
    })
    ipcMain.on(CH.setCollapsed, (e, c: unknown) => {
      if (fromShell(e) && typeof c === 'boolean') this.setCollapsed(c)
    })
    ipcMain.on(CH.retry, (e, id: unknown) => {
      if (fromShell(e) && typeof id === 'string') this.retry(id)
    })
    ipcMain.on(CH.setPanelWidth, (e, px: unknown) => {
      if (fromShell(e) && typeof px === 'number' && Number.isFinite(px)) this.setPanelWidth(px)
    })
    ipcMain.on(CH.home, (e, id: unknown) => {
      if (fromShell(e) && typeof id === 'string') this.retry(id)
    })
    ipcMain.on(CH.reload, (e, id: unknown) => {
      if (fromShell(e) && typeof id === 'string') this.reload(id)
    })
    ipcMain.on(CH.resetZoom, (e) => {
      if (fromShell(e)) this.zoomActive(0)
    })
    ipcMain.on(CH.updateSettings, (e, patch: unknown) => {
      // validate() inside updateSettings drops anything unknown or out of range.
      if (fromShell(e) && typeof patch === 'object' && patch !== null && !Array.isArray(patch))
        this.updateSettings(patch as Partial<Settings>)
    })
    const str = (v: unknown): v is string => typeof v === 'string' && v.length < 200
    ipcMain.on(CH.pinCurrent, (e) => fromShell(e) && void this.pinCurrent())
    ipcMain.on(CH.unpin, (e, id: unknown) => fromShell(e) && str(id) && this.unpin(id))
    ipcMain.on(CH.openPin, (e, id: unknown) => fromShell(e) && str(id) && void this.openPin(id))
    ipcMain.on(CH.renamePin, (e, id: unknown, name: unknown) => fromShell(e) && str(id) && str(name) && this.renamePin(id, name))
    ipcMain.on(CH.renameCategory, (e, id: unknown, name: unknown) => fromShell(e) && str(id) && str(name) && this.renameCategory(id, name))
    ipcMain.on(CH.toggleCategory, (e, id: unknown) => fromShell(e) && str(id) && this.toggleCategory(id))
    ipcMain.on(CH.pinMenu, (e, id: unknown) => fromShell(e) && str(id) && this.pinMenu(id))
    ipcMain.on(CH.categoryMenu, (e, id: unknown) => fromShell(e) && str(id) && this.categoryMenu(id))
    ipcMain.on(CH.addCategory, (e, service: unknown) => {
      if (fromShell(e) && str(service) && SERVICES.some((x) => x.id === service && x.chatUrl)) this.newCategoryFor(service)
    })
    ipcMain.handle(CH.importDiscordTheme, (e) =>
      fromShell(e) ? this.importDiscordTheme() : { ok: false, error: 'not allowed' }
    )
    ipcMain.on(CH.setSettingsOpen, (e, open: unknown) => {
      if (fromShell(e) && typeof open === 'boolean') this.setSettingsOpen(open)
    })
  }
}
