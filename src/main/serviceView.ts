import { WebContentsView, session, shell } from 'electron'
import { join } from 'node:path'
import { partitionFor, type ServiceDef } from '../shared/services'
import { isExternalSafe, isServiceUrl } from './navigation'
import { chromeUserAgent } from './userAgent'

const UA = chromeUserAgent(process.versions.chrome, process.platform)

/**
 * Always allowed: notifications, and copying to the clipboard (sites use it for
 * "copy GIF/link"). Microphone and camera only when you turned them on for this platform.
 * Everything else (screen sharing, location, MIDI, ...) is denied.
 */
const ALWAYS_ALLOWED = new Set(['notifications', 'clipboard-sanitized-write'])

export interface ViewPolicy {
  /** Read live, so changing the setting applies without reloading. */
  allowMedia: () => boolean
}

function mediaOnlyMicCam(details: unknown): boolean {
  const types = (details as { mediaTypes?: string[] } | undefined)?.mediaTypes ?? []
  return types.every((t) => t === 'audio' || t === 'video')
}

function lockDownSession(id: string, policy: ViewPolicy): Electron.Session {
  const ses = session.fromPartition(partitionFor(id))
  ses.setUserAgent(UA)
  const allowed = (permission: string, details?: unknown): boolean =>
    ALWAYS_ALLOWED.has(permission) || (permission === 'media' && policy.allowMedia() && mediaOnlyMicCam(details))
  ses.setPermissionRequestHandler((_wc, permission, cb, details) => cb(allowed(permission, details)))
  ses.setPermissionCheckHandler((_wc, permission) =>
    ALWAYS_ALLOWED.has(permission) || (permission === 'media' && policy.allowMedia())
  )
  return ses
}

function isBlankPopup(url: string): boolean {
  return url === '' || url === 'about:blank' || url === 'about://blank'
}

export function createServiceView(service: ServiceDef, policy: ViewPolicy): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      session: lockDownSession(service.id, policy),
      // Only forwards the site's own notifications to PupChat's banners (see preload/service.ts).
      preload: join(import.meta.dirname, '../preload/service.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true
    }
  })
  const wc = view.webContents
  wc.setUserAgent(UA)

  const openOutside = (url: string): void => {
    if (isExternalSafe(url)) void shell.openExternal(url)
  }

  // Where a link or popup really wants to go: the platform's own pages open in the view,
  // anything else in your default browser.
  const route = (url: string): void => {
    if (isServiceUrl(service, url)) void wc.loadURL(url)
    else openOutside(url)
  }

  // New windows. Many sites open an empty window first (about:blank) and point it somewhere
  // a moment later; that one is allowed hidden, its first real address is routed, then it closes.
  wc.setWindowOpenHandler(({ url }) => {
    if (isBlankPopup(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          show: false,
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
        }
      }
    }
    route(url)
    return { action: 'deny' }
  })
  wc.on('did-create-window', (child) => {
    const cwc = child.webContents
    let done = false
    const take = (e: Electron.Event | null, url: string): void => {
      if (done || isBlankPopup(url)) return
      done = true
      e?.preventDefault()
      route(url)
      setImmediate(() => !child.isDestroyed() && child.destroy())
    }
    cwc.on('will-navigate', (e, url) => take(e, url))
    cwc.on('will-redirect', (e, url) => take(e, url))
    cwc.on('did-start-navigation', (d) => take(null, d.url))
    cwc.setWindowOpenHandler(() => ({ action: 'deny' }))
    // Nothing came: don't leave a hidden window behind.
    setTimeout(() => !child.isDestroyed() && child.destroy(), 15_000)
  })

  // Keep the view on its own domains.
  const guard = (e: Electron.Event, url: string): void => {
    if (!isServiceUrl(service, url)) {
      e.preventDefault()
      openOutside(url)
    }
  }
  wc.on('will-navigate', guard)
  wc.on('will-redirect', guard)

  // Crash recovery: reload the view if its renderer dies.
  wc.on('render-process-gone', (_e, details) => {
    console.warn(`[${service.id}] renderer gone (${details.reason}), reloading`)
    if (details.reason !== 'clean-exit') setTimeout(() => wc.reload(), 1000)
  })

  void wc.loadURL(service.url)
  return view
}
