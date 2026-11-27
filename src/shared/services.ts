/** One chat service = one official web client in its own isolated session. */
export interface ServiceDef {
  id: string
  name: string
  url: string
  /** Hosts the view may navigate to. A leading "." also matches subdomains. */
  hosts: string[]
  /** simple-icons export name for the logo (used unmodified). */
  icon: string
}

export const SERVICES: readonly ServiceDef[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    url: 'https://web.whatsapp.com',
    hosts: ['web.whatsapp.com', '.whatsapp.com', '.whatsapp.net'],
    icon: 'siWhatsapp'
  }
]

export function partitionFor(id: string): string {
  return `persist:${id}`
}
