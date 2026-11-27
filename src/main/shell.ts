import { ipcMain, type BrowserWindow, type WebContentsView } from 'electron'
import { CH, type ServiceStatus, type ShellState } from '../shared/ipc'
import { LAYOUT, viewBounds } from '../shared/layout'
import { SERVICES, type ServiceDef } from '../shared/services'
import { LIMITS, validate, type Settings } from '../shared/settings'
import { parseUnread, type Unread } from './badge'
import { closePageGracefully } from './closePage'
import { skinCss } from './skins'
import { createServiceView } from './serviceView'
import { servicesToSleep } from './sleep'

interface Slot {
  /** insertCSS key of the iMessage look, when applied to the current page. */
  skinKey: string | null
  def: ServiceDef
  view: WebContentsView | null
  status: ServiceStatus
  unread: Unread
  needsLogin: boolean
  lastUsed: number
  retryTimer: NodeJS.Timeout | null
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
  private listeners: Array<(s: ShellState) => void> = []
  private settingsListeners: Array<(s: Settings, prev: Settings) => void> = []
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
        skinKey: null
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
      platform: process.platform
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

  /** Add or remove the iMessage look on a platform's current page (CSS only). */
  private async applySkin(slot: Slot): Promise<void> {
    const wc = slot.view?.webContents
    if (!wc || wc.isDestroyed()) return
    const want = Boolean(this.settings.services[slot.def.id]?.skin)
    const css = skinCss(slot.def.id)
    if (want && css && !slot.skinKey) {
      slot.skinKey = await wc.insertCSS(css, { cssOrigin: 'author' })
    } else if (!want && slot.skinKey) {
      const key = slot.skinKey
      slot.skinKey = null
      await wc.removeInsertedCSS(key).catch(() => {})
    }
  }

  private syncVisibility(): void {
    for (const s of this.slots.values())
      s.view?.setVisible(!this.settingsOpen && s.def.id === this.active && s.status === 'ready')
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
    wc.on('did-navigate', (_e, url) => this.checkLogin(slot, url))
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (isMainFrame) this.checkLogin(slot, url)
    })
    // Badges come from the title only; the title is not kept.
    wc.on('page-title-updated', (_e, title) => {
      const u = parseUnread(title)
      if (u !== slot.unread) {
        slot.unread = u
        this.emit()
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
    ipcMain.on(CH.setSettingsOpen, (e, open: unknown) => {
      if (fromShell(e) && typeof open === 'boolean') this.setSettingsOpen(open)
    })
  }
}
