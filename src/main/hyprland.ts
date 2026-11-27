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

export function toggleSpecial(): Promise<string> {
  return hyprctl(['dispatch', `hl.dsp.workspace.toggle_special("${SPECIAL}")`])
}

/** Special workspaces open without focusing anything; focus our panel so typing works at once. */
export function focusPanel(title: string): Promise<string> {
  const re = `^(${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})$`
  return hyprctl(['dispatch', `hl.dsp.focus({ window = "title:${re}" })`])
}

interface Monitor {
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
  /** Right edge of the usable area, and the vertical spot for the paw. */
  right: number
  pawY: number
}

const PAW = 56

async function edgeGeometry(width: number): Promise<EdgeGeometry | null> {
  const monitors = JSON.parse(await hyprctl(['-j', 'monitors'])) as Monitor[]
  const m =
    monitors.find((x) => x.specialWorkspace?.name === `special:${SPECIAL}`) ??
    monitors.find((x) => x.focused) ??
    monitors[0]
  if (!m) return null
  const [, top, rightRes, bottom] = m.reserved
  const w = Math.round(m.width / m.scale)
  const h = Math.round(m.height / m.scale)
  const right = m.x + w - rightRes
  const height = h - top - bottom
  return {
    panel: { x: right - width, y: m.y + top, width, height },
    right,
    pawY: Math.round(m.y + top + height * 0.45)
  }
}

function sel(title: string): string {
  return `title:^(${title})$`
}

/** Re-applied on every open, so a drag never sticks. */
export async function placePanel(title: string, width: number): Promise<void> {
  const g = await edgeGeometry(width)
  if (!g) return
  const { x, y, width: w, height } = g.panel
  await hyprctl(['dispatch', `hl.dsp.window.resize({ x = ${w}, y = ${height}, relative = false, window = "${sel(title)}" })`])
  await hyprctl(['dispatch', `hl.dsp.window.move({ x = ${x}, y = ${y}, relative = false, window = "${sel(title)}" })`])
}

/**
 * The paw rides along: on the screen edge while the panel is closed, against the panel's
 * left edge while it is open (Hyprland animates the move, so it slides).
 */
export async function placePaw(title: string, panelOpen: boolean, panelWidth: number): Promise<void> {
  const g = await edgeGeometry(panelWidth)
  if (!g) return
  const x = panelOpen ? g.panel.x - PAW - 6 : g.right - PAW - 8
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
  private ours = new Set<string>()

  constructor(private readonly pid: number, onSpecial: (open: boolean) => void) {
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
    const clients = JSON.parse(await hyprctl(['-j', 'clients'])) as Array<{ address: string; pid: number }>
    for (const c of clients) if (c.pid === this.pid) this.ours.add(c.address)
    if (!this.ours.has(addr)) this.lastOther = addr
  }

  /** Give focus back to the window you were in before PupChat (e.g. the game). */
  async refocusPrevious(): Promise<void> {
    if (this.lastOther)
      await hyprctl(['dispatch', `hl.dsp.focus({ window = "address:${this.lastOther}" })`]).catch(() => {})
  }
}
