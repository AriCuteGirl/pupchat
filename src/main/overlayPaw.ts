import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { copyFileSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hostCommand } from './host'
import { isHyprland } from './hyprland'

/** What the Quickshell paw draws. */
export interface OverlayPawState {
  /** Monitor name to show the paw on (e.g. "DP-2"). */
  monitor: string
  unread: number
  open: boolean
  side: 'right' | 'left'
  /** Panel window width in px (the paw sits beside it while open). */
  panelWidth: number
  /** Vertical position as a fraction of the screen height. */
  top: number
  /** Absolute path of the paw icon (SVG). */
  icon: string
}

/** Hyprland with Quickshell installed: the paw can be an overlay layer above fullscreen games. */
export function overlayPawAvailable(): boolean {
  if (!isHyprland() || process.platform !== 'linux') return false
  try {
    const [cmd, args] = hostCommand('quickshell', ['--version'])
    const r = spawnSync(cmd, args, { timeout: 8000 })
    if (r.status === 0) return true
    console.warn(`[pupchat] no overlay paw: ${cmd} ${args.join(' ')} -> status ${r.status} ${r.error?.message ?? ''} ${String(r.stderr ?? '').trim().slice(0, 200)}`)
    return false
  } catch (e) {
    console.warn('[pupchat] no overlay paw:', e)
    return false
  }
}

/**
 * Runs PupChat's Quickshell paw (resources/quickshell/paw) and feeds it state through a small
 * JSON file in the runtime dir. If Quickshell exits, `onExit` lets PupChat fall back to its
 * own paw window.
 */
export class OverlayPaw {
  private child: ChildProcess | null = null
  private readonly stateFile: string
  private last = ''

  private readonly qmlDir: string
  /** The paw icon, copied next to the QML (readable by the host's Quickshell). */
  readonly iconPath: string

  /**
   * `sourceQml` / `sourceIcon`: the bundled files. They're copied to the runtime dir, which the
   * host's Quickshell can read even when PupChat runs inside Flatpak.
   */
  constructor(
    sourceQml: string,
    sourceIcon: string,
    private readonly onExit: () => void
  ) {
    const dir = join(process.env['XDG_RUNTIME_DIR'] || tmpdir(), 'pupchat')
    this.qmlDir = join(dir, 'paw')
    mkdirSync(this.qmlDir, { recursive: true, mode: 0o700 })
    copyFileSync(join(sourceQml, 'shell.qml'), join(this.qmlDir, 'shell.qml'))
    this.iconPath = join(dir, 'paw.svg')
    copyFileSync(sourceIcon, this.iconPath)
    this.stateFile = join(dir, 'paw.json')
  }

  get running(): boolean {
    return this.child !== null
  }

  start(initial: OverlayPawState): void {
    this.write(initial)
    // A paw left over from a previous PupChat (still shutting down, or orphaned) would show
    // as a second paw: end it first. Matches only PupChat's own paw (its QML folder).
    const [pk, pkArgs] = hostCommand('pkill', ['-f', '^quickshell --path [^ ]*/paw$'])
    spawnSync(pk, pkArgs, { timeout: 3000 })
    const startedAt = Date.now()
    const [qs, qsArgs] = hostCommand('quickshell', ['--path', this.qmlDir], true, { PUPCHAT_PAW_STATE: this.stateFile })
    this.child = spawn(qs, qsArgs, {
      env: { ...process.env, PUPCHAT_PAW_STATE: this.stateFile },
      stdio: ['ignore', 'ignore', 'pipe']
    })
    this.child.stderr?.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      if (/error|warn/i.test(line)) console.warn('[pupchat paw]', line.slice(0, 300))
    })
    this.child.on('exit', (code) => {
      this.child = null
      // Only a paw that ran and then crashed hands over to the built-in paw window.
      if (Date.now() - startedAt < 1500) {
        console.warn(`[pupchat] overlay paw exited right away (${code}); not falling back`)
        return
      }
      console.warn(`[pupchat] overlay paw exited (${code}); using the built-in paw`)
      this.onExit()
    })
  }

  /** Write the state if it changed (atomic: temp file + rename). */
  write(state: OverlayPawState): void {
    const json = JSON.stringify(state)
    if (json === this.last) return
    this.last = json
    writeFileSync(this.stateFile + '.tmp', json)
    renameSync(this.stateFile + '.tmp', this.stateFile)
  }

  stop(): void {
    const c = this.child
    this.child = null
    c?.removeAllListeners('exit')
    c?.kill('SIGTERM')
    // Make sure it's gone before PupChat exits, so a restart doesn't find it.
    if (c?.pid) spawnSync('sh', ['-c', `for i in 1 2 3 4 5 6 7 8 9 10; do kill -0 ${c.pid} 2>/dev/null || exit 0; sleep 0.1; done; kill -9 ${c.pid}`], { timeout: 3000 })
    const [pk, pkArgs] = hostCommand('pkill', ['-f', `^quickshell --path ${this.qmlDir}$`])
    spawnSync(pk, pkArgs, { timeout: 3000 })
  }
}
