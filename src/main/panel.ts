import type { BrowserWindow } from 'electron'
import { focusPanel, isHyprland, isSpecialOpen, toggleSpecial, watchSpecial } from './hyprland'

/**
 * Shows/hides the chat panel. Two backends:
 * - "special": the window lives on Hyprland's special:pupchat workspace (placed there by a
 *   window rule); we toggle the workspace, Hyprland handles focus and animation.
 * - "window": plain show/hide of the window (Windows, other desktops, Hyprland without the rule).
 */
export class Panel {
  private visible = false
  private listeners: Array<(v: boolean) => void> = []

  constructor(
    private readonly win: BrowserWindow,
    readonly mode: 'special' | 'window'
  ) {
    if (mode === 'special') {
      watchSpecial((open) => {
        this.setVisible(open)
        if (open) void focusPanel(win.getTitle()).catch(() => {})
      })
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

  async toggle(): Promise<void> {
    if (this.mode === 'special') await toggleSpecial()
    else if (this.win.isVisible()) await this.hide()
    else await this.show()
  }
}
