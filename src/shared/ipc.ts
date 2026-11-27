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
  services: ServiceState[]
  active: string
  collapsed: boolean
}

/** The only channels the shell may use. */
export const CH = {
  state: 'pupchat:state',
  getState: 'pupchat:get-state',
  select: 'pupchat:select',
  setCollapsed: 'pupchat:set-collapsed',
  retry: 'pupchat:retry',
  pawUnread: 'pupchat:paw-unread'
} as const

export interface ShellApi {
  getState(): Promise<ShellState>
  onState(fn: (s: ShellState) => void): () => void
  select(id: string): void
  setCollapsed(collapsed: boolean): void
  retry(id: string): void
}
