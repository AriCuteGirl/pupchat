import { BrowserWindow, ipcMain, webContents } from 'electron'
import { join } from 'node:path'

export const BANNER_TITLE = 'PupChat Banner'
export const BANNER_SIZE = { width: 372, height: 84 } as const
const SHOW_MS = 6000
const AFTER_HOVER_MS = 2500
const MAX_QUEUE = 20

export interface BannerItem {
  service: string
  name: string
  title: string
  body: string
  icon: string
  /** The notification inside the page, and the page it came from (to fire its click). */
  notifId: number
  pageId: number
  /** Show without the banner sound (muted platform). */
  silent?: boolean
}

/** Only images we can show without loading anything odd: https, or small inline images. */
export function safeIcon(icon: string): string {
  if (/^https:\/\/[^\s"'<>]+$/i.test(icon) && icon.length < 4096) return icon
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(icon) && icon.length < 300_000) return icon
  return ''
}

/**
 * iMessage-style banners: one at a time in a small glass window at the top center of the
 * screen, "+N more" when others wait. Never takes focus by itself.
 */
export class Banners {
  readonly win: BrowserWindow
  private queue: BannerItem[] = []
  private current: BannerItem | null = null
  private timer: NodeJS.Timeout | null = null
  private ready: Promise<void>

  constructor(
    private readonly deps: {
      /** Open the panel on this platform. */
      open: (service: string) => void
      /** Put the banner window where it belongs (screen edge, monitor). */
      place: () => void
      /** After dismissing by click, give focus back to the game. */
      refocusPrevious: () => void
    }
  ) {
    this.win = new BrowserWindow({
      title: BANNER_TITLE,
      ...BANNER_SIZE,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      focusable: true,
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/banner.cjs'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false
      }
    })
    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.on('page-title-updated', (e) => e.preventDefault())
    this.win.webContents.on('will-navigate', (e) => e.preventDefault())
    this.win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    if (process.env['ELECTRON_RENDERER_URL']) void this.win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/banner.html`)
    else void this.win.loadFile(join(import.meta.dirname, '../renderer/banner.html'))
    this.ready = new Promise((r) => this.win.webContents.once('did-finish-load', () => r()))

    const fromBanner = (e: Electron.IpcMainEvent): boolean => e.sender === this.win.webContents
    ipcMain.on('pupchat:banner-click', (e) => fromBanner(e) && this.clickCurrent())
    ipcMain.on('pupchat:banner-dismiss', (e) => {
      if (!fromBanner(e)) return
      this.next()
      if (!this.current) deps.refocusPrevious()
    })
    ipcMain.on('pupchat:banner-hover', (e, on: unknown) => {
      if (!fromBanner(e)) return
      this.arm(on === true ? null : AFTER_HOVER_MS)
    })
  }

  push(item: BannerItem): void {
    // The same chat notifying again replaces its waiting banner.
    this.queue = this.queue.filter((q) => !(q.service === item.service && q.title === item.title))
    this.queue.push(item)
    if (this.queue.length > MAX_QUEUE) this.queue.shift()
    if (!this.current) this.next()
    else void this.send() // update "+N more"
  }

  /** Drop everything (e.g. you opened PupChat on that platform anyway). */
  clear(service?: string): void {
    this.queue = service ? this.queue.filter((q) => q.service !== service) : []
    if (!service || this.current?.service === service) this.next()
    else void this.send()
  }

  private next(): void {
    this.current = this.queue.shift() ?? null
    if (!this.current) {
      this.arm(null)
      this.win.hide()
      return
    }
    void this.send(true).then(() => {
      this.deps.place()
      if (!this.win.isVisible()) this.win.showInactive()
      this.arm(SHOW_MS)
    })
  }

  private async send(isNew = false): Promise<void> {
    if (!this.current) return
    await this.ready
    const { service, name, title, body, icon, silent } = this.current
    const play = isNew && !silent
    this.win.webContents.send('pupchat:banner-show', { service, name, title, body, icon, more: this.queue.length, play })
  }

  /** Set the banner sound (data: URL or '' for none). `preview` plays it once right away. */
  async setSound(src: string, volume: number, preview = false): Promise<void> {
    await this.ready
    this.win.webContents.send('pupchat:banner-sound', src, volume, preview)
  }

  private arm(ms: number | null): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = ms === null ? null : setTimeout(() => this.next(), ms)
  }

  private clickCurrent(): void {
    const c = this.current
    if (!c) return
    this.queue = []
    this.next()
    this.deps.open(c.service)
    // Let the site open that chat through its own notification click handler.
    const page = webContents.fromId(c.pageId)
    if (page && !page.isDestroyed()) page.send('pupchat:notification-click', c.notifId)
  }
}
