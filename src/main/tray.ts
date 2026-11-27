import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { SERVICES } from '../shared/services'
import type { Settings } from '../shared/settings'

/** Bundled resources: next to the app in dev, in resources/ when packaged. */
export function resourcePath(...parts: string[]): string {
  const base = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
  return join(base, ...parts)
}

export interface TrayDeps {
  isVisible: () => boolean
  toggle: () => void
  openSettings: () => void
  settings: () => Settings
  update: (patch: Partial<Settings>) => void
}

/** Tray icon (where the desktop has one): show/hide, game mode, per-platform mute, settings, quit. */
export class PupTray {
  private tray: Tray | null = null

  constructor(private readonly deps: TrayDeps) {
    try {
      const icon = nativeImage.createFromPath(resourcePath('tray', 'paw-32.png'))
      this.tray = new Tray(icon)
    } catch (e) {
      console.warn('[pupchat] no tray available:', e)
      return
    }
    this.tray.setToolTip('PupChat')
    this.tray.on('click', () => deps.toggle())
    this.refresh(0)
  }

  /** Rebuild the menu and tooltip (call when settings, visibility or unread change). */
  refresh(unread: number): void {
    if (!this.tray) return
    const s = this.deps.settings()
    this.tray.setToolTip(unread > 0 ? `PupChat · ${unread} unread` : 'PupChat')
    const mute = s.order
      .filter((id) => s.services[id]?.enabled)
      .map((id) => ({
        label: SERVICES.find((x) => x.id === id)?.name ?? id,
        type: 'checkbox' as const,
        checked: Boolean(s.services[id]?.muted),
        click: () => {
          const services = structuredClone(s.services)
          services[id] = { ...services[id]!, muted: !services[id]!.muted }
          this.deps.update({ services })
        }
      }))
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: this.deps.isVisible() ? 'Hide PupChat' : 'Show PupChat', click: () => this.deps.toggle() },
        { type: 'separator' },
        {
          label: 'Game mode',
          type: 'checkbox',
          checked: s.gameMode,
          click: () => this.deps.update({ gameMode: !s.gameMode })
        },
        { label: 'Mute', submenu: mute },
        { label: 'Settings…', click: () => this.deps.openSettings() },
        { type: 'separator' },
        { label: 'Quit PupChat', click: () => app.quit() }
      ])
    )
  }
}
