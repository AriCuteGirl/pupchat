import { ipcMain, type BrowserWindow, type WebContentsView } from 'electron'
import { CH, type ServiceStatus, type ShellState } from '../shared/ipc'
import { LAYOUT, viewBounds } from '../shared/layout'
import { SERVICES, type ServiceDef } from '../shared/services'
import { parseUnread, type Unread } from './badge'
import { createServiceView } from './serviceView'
import { servicesToSleep } from './sleep'

interface Slot {
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

/** Owns the service views inside the panel window and the state the shell UI renders. */
export class Shell {
  private slots = new Map<string, Slot>()
  private active: string
  private collapsed = false
  private listeners: Array<(s: ShellState) => void> = []
  /** Minutes before an unused platform sleeps; 0 = never. Becomes a setting in step 5. */
  sleepAfterMinutes = 0
  isPanelVisible: () => boolean = () => true

  constructor(private readonly win: BrowserWindow) {
    for (const def of SERVICES)
      this.slots.set(def.id, {
        def,
        view: null,
        status: 'idle',
        unread: 0,
        needsLogin: false,
        lastUsed: 0,
        retryTimer: null
      })
    this.active = SERVICES[0]!.id
    win.on('resize', () => this.layout())
    this.registerIpc()
    this.select(this.active)
    setInterval(() => this.tick(), 60_000).unref()
  }

  get isCollapsed(): boolean {
    return this.collapsed
  }

  activeView(): WebContentsView | null {
    return this.slots.get(this.active)?.view ?? null
  }

  onState(fn: (s: ShellState) => void): void {
    this.listeners.push(fn)
  }

  state(): ShellState {
    return {
      services: [...this.slots.values()].map((s) => ({
        id: s.def.id,
        name: s.def.name,
        status: s.status,
        unread: s.unread,
        needsLogin: s.needsLogin
      })),
      active: this.active,
      collapsed: this.collapsed
    }
  }

  private emit(): void {
    const s = this.state()
    if (!this.win.isDestroyed()) this.win.webContents.send(CH.state, s)
    for (const fn of this.listeners) fn(s)
  }

  select(id: string): void {
    const slot = this.slots.get(id)
    if (!slot) return
    this.active = id
    slot.lastUsed = Date.now()
    if (!slot.view) this.load(slot) // lazy: loads the first time you open it, or wakes it up
    this.syncVisibility()
    this.layout()
    this.emit()
    slot.view?.webContents.focus()
  }

  /** Ctrl+1..9: the n-th platform in the list. */
  selectIndex(n: number): void {
    const id = [...this.slots.keys()][n]
    if (id) this.select(id)
  }

  setCollapsed(c: boolean): void {
    if (c === this.collapsed) return
    this.collapsed = c
    this.layout()
    this.emit()
  }

  retry(id: string): void {
    const slot = this.slots.get(id)
    if (!slot?.view) return
    slot.view.webContents.loadURL(slot.def.url).catch(() => {})
  }

  private syncVisibility(): void {
    for (const s of this.slots.values()) s.view?.setVisible(s.def.id === this.active && s.status === 'ready')
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
    const view = createServiceView(slot.def)
    slot.view = view
    view.setBorderRadius(LAYOUT.viewRadius)
    view.setVisible(false)
    view.setBackgroundColor('#00000000')
    this.win.contentView.addChildView(view)
    const wc = view.webContents
    slot.status = 'loading'
    wc.on('did-start-loading', () => {
      if (slot.status !== 'ready') this.setStatus(slot, 'loading')
    })
    wc.on('did-finish-load', () => this.setStatus(slot, 'ready'))
    wc.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      // -3 = aborted (e.g. a redirect replaced the load); not a real failure.
      if (!isMainFrame || code === -3) return
      this.setStatus(slot, OFFLINE_CODES.has(code) ? 'offline' : 'error')
    })
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

  /** Close the page to free RAM; it comes back when you open the platform again. */
  private sleep(slot: Slot): void {
    if (!slot.view) return
    if (slot.retryTimer) clearTimeout(slot.retryTimer)
    this.win.contentView.removeChildView(slot.view)
    slot.view.webContents.close()
    slot.view = null
    slot.unread = 0
    slot.needsLogin = false
    slot.status = 'asleep'
    this.emit()
  }

  private tick(): void {
    const now = Date.now()
    const active = this.slots.get(this.active)
    if (active && this.isPanelVisible()) active.lastUsed = now
    const ids = servicesToSleep(
      [...this.slots.values()].map((s) => ({ id: s.def.id, awake: s.view !== null, lastUsed: s.lastUsed })),
      this.active,
      now,
      this.sleepAfterMinutes
    )
    for (const id of ids) this.sleep(this.slots.get(id)!)
  }

  layout(): void {
    const { width, height } = this.win.getContentBounds()
    const b = viewBounds({ width, height }, this.collapsed)
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
  }
}
