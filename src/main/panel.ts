import type { BrowserWindow } from 'electron'
import { focusPanel, HyprEvents, isHyprland, isSpecialOpen, toggleSpecial } from './hyprland'

/**
 * Shows/hides the chat panel. Two backends:
 * - "special": the window lives on Hyprland's special:pupchat workspace (placed there by a
 *   window rule); we toggle the workspace, Hyprland handles focus and animation.
 * - "window": plain show/hide of the window (Windows, other desktops, Hyprland without the rule).
 */
export class Panel {
  private visible = false
  private listeners: Array<(v: boolean) => void> = []
  private monitorListeners: Array<() => void> = []
  private events: HyprEvents | null = null

  constructor(
    private readonly win: BrowserWindow,
    readonly mode: 'special' | 'window'
  ) {
    if (mode === 'special') {
      this.events = new HyprEvents(
        process.pid,
        (open) => {
          this.setVisible(open)
          if (open) void focusPanel(win.getTitle()).catch(() => {})
        },
        () => this.monitorListeners.forEach((fn) => fn())
      )
      void isSpecialOpen().then((o) => this.setVisible(o), () => {})
    } else {
      win.on('show', () => this.setVisible(true))
      win.on('hide', () => this.setVisible(false))
    }
  }

  get isVisible(): boolean {
    return this.visible
  }

  onChange(fn: (v: boolean) => void): void {
    this.listeners.push(fn)
  }

  /** Monitor of the window you last clicked into (Hyprland only). */
  get homeMonitor(): number | null {
    return this.events?.homeMonitor ?? null
  }

  /** You clicked into a window on another monitor (Hyprland only). */
  onMonitorChange(fn: () => void): void {
    this.monitorListeners.push(fn)
  }

  private setVisible(v: boolean): void {
    if (v === this.visible) return
    this.visible = v
    for (const fn of this.listeners) fn(v)
  }

  async show(): Promise<void> {
    if (this.mode === 'special') {
      if (!(await isSpecialOpen())) await toggleSpecial()
    } else {
      this.win.show()
      this.win.focus()
      // Wayland ignores focus requests from clients; on Hyprland ask the compositor.
      if (isHyprland()) setTimeout(() => void focusPanel(this.win.getTitle()).catch(() => {}), 100)
    }
  }

  async hide(): Promise<void> {
    if (this.mode === 'special') {
      if (await isSpecialOpen()) await toggleSpecial()
    } else {
      this.win.hide()
    }
  }

  /** For the paw: closing from a click must not leave focus on the paw. */
  async toggleFromPaw(): Promise<void> {
    const wasOpen = this.visible
    await this.toggle()
    if (wasOpen) await this.events?.refocusPrevious()
  }

  async toggle(): Promise<void> {
    if (this.mode === 'special') await toggleSpecial()
    else if (this.win.isVisible()) await this.hide()
    else await this.show()
  }
}
