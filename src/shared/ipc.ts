/** Everything the shell UI may know. No message content, ever. */
export type ServiceStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ServiceState {
  id: string
  name: string
  status: ServiceStatus
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
  retry: 'pupchat:retry'
} as const

export interface ShellApi {
  getState(): Promise<ShellState>
  onState(fn: (s: ShellState) => void): () => void
  select(id: string): void
  setCollapsed(collapsed: boolean): void
  retry(id: string): void
}
