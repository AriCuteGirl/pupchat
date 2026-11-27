import { ipcMain, type BrowserWindow, type WebContentsView } from 'electron'
import { CH, type ServiceStatus, type ShellState } from '../shared/ipc'
import { LAYOUT, viewBounds } from '../shared/layout'
import { SERVICES, type ServiceDef } from '../shared/services'
import { createServiceView } from './serviceView'

interface Slot {
  def: ServiceDef
  view: WebContentsView | null
  status: ServiceStatus
}

/** Owns the service views inside the panel window and the state the shell UI renders. */
export class Shell {
  private slots = new Map<string, Slot>()
  private active: string
  private collapsed = false
  private listeners: Array<(s: ShellState) => void> = []

  constructor(private readonly win: BrowserWindow) {
    for (const def of SERVICES) this.slots.set(def.id, { def, view: null, status: 'idle' })
    this.active = SERVICES[0]!.id
    win.on('resize', () => this.layout())
    this.registerIpc()
    this.select(this.active)
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
      services: [...this.slots.values()].map((s) => ({ id: s.def.id, name: s.def.name, status: s.status })),
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
    if (!slot.view) this.load(slot) // lazy: a service loads the first time you open it
    for (const s of this.slots.values()) s.view?.setVisible(s.def.id === id && s.status === 'ready')
    this.layout()
    this.emit()
    slot.view?.webContents.focus()
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
    slot.view.webContents.reload()
  }

  private setStatus(slot: Slot, status: ServiceStatus): void {
    slot.status = status
    slot.view?.setVisible(slot.def.id === this.active && status === 'ready')
    this.emit()
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
      if (isMainFrame && code !== -3) this.setStatus(slot, 'error')
    })
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
