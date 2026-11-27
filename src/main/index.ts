import { app, BrowserWindow, screen, type WebContents } from 'electron'
import { join } from 'node:path'
import { CH } from '../shared/ipc'
import { windowWidth } from '../shared/layout'
import { totalUnread } from './badge'
import { isCliCommand, parseCli, type CliCommand } from './cli'
import { isHyprland, placePanel, placePaw, SPECIAL, workspaceOf } from './hyprland'
import { Panel } from './panel'
import { createPaw, PAW_TITLE } from './paw'
import { loadSettings, makeSaver } from './settings'
import { Shell } from './shell'

const PANEL_TITLE = 'PupChat'

app.setName('PupChat')

// Single instance: a second launch hands its parsed flags to us and exits.
const launch = parseCli(process.argv)
if (!app.requestSingleInstanceLock(launch as unknown as Record<string, unknown>)) {
  app.quit()
} else {
  void app.whenReady().then(start)
}

async function start(): Promise<void> {
  const settingsFile = join(app.getPath('userData'), 'settings.json')
  const settings = loadSettings(settingsFile)
  const save = makeSaver(settingsFile)
  const area = screen.getPrimaryDisplay().workArea
  const width = windowWidth(settings.panelWidth, settings.collapsed)
  const win = new BrowserWindow({
    title: PANEL_TITLE,
    width,
    height: area.height,
    x: area.x + area.width - width,
    y: area.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/shell.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  // Keep our title so Hyprland rules and our own lookups can find the window.
  win.on('page-title-updated', (e) => e.preventDefault())
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // Our own UI's errors go to the terminal (service pages' consoles are not logged).
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') console.warn(`[shell ${e.level}] ${e.message}`)
  })

  // Keys handled before the page sees them, in the shell and in every service view.
  // Esc hides the panel only from PupChat's own UI: inside a site it belongs to the site
  // (closing GIF/sticker pickers, menus, image viewers).
  const keys = (wc: WebContents): void => {
    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return
      const plain = !input.control && !input.alt && !input.meta && !input.shift
      const ownUi = wc === win.webContents || wc.getURL().startsWith('file:') || wc.getURL().includes('/paw.html')
      if (input.key === 'Escape' && plain && ownUi) {
        e.preventDefault()
        void panel?.hide()
      } else if (input.control && input.shift && !input.alt && input.key.toLowerCase() === 'b') {
        e.preventDefault()
        shell?.setCollapsed(!shell.isCollapsed)
      } else if (input.control && !input.alt && ['Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract', 'Digit0', 'Numpad0'].includes(input.code) && wc !== win.webContents) {
        // Zoom the platform you're in; remembered per platform.
        e.preventDefault()
        shell?.zoomActive(input.code.includes('0') ? 0 : input.code === 'Minus' || input.code === 'NumpadSubtract' ? -1 : 1)
      } else if (input.control && !input.shift && !input.alt && /^Digit[1-9]$/.test(input.code)) {
        // Ctrl+1..9 by key position, so it also works on the CZ layout (+ěščř…).
        e.preventDefault()
        shell?.selectIndex(Number(input.code.slice(5)) - 1)
      }
    })
  }
  keys(win.webContents)
  // Every web contents created from now on (service views, paw) gets the same keys.
  app.on('web-contents-created', (_e, wc) => keys(wc))

  // Registered before any service view exists, so every view gets the keys.
  let panel: Panel | null = null
  const shell: Shell = new Shell(win, settings, save)

  if (process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  await new Promise<void>((r) => win.once('ready-to-show', () => r()))

  // On Hyprland the window rule may already have put us on special:pupchat.
  let mode: 'special' | 'window' = 'window'
  if (isHyprland()) {
    win.showInactive()
    await new Promise((r) => setTimeout(r, 300))
    const ws = await workspaceOf(process.pid, PANEL_TITLE).catch(() => null)
    if (ws === `special:${SPECIAL}`) mode = 'special'
    else win.hide()
    console.log(`[pupchat] window on workspace ${ws ?? '?'}, using "${mode}" mode`)
  }
  const p = new Panel(win, mode)
  panel = p
  shell.isPanelVisible = () => p.isVisible

  // Flush to the right edge, full height. Calls are coalesced: while one placement runs,
  // only the newest request waits (dragging the edge sends many).
  let placing = false
  let placeAgain = false
  const place = (): void => {
    if (placing) {
      placeAgain = true
      return
    }
    placing = true
    const w = windowWidth(shell.panelWidth, shell.isCollapsed)
    const done = (): void => {
      placing = false
      if (placeAgain) {
        placeAgain = false
        place()
      }
    }
    if (isHyprland()) {
      placePanel(PANEL_TITLE, w)
        .catch((e) => console.warn('[pupchat] place:', e))
        .finally(done)
    } else {
      const wa = screen.getDisplayMatching(win.getBounds()).workArea
      win.setBounds({ x: wa.x + wa.width - w, y: wa.y, width: w, height: wa.height })
      done()
    }
  }
  let lastW = windowWidth(shell.panelWidth, shell.isCollapsed)
  shell.onState((s) => {
    const w = windowWidth(s.panelWidth, s.collapsed)
    if (w !== lastW) {
      lastW = w
      place()
    }
  })

  // Focus the chat when the panel appears, so you can type right away.
  const focusChat = (): void => shell.activeView()?.webContents.focus()
  win.on('focus', focusChat)
  p.onChange((v) => {
    if (!v) return
    place()
    focusChat()
  })

  // The paw stays visible: on the screen edge when closed, beside the panel when open,
  // so one click opens and the next click slides the panel away again.
  const paw = createPaw(() => void p.toggleFromPaw())
  const placeTheWholeEdge = (): void => {
    const w = windowWidth(shell.panelWidth, shell.isCollapsed)
    if (isHyprland()) void placePaw(PAW_TITLE, p.isVisible, w).catch(() => {})
    else {
      const wa = screen.getDisplayMatching(win.getBounds()).workArea
      const x = p.isVisible ? wa.x + wa.width - w - 62 : wa.x + wa.width - 64
      paw.setPosition(x, Math.round(wa.y + wa.height * 0.45))
    }
  }
  p.onChange(placeTheWholeEdge)
  let lastPawWidth = -1
  shell.onState((st) => {
    const w = windowWidth(st.panelWidth, st.collapsed)
    if (w !== lastPawWidth) {
      lastPawWidth = w
      placeTheWholeEdge()
    }
    sendPawUnread(totalUnread(st.services.map((x) => x.unread)))
  })
  let lastTotal = -1
  const sendPawUnread = (n: number): void => {
    if (n === lastTotal || paw.isDestroyed()) return
    lastTotal = n
    paw.webContents.send(CH.pawUnread, n)
  }
  paw.webContents.on('did-finish-load', () => {
    lastTotal = -1
    sendPawUnread(totalUnread(shell.state().services.map((x) => x.unread)))
  })
  paw.once('show', placeTheWholeEdge)

  const run = (cmd: CliCommand): void => {
    if (cmd.service) shell.select(cmd.service)
    if (cmd.action === 'toggle') void p.toggle()
    else if (cmd.action === 'show') void p.show()
    else if (cmd.action === 'hide') void p.hide()
    else if (cmd.action === 'quit') app.quit()
  }
  app.on('second-instance', (_e, _argv, _cwd, data) => {
    if (isCliCommand(data)) run(data)
  })
  run(launch.action ? launch : { action: 'show', service: null })

  // Quit properly: let every platform page close itself first (keeps Discord logged in).
  let closing = false
  app.on('before-quit', (e) => {
    if (closing) return
    closing = true
    e.preventDefault()
    void shell.closeAll().finally(() => app.quit())
  })
  // kill, logout and reboot send these: take the same careful path.
  for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) process.on(sig, () => app.quit())
}

app.on('window-all-closed', () => app.quit())
