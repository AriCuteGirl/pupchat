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
 * Follows Hyprland's event socket so we know when our special workspace opens/closes,
 * no matter whether the keybind, the CLI or the paw toggled it.
 */
export function watchSpecial(onChange: (open: boolean) => void): Socket | null {
  const sig = process.env['HYPRLAND_INSTANCE_SIGNATURE']
  const runtime = process.env['XDG_RUNTIME_DIR']
  if (!sig || !runtime) return null
  const sock = createConnection(join(runtime, 'hypr', sig, '.socket2.sock'))
  let buf = ''
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8')
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl)
      buf = buf.slice(nl + 1)
      // activespecial>>WORKSPACENAME,MONITOR  (empty name = closed on that monitor)
      if (line.startsWith('activespecial>>')) {
        const name = line.slice('activespecial>>'.length).split(',')[0] ?? ''
        if (name === `special:${SPECIAL}`) onChange(true)
        else void isSpecialOpen().then(onChange, () => {})
      }
    }
  })
  sock.on('error', (e) => console.warn('[hyprland] event socket:', e.message))
  return sock
}
