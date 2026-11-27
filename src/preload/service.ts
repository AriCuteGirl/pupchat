/**
 * Preload for platform pages. Its only job: hand the site's own web notifications to PupChat,
 * which shows them as banners. Nothing else on the page is read or changed.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

const LIMIT = { title: 120, body: 400, icon: 300_000 }
const text = (v: unknown, n: number): string => (typeof v === 'string' ? v.slice(0, n) : '')

function forward(raw: unknown): void {
  if (typeof raw !== 'object' || raw === null) return
  const r = raw as Record<string, unknown>
  ipcRenderer.send('pupchat:notify', {
    id: typeof r['id'] === 'number' && Number.isInteger(r['id']) ? r['id'] : -1,
    title: text(r['title'], LIMIT.title),
    body: text(r['body'], LIMIT.body),
    icon: text(r['icon'], LIMIT.icon),
    silent: r['silent'] === true
  })
}

/**
 * Runs in the page's own world, before the site's scripts. Serialized by Electron, so it can
 * only use its argument (`send`) and page globals.
 */
function install(send: (n: unknown) => void): (id: number) => void {
  const live = new Map<number, EventTarget>()
  let next = 1
  const abs = (u: unknown): string => {
    if (typeof u !== 'string' || !u) return ''
    try {
      return new URL(u, location.href).href
    } catch {
      return ''
    }
  }
  const fire = (t: EventTarget, type: string): Event => {
    const ev = new Event(type, { cancelable: true })
    t.dispatchEvent(ev)
    const h = (t as unknown as Record<string, unknown>)['on' + type]
    if (typeof h === 'function') h.call(t, ev)
    return ev
  }

  class PupNotification extends EventTarget {
    title: string
    body: string
    icon: string
    tag: string
    data: unknown
    silent: boolean
    onclick: unknown = null
    onclose: unknown = null
    onshow: unknown = null
    onerror: unknown = null
    private readonly pupId: number

    constructor(title: string, options: Record<string, unknown> = {}) {
      super()
      this.title = String(title ?? '')
      this.body = options['body'] == null ? '' : String(options['body'])
      this.icon = abs(options['icon'])
      this.tag = options['tag'] == null ? '' : String(options['tag'])
      this.data = options['data']
      this.silent = options['silent'] === true
      this.pupId = next++
      live.set(this.pupId, this)
      if (live.size > 50) live.delete(live.keys().next().value as number)
      send({ id: this.pupId, title: this.title, body: this.body, icon: this.icon, silent: this.silent })
      setTimeout(() => fire(this, 'show'), 0)
    }
    close(): void {
      if (live.delete(this.pupId)) fire(this, 'close')
    }
    static get permission(): string {
      return 'granted'
    }
    static requestPermission(cb?: (p: string) => void): Promise<string> {
      cb?.('granted')
      return Promise.resolve('granted')
    }
    static get maxActions(): number {
      return 0
    }
  }

  Object.defineProperty(window, 'Notification', { value: PupNotification, writable: true, configurable: true })
  // Notifications a page shows through its service worker registration.
  const SWR = (window as unknown as { ServiceWorkerRegistration?: { prototype: Record<string, unknown> } })
    .ServiceWorkerRegistration
  if (SWR)
    SWR.prototype['showNotification'] = function (title: string, options: Record<string, unknown> = {}) {
      send({ id: -1, title: String(title ?? ''), body: String(options['body'] ?? ''), icon: abs(options['icon']) })
      return Promise.resolve()
    }

  // Called when you click the banner: the site's own click handler opens that chat.
  return (id: number) => {
    const n = live.get(id)
    if (n) fire(n, 'click')
  }
}

const clickNotification = contextBridge.executeInMainWorld({ func: install, args: [forward] }) as (
  id: number
) => void

ipcRenderer.on('pupchat:notification-click', (_e: IpcRendererEvent, id: unknown) => {
  if (typeof id === 'number' && Number.isInteger(id) && id > 0) clickNotification(id)
})
