import { execFile } from 'node:child_process'
import { createConnection, type Socket } from 'node:net'
import { join } from 'node:path'

export const SPECIAL = 'pupchat'

export function isHyprland(): boolean {
  return Boolean(process.env['HYPRLAND_INSTANCE_SIGNATURE'])
}

function hyprctl(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('hyprctl', args, { timeout: 3000 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout)
    )
  })
}

/** Opening/closing a special workspace also warps the cursor; do it without moving it. */
export function toggleSpecial(): Promise<string> {
  return noWarp(`hl.dispatch(hl.dsp.workspace.toggle_special("${SPECIAL}"))`)
}

/**
 * Focus a window without moving the mouse cursor. Hyprland's focus always warps the cursor,
 * so in one Lua call we switch cursor.no_warps on, focus, and put your value back.
 * Nothing in your config files changes.
 */
function noWarp(luaCall: string): Promise<string> {
  const lua =
    'local old = hl.get_config("cursor.no_warps"); ' +
    'hl.config({ cursor = { no_warps = true } }); ' +
    `${luaCall}; ` +
    'hl.config({ cursor = { no_warps = old } })'
  return hyprctl(['eval', lua])
}

function focusNoWarp(selector: string): Promise<string> {
  return noWarp(`hl.dispatch(hl.dsp.focus({ window = "${selector}" }))`)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Special workspaces open without focusing anything; focus our panel so typing works at once. */
export function focusPanel(title: string): Promise<string> {
  return focusNoWarp(`title:^(${escapeRe(title)})$`)
}

interface Monitor {
  id: number
  x: number
  y: number
  width: number
  height: number
  scale: number
  focused: boolean
  reserved: [number, number, number, number] // left, top, right, bottom
  specialWorkspace?: { name?: string }
}

export interface EdgeGeometry {
  /** Panel rect, flush to the right edge below reserved areas (e.g. the Noctalia bar). */
  panel: { x: number; y: number; width: number; height: number }
  /** Edges of the usable area, the docking side, and the vertical spot for the paw. */
  left: number
  right: number
  side: Side
  pawY: number
}

const PAW = 56

/**
 * The monitor PupChat belongs on: where the panel is open; otherwise the monitor of the
 * window you last clicked into (`homeMonitor`); otherwise Hyprland's focused monitor.
 */
export type Side = 'right' | 'left'

async function edgeGeometry(
  width: number,
  homeMonitor: number | null = null,
  side: Side = 'right'
): Promise<EdgeGeometry | null> {
  const monitors = JSON.parse(await hyprctl(['-j', 'monitors'])) as Monitor[]
  const m =
    monitors.find((x) => x.specialWorkspace?.name === `special:${SPECIAL}`) ??
    monitors.find((x) => x.id === homeMonitor) ??
    monitors.find((x) => x.focused) ??
    monitors[0]
  if (!m) return null
  const [leftRes, top, rightRes, bottom] = m.reserved
  const w = Math.round(m.width / m.scale)
  const h = Math.round(m.height / m.scale)
  const left = m.x + leftRes
  const right = m.x + w - rightRes
  const height = h - top - bottom
  return {
    panel: { x: side === 'right' ? right - width : left, y: m.y + top, width, height },
    left,
    right,
    side,
    pawY: Math.round(m.y + top + height * 0.45)
  }
}

function sel(title: string): string {
  return `title:^(${title})$`
}

/** Re-applied on every open, so a drag never sticks. */
export async function placePanel(title: string, width: number, side: Side = 'right'): Promise<void> {
  const g = await edgeGeometry(width, null, side)
  if (!g) return
  const { x, y, width: w, height } = g.panel
  await hyprctl(['dispatch', `hl.dsp.window.resize({ x = ${w}, y = ${height}, relative = false, window = "${sel(title)}" })`])
  await hyprctl(['dispatch', `hl.dsp.window.move({ x = ${x}, y = ${y}, relative = false, window = "${sel(title)}" })`])
}

/** Name of the monitor PupChat belongs on (see edgeGeometry), e.g. "DP-2". */
export async function pupMonitorName(homeMonitor: number | null): Promise<string> {
  const monitors = JSON.parse(await hyprctl(['-j', 'monitors'])) as Array<Monitor & { name: string }>
  const m =
    monitors.find((x) => x.specialWorkspace?.name === `special:${SPECIAL}`) ??
    monitors.find((x) => x.id === homeMonitor) ??
    monitors.find((x) => x.focused) ??
    monitors[0]
  return m?.name ?? ''
}

/** Banner: top center of the paw's monitor, just below reserved areas (the bar). */
export async function placeBanner(
  title: string,
  size: { width: number; height: number },
  homeMonitor: number | null,
  side: Side
): Promise<void> {
  const g = await edgeGeometry(size.width, homeMonitor, side)
  if (!g) return
  const x = Math.round((g.left + g.right - size.width) / 2)
  const y = g.panel.y + 10
  await hyprctl(['dispatch', `hl.dsp.window.move({ x = ${x}, y = ${y}, relative = false, window = "${sel(title)}" })`])
}

/**
 * The paw rides along: on the screen edge while the panel is closed, against the panel's
 * left edge while it is open (Hyprland animates the move, so it slides).
 */
export async function placePaw(
  title: string,
  panelOpen: boolean,
  panelWidth: number,
  homeMonitor: number | null,
  side: Side = 'right'
): Promise<void> {
  const g = await edgeGeometry(panelWidth, homeMonitor, side)
  if (!g) return
  const x =
    side === 'right'
      ? panelOpen
        ? g.panel.x - PAW - 6
        : g.right - PAW - 8
      : panelOpen
        ? g.panel.x + g.panel.width + 6
        : g.left + 8
  await hyprctl(['dispatch', `hl.dsp.window.move({ x = ${x}, y = ${g.pawY}, relative = false, window = "${sel(title)}" })`])
}

export async function isSpecialOpen(): Promise<boolean> {
  const monitors = JSON.parse(await hyprctl(['-j', 'monitors'])) as Array<{
    specialWorkspace?: { name?: string }
  }>
  return monitors.some((m) => m.specialWorkspace?.name === `special:${SPECIAL}`)
}

/** Workspace name of our own window (matched by pid + title), or null. */
export async function workspaceOf(pid: number, title: string): Promise<string | null> {
  const clients = JSON.parse(await hyprctl(['-j', 'clients'])) as Array<{
    pid: number
    title: string
    workspace: { name: string }
  }>
  return clients.find((c) => c.pid === pid && c.title === title)?.workspace.name ?? null
}

/**
 * Follows Hyprland's event socket so we know when our special workspace opens/closes
 * (no matter whether the keybind, the CLI or the paw toggled it), and which window
 * outside PupChat had focus last (the game), so we can hand focus back to it.
 */
export class HyprEvents {
  private lastOther: string | null = null
  /** Monitor of the window you last clicked into (outside PupChat). */
  homeMonitor: number | null = null
  private ours = new Set<string>()

  constructor(
    private readonly pid: number,
    onSpecial: (open: boolean) => void,
    private readonly onMonitor: () => void = () => {},
    private readonly onOtherFocus: () => void = () => {}
  ) {
    const sig = process.env['HYPRLAND_INSTANCE_SIGNATURE']
    const runtime = process.env['XDG_RUNTIME_DIR']
    if (!sig || !runtime) return
    const sock: Socket = createConnection(join(runtime, 'hypr', sig, '.socket2.sock'))
    let buf = ''
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8')
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        this.handle(line, onSpecial)
      }
    })
    sock.on('error', (e) => console.warn('[hyprland] event socket:', e.message))
    // Whatever had focus before we started counts as "previous" until something else does.
    void hyprctl(['-j', 'activewindow'])
      .then((out) => {
        const addr = (JSON.parse(out) as { address?: string }).address
        if (addr) return this.noteActive(addr)
      })
      .catch(() => {})
  }

  private handle(line: string, onSpecial: (open: boolean) => void): void {
    // activespecial>>WORKSPACENAME,MONITOR  (empty name = closed on that monitor)
    if (line.startsWith('activespecial>>')) {
      const name = line.slice('activespecial>>'.length).split(',')[0] ?? ''
      if (name === `special:${SPECIAL}`) onSpecial(true)
      else void isSpecialOpen().then(onSpecial, () => {})
    } else if (line.startsWith('activewindowv2>>')) {
      const addr = line.slice('activewindowv2>>'.length).trim()
      if (addr && addr !== ',') void this.noteActive(addr.startsWith('0x') ? addr : `0x${addr}`)
    }
  }

  private async noteActive(addr: string): Promise<void> {
    if (this.ours.has(addr)) return
    const clients = JSON.parse(await hyprctl(['-j', 'clients'])) as Array<{
      address: string
      pid: number
      monitor: number
    }>
    for (const c of clients) if (c.pid === this.pid) this.ours.add(c.address)
    if (this.ours.has(addr)) return
    this.lastOther = addr
    this.onOtherFocus()
    // follow_mouse = 0: focus (and so this) changes when you click into a window, not on hover.
    const mon = clients.find((c) => c.address === addr)?.monitor ?? null
    if (mon !== null && mon !== this.homeMonitor) {
      this.homeMonitor = mon
      this.onMonitor()
    }
  }

  /** Give focus back to the window you were in before PupChat (e.g. the game). */
  async refocusPrevious(): Promise<void> {
    if (this.lastOther) await focusNoWarp(`address:${this.lastOther}`).catch(() => {})
  }
}
