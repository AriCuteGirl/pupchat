import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    return spawnSync('quickshell', ['--version'], { timeout: 3000 }).status === 0
  } catch {
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

  constructor(
    private readonly qmlDir: string,
    private readonly onExit: () => void
  ) {
    const dir = join(process.env['XDG_RUNTIME_DIR'] || tmpdir(), 'pupchat')
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    this.stateFile = join(dir, 'paw.json')
  }

  get running(): boolean {
    return this.child !== null
  }

  start(initial: OverlayPawState): void {
    this.write(initial)
    // A paw left over from a previous PupChat (still shutting down, or orphaned) would show
    // as a second paw: end it first. Matches only PupChat's own paw (its QML folder).
    spawnSync('pkill', ['-f', '^quickshell --path [^ ]*/quickshell/paw$'], { timeout: 3000 })
    const startedAt = Date.now()
    this.child = spawn('quickshell', ['--path', this.qmlDir], {
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
  }
}
