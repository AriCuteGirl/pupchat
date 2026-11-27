import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'

export const PAW_TITLE = 'PupChat Paw'
const SIZE = 56

/** The little glass paw on the screen edge. Never takes focus; a click toggles the panel. */
export function createPaw(onToggle: () => void, showAtStart = true): BrowserWindow {
  const area = screen.getPrimaryDisplay().workArea
  const paw = new BrowserWindow({
    title: PAW_TITLE,
    width: SIZE,
    height: SIZE,
    x: area.x + area.width - SIZE - 8,
    y: Math.round(area.y + area.height * 0.45),
    frame: false,
    transparent: true,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/paw.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  paw.setAlwaysOnTop(true, 'screen-saver')
  paw.webContents.on('will-navigate', (e) => e.preventDefault())
  paw.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // IPC allowlist: the only channel, and only from the paw itself.
  ipcMain.on('pupchat:paw-click', (e) => {
    if (e.sender === paw.webContents) onToggle()
  })

  if (process.env['ELECTRON_RENDERER_URL'])
    void paw.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/paw.html`)
  else void paw.loadFile(join(import.meta.dirname, '../renderer/paw.html'))
  if (showAtStart) paw.once('ready-to-show', () => paw.showInactive())
  return paw
}
