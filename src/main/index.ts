import { app, BrowserWindow, screen, type WebContents } from 'electron'
import { join } from 'node:path'
import { panelWidth } from '../shared/layout'
import { isCliCommand, parseCli, type CliCommand } from './cli'
import { isHyprland, placePanel, placePaw, SPECIAL, workspaceOf } from './hyprland'
import { Panel } from './panel'
import { createPaw, PAW_TITLE } from './paw'
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
  const area = screen.getPrimaryDisplay().workArea
  const width = panelWidth(false)
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

  // Keys handled before the page sees them, in the shell and in every service view.
  const keys = (wc: WebContents): void => {
    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return
      const plain = !input.control && !input.alt && !input.meta && !input.shift
      if (input.key === 'Escape' && plain) {
        e.preventDefault()
        void panel?.hide()
      } else if (input.control && input.shift && !input.alt && input.key.toLowerCase() === 'b') {
        e.preventDefault()
        shell?.setCollapsed(!shell.isCollapsed)
      }
    })
  }
  keys(win.webContents)
  // Every web contents created from now on (service views, paw) gets the same keys.
  app.on('web-contents-created', (_e, wc) => keys(wc))

  // Registered before any service view exists, so every view gets the keys.
  let panel: Panel | null = null
  const shell: Shell = new Shell(win)

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

  // Flush to the right edge, full height; width follows the collapsed state.
  const place = (): void => {
    const w = panelWidth(shell.isCollapsed)
    if (isHyprland()) void placePanel(PANEL_TITLE, w).catch((e) => console.warn('[pupchat] place:', e))
    else {
      const wa = screen.getDisplayMatching(win.getBounds()).workArea
      win.setBounds({ x: wa.x + wa.width - w, y: wa.y, width: w, height: wa.height })
    }
  }
  let lastCollapsed = shell.isCollapsed
  shell.onState((s) => {
    if (s.collapsed !== lastCollapsed) {
      lastCollapsed = s.collapsed
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
    const w = panelWidth(shell.isCollapsed)
    if (isHyprland()) void placePaw(PAW_TITLE, p.isVisible, w).catch(() => {})
    else {
      const wa = screen.getDisplayMatching(win.getBounds()).workArea
      const x = p.isVisible ? wa.x + wa.width - w - 62 : wa.x + wa.width - 64
      paw.setPosition(x, Math.round(wa.y + wa.height * 0.45))
    }
  }
  p.onChange(placeTheWholeEdge)
  shell.onState(placeTheWholeEdge)
  paw.once('show', placeTheWholeEdge)

  const run = (cmd: CliCommand): void => {
    if (cmd.service) shell.select(cmd.service)
    if (cmd.action === 'toggle') void p.toggle()
    else if (cmd.action === 'show') void p.show()
    else if (cmd.action === 'hide') void p.hide()
  }
  app.on('second-instance', (_e, _argv, _cwd, data) => {
    if (isCliCommand(data)) run(data)
  })
  run(launch.action ? launch : { action: 'show', service: null })
}

app.on('window-all-closed', () => app.quit())
