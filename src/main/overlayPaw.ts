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
    this.child = spawn('quickshell', ['--path', this.qmlDir, '--no-duplicate'], {
      env: { ...process.env, PUPCHAT_PAW_STATE: this.stateFile },
      stdio: ['ignore', 'ignore', 'pipe']
    })
    this.child.stderr?.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      if (/error|warn/i.test(line)) console.warn('[pupchat paw]', line.slice(0, 300))
    })
    this.child.on('exit', (code) => {
      this.child = null
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
  }
}
