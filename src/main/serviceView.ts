import { WebContentsView, session, shell } from 'electron'
import { partitionFor, type ServiceDef } from '../shared/services'
import { isExternalSafe, isServiceUrl } from './navigation'
import { chromeUserAgent } from './userAgent'

const UA = chromeUserAgent(process.versions.chrome, process.platform)

/** Grants only notifications; mic/camera/screen become opt-in per service later. */
function lockDownSession(id: string): Electron.Session {
  const ses = session.fromPartition(partitionFor(id))
  ses.setUserAgent(UA)
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'notifications'))
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'notifications')
  return ses
}

export function createServiceView(service: ServiceDef): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      session: lockDownSession(service.id),
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

  // New windows: same-service popups stay in a link click, the rest go to the browser.
  wc.setWindowOpenHandler(({ url }) => {
    if (isServiceUrl(service, url)) void wc.loadURL(url)
    else openOutside(url)
    return { action: 'deny' }
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
