import { release } from 'node:os'
import { globalShortcut, screen, type BrowserWindowConstructorOptions } from 'electron'

/** Windows 11 22H2+ (build 22621) can give Electron windows real acrylic. */
export function hasAcrylic(): boolean {
  if (process.platform !== 'win32') return false
  const build = Number(release().split('.')[2] ?? 0)
  return build >= 22621
}

/**
 * Glass window options per platform. Linux: transparent window, the compositor blurs
 * (Hyprland). Windows 11: acrylic material. Windows 10 and others: transparent only,
 * PupChat's own translucent glass without blur.
 */
export function glassWindowOptions(): Partial<BrowserWindowConstructorOptions> {
  if (hasAcrylic()) return { transparent: false, backgroundColor: '#00000000', backgroundMaterial: 'acrylic' }
  return { transparent: true, backgroundColor: '#00000000' }
}

/** Where to show things when the compositor doesn't place us: the display under the mouse. */
export function activeWorkArea(): Electron.Rectangle {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
}

/**
 * Global show/hide shortcut where Electron can grab one: Windows, and Linux on X11.
 * (Hyprland binds the key itself; other Wayland desktops would need the GlobalShortcuts
 * portal, which isn't wired up because it couldn't be verified.)
 */
export function canUseGlobalShortcut(): boolean {
  if (process.platform === 'win32' || process.platform === 'darwin') return true
  return process.platform === 'linux' && process.env['XDG_SESSION_TYPE'] === 'x11'
}

let current: string | null = null

/** (Re)register the shortcut. Returns false when another app already holds it. */
export function setGlobalHotkey(accelerator: string, onPress: () => void): boolean {
  if (!canUseGlobalShortcut()) return true
  if (current === accelerator) return true
  if (current) globalShortcut.unregister(current)
  current = null
  try {
    if (globalShortcut.register(accelerator, onPress)) {
      current = accelerator
      return true
    }
  } catch (e) {
    console.warn('[pupchat] hotkey:', e)
  }
  return false
}
