import type { Pins } from './pins'
import type { Settings } from './settings'

/** Everything the shell UI may know. No message content, ever. */
export type ServiceStatus = 'idle' | 'loading' | 'ready' | 'error' | 'offline' | 'asleep'

export interface ServiceState {
  id: string
  name: string
  status: ServiceStatus
  /** Unread count from the page title; 'dot' = unread without a number. */
  unread: number | 'dot'
  /** The page is on the platform's login URL. */
  needsLogin: boolean
}

export interface ShellState {
  /** Enabled platforms, in list order. */
  services: ServiceState[]
  active: string
  collapsed: boolean
  /** Remembered panel width (list shown), px. */
  panelWidth: number
  /** Zoom of the active platform (1 = 100 %). */
  activeZoom: number
  settings: Settings
  settingsOpen: boolean
  /** process.platform of the main process ("linux", "win32", ...). */
  platform: string
  /** The Windows/X11 global shortcut is taken by another app. */
  hotkeyProblem: boolean
  /** Pinned chats and categories (all platforms). */
  pins: Pins
  /** The open chat on the active platform: can it be pinned, is it pinned? */
  current: { pinnable: boolean; pinnedId: string | null }
  /** The imported Discord theme, if any. */
  discordTheme: { source: string; importedAt: string; bytes: number } | null
}

export type ImportResult = { ok: true } | { ok: false; error: string }

/** The only channels the shell may use. */
export const CH = {
  state: 'pupchat:state',
  getState: 'pupchat:get-state',
  select: 'pupchat:select',
  setCollapsed: 'pupchat:set-collapsed',
  retry: 'pupchat:retry',
  setPanelWidth: 'pupchat:set-panel-width',
  resetZoom: 'pupchat:reset-zoom',
  home: 'pupchat:home',
  reload: 'pupchat:reload',
  updateSettings: 'pupchat:update-settings',
  setSettingsOpen: 'pupchat:set-settings-open',
  importDiscordTheme: 'pupchat:import-discord-theme',
  chooseSound: 'pupchat:choose-sound',
  pinCurrent: 'pupchat:pin-current',
  unpin: 'pupchat:unpin',
  openPin: 'pupchat:open-pin',
  renamePin: 'pupchat:rename-pin',
  renameCategory: 'pupchat:rename-category',
  toggleCategory: 'pupchat:toggle-category',
  pinMenu: 'pupchat:pin-menu',
  categoryMenu: 'pupchat:category-menu',
  startRename: 'pupchat:start-rename',
  previewSound: 'pupchat:preview-sound',
  pawUnread: 'pupchat:paw-unread'
} as const

export interface ShellApi {
  getState(): Promise<ShellState>
  onState(fn: (s: ShellState) => void): () => void
  select(id: string): void
  setCollapsed(collapsed: boolean): void
  retry(id: string): void
  setPanelWidth(px: number): void
  resetZoom(): void
  /** Back to the platform's start page (way out of a stuck or wrong page). */
  home(id: string): void
  reload(id: string): void
  /** Partial settings; main validates and applies them. */
  updateSettings(patch: Partial<Settings>): void
  setSettingsOpen(open: boolean): void
  /** Import the themes enabled in Equicord for PupChat's Discord. */
  importDiscordTheme(): Promise<ImportResult>
  /** Pick an audio file for the banner sound (file dialog). */
  chooseSound(): void
  /** Play the banner sound once. */
  previewSound(): void
  /** Pin the open chat (or unpin it if it's pinned). */
  pinCurrent(): void
  unpin(id: string): void
  openPin(id: string): void
  renamePin(id: string, name: string): void
  renameCategory(id: string, name: string): void
  toggleCategory(id: string): void
  /** Right-click menus (native). */
  pinMenu(id: string): void
  categoryMenu(id: string): void
  /** Main asks the UI to start inline renaming (after "Rename…" in a menu). */
  onStartRename(fn: (r: { kind: 'pin' | 'category'; id: string }) => void): void
}
