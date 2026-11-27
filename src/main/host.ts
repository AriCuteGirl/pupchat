import { existsSync } from 'node:fs'

/** Running inside a Flatpak sandbox? Then host tools (hyprctl, quickshell) need flatpak-spawn. */
export const inFlatpak = Boolean(process.env['FLATPAK_ID']) || existsSync('/.flatpak-info')

/**
 * Command + args to run a tool on the host. Inside Flatpak this goes through
 * `flatpak-spawn --host` (the manifest allows talking to org.freedesktop.Flatpak for this);
 * `watchBus` ends the host process when PupChat exits.
 */
export function hostCommand(
  cmd: string,
  args: string[],
  watchBus = false,
  env: Record<string, string> = {}
): [string, string[]] {
  if (!inFlatpak) return [cmd, args]
  // flatpak-spawn doesn't pass our environment to the host process: hand over what it needs.
  const envArgs = Object.entries(env).map(([k, v]) => `--env=${k}=${v}`)
  return ['flatpak-spawn', ['--host', ...(watchBus ? ['--watch-bus'] : []), ...envArgs, cmd, ...args]]
}
