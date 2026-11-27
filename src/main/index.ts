import { app, BrowserWindow, screen, type WebContents } from 'electron'
import { join } from 'node:path'
import { SERVICES } from '../shared/services'
import { isCliCommand, parseCli, type CliCommand } from './cli'
import { isHyprland, workspaceOf, SPECIAL } from './hyprland'
import { Panel } from './panel'
import { createPaw } from './paw'
import { createServiceView } from './serviceView'

const PANEL_WIDTH = 420
const RAIL_WIDTH = 56
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
  const win = new BrowserWindow({
    title: PANEL_TITLE,
    width: PANEL_WIDTH,
    height: area.height,
    x: area.x + area.width - PANEL_WIDTH,
    y: area.y,
    frame: false,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#1c1c1e',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
  })
  // Keep our title so Hyprland rules and our own lookups can find the window.
  win.on('page-title-updated', (e) => e.preventDefault())

  const service = SERVICES[0]!
  const view = createServiceView(service)
  win.contentView.addChildView(view)
  const layout = (): void => {
    const { width, height } = win.getContentBounds()
    view.setBounds({ x: RAIL_WIDTH, y: 0, width: Math.max(0, width - RAIL_WIDTH), height })
  }
  win.on('resize', layout)
  layout()

  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  if (process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))

  await new Promise<void>((r) => win.once('ready-to-show', () => r()))

  // On Hyprland the window rule may already have put us on special:pupchat.
  // Mapping the window is needed either way; where it lands decides the backend.
  let mode: 'special' | 'window' = 'window'
  if (isHyprland()) {
    win.showInactive()
    await new Promise((r) => setTimeout(r, 300))
    const ws = await workspaceOf(process.pid, PANEL_TITLE).catch(() => null)
    if (ws === `special:${SPECIAL}`) mode = 'special'
    else win.hide()
    console.log(`[pupchat] window on workspace ${ws ?? '?'}, using "${mode}" mode`)
  }
  const panel = new Panel(win, mode)

  // Focus the chat when the panel appears, so you can type right away.
  const focusChat = (): void => view.webContents.focus()
  win.on('focus', focusChat)
  panel.onChange((v) => v && focusChat())

  // Esc (no modifiers) hides the panel, from the rail or from inside the chat.
  const escHides = (wc: WebContents): void => {
    wc.on('before-input-event', (e, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape' && !input.control && !input.alt && !input.meta && !input.shift) {
        e.preventDefault()
        void panel.hide()
      }
    })
  }
  escHides(win.webContents)
  escHides(view.webContents)

  // The paw hides while the panel is open (the panel covers that edge anyway).
  const paw = createPaw(() => void panel.toggle())
  panel.onChange((v) => (v ? paw.hide() : paw.showInactive()))

  const run = (cmd: CliCommand): void => {
    // --service is accepted now; switching services arrives with the other services (step 4).
    if (cmd.action === 'toggle') void panel.toggle()
    else if (cmd.action === 'show') void panel.show()
    else if (cmd.action === 'hide') void panel.hide()
  }
  app.on('second-instance', (_e, _argv, _cwd, data) => {
    if (isCliCommand(data)) run(data)
  })
  run(launch.action ? launch : { action: 'show', service: null })
}

app.on('window-all-closed', () => app.quit())
