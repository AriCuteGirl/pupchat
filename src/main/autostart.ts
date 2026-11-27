import { app } from 'electron'
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Desktop-entry quoting: wrap in double quotes, escape \\ " ` $ (XDG spec). */
function quote(arg: string): string {
  return `"${arg.replace(/[\\"`$]/g, (c) => `\\${c}`)}"`
}

/** The command that starts this PupChat, hidden. Packaged: the binary; dev: electron + app dir. */
export function launchCommand(): string {
  const args = app.isPackaged ? [process.execPath] : [process.execPath, app.getAppPath()]
  return [...args.map(quote), '--hide'].join(' ')
}

function autostartFile(): string {
  const base = process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config')
  return join(base, 'autostart', 'pupchat.desktop')
}

/**
 * Launch at login. Linux: an XDG autostart entry (your session starts ~/.config/autostart).
 * Windows: the login item. The entry starts PupChat hidden, the paw shows it.
 */
export function setLaunchAtLogin(on: boolean): void {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: on, args: ['--hide'] })
    return
  }
  const file = autostartFile()
  if (!on) {
    if (existsSync(file)) rmSync(file)
    return
  }
  mkdirSync(join(file, '..'), { recursive: true })
  const entry = [
    '[Desktop Entry]',
    '# Managed by PupChat (Settings > Launch at login)',
    'Type=Application',
    'Name=PupChat',
    'Comment=Chat overlay for gaming',
    `Exec=${launchCommand()}`,
    'Icon=pupchat',
    'Terminal=false',
    'NoDisplay=true',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
  const tmp = `${file}.tmp`
  writeFileSync(tmp, entry)
  renameSync(tmp, file)
}
