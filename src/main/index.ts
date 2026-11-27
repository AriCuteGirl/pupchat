import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { SERVICES } from '../shared/services'
import { createServiceView } from './serviceView'

const PANEL_WIDTH = 420
const RAIL_WIDTH = 56

app.setName('PupChat')

function createWindow(): void {
  const area = screen.getPrimaryDisplay().workArea
  const win = new BrowserWindow({
    title: 'PupChat',
    width: PANEL_WIDTH,
    height: area.height,
    x: area.x + area.width - PANEL_WIDTH,
    y: area.y,
    frame: false,
    show: false,
    backgroundColor: '#1c1c1e',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  const service = SERVICES[0]!
  const view = createServiceView(service)
  win.contentView.addChildView(view)

  const layout = (): void => {
    const { width, height } = win.getContentBounds()
    view.setBounds({ x: RAIL_WIDTH, y: 0, width: Math.max(0, width - RAIL_WIDTH), height })
  }
  win.on('resize', layout)
  layout()

  // Shell UI must never navigate away or open windows.
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))

  win.once('ready-to-show', () => win.show())
}

void app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
