/** Geometry shared by main (positions the service view) and the shell UI (draws around it). */
export const LAYOUT = {
  sidebarWidth: 232,
  railWidth: 68,
  headerHeight: 52,
  /** Gap around the service view inside the glass. */
  inset: 8,
  viewRadius: 16
} as const

export function sidebarWidth(collapsed: boolean): number {
  return collapsed ? LAYOUT.railWidth : LAYOUT.sidebarWidth
}

/**
 * Window width for a remembered panel width. Collapsing removes only the list,
 * so the chat keeps its width (sites like WhatsApp have a minimum page width).
 */
export function windowWidth(panelWidth: number, collapsed: boolean): number {
  return collapsed ? panelWidth - (LAYOUT.sidebarWidth - LAYOUT.railWidth) : panelWidth
}

/** Where the service's web page sits inside a window of the given size. */
export function viewBounds(
  win: { width: number; height: number },
  collapsed: boolean
): { x: number; y: number; width: number; height: number } {
  const x = sidebarWidth(collapsed)
  const y = LAYOUT.headerHeight
  return {
    x,
    y,
    width: Math.max(0, win.width - x - LAYOUT.inset),
    height: Math.max(0, win.height - y - LAYOUT.inset)
  }
}
