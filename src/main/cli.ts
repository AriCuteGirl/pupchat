/** What a launch of `pupchat ...` asks the running instance to do. */
export type PanelAction = 'toggle' | 'show' | 'hide' | 'quit' | 'settings'

export interface CliCommand {
  action: PanelAction | null
  service: string | null
}

const ACTIONS: readonly PanelAction[] = ['toggle', 'show', 'hide', 'quit', 'settings']
const SERVICE_ID = /^[a-z0-9-]{1,32}$/

/**
 * Reads our own flags and ignores everything else (Chromium/Electron add theirs).
 * The last action flag wins. `--service=<id>` alone implies `show`.
 */
export function parseCli(argv: readonly string[]): CliCommand {
  let action: PanelAction | null = null
  let service: string | null = null
  for (const arg of argv) {
    const flag = arg.startsWith('--') ? arg.slice(2) : null
    if (!flag) continue
    if ((ACTIONS as readonly string[]).includes(flag)) action = flag as PanelAction
    else if (flag.startsWith('service=')) {
      const id = flag.slice('service='.length).toLowerCase()
      if (SERVICE_ID.test(id)) service = id
    }
  }
  if (service && !action) action = 'show'
  return { action, service }
}

/** Validates data that arrives from another process (second-instance additionalData). */
export function isCliCommand(v: unknown): v is CliCommand {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  const okAction = o['action'] === null || (ACTIONS as readonly unknown[]).includes(o['action'])
  const okService =
    o['service'] === null || (typeof o['service'] === 'string' && SERVICE_ID.test(o['service']))
  return okAction && okService
}
