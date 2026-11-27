/** One chat service = one official web client in its own isolated session. */
export interface ServiceDef {
  id: string
  name: string
  url: string
  /** Hosts the view may navigate to. A leading "." also matches subdomains. */
  hosts: string[]
  /** simple-icons export name for the logo (used unmodified). */
  icon: string
  /** URL path prefixes that mean "you're on the login page" (no page content is read). */
  loginPaths?: string[]
  /**
   * The title's "•" without a number means something low-priority here (Discord: any server
   * has unread messages). Ignore it; count only numbered unread (DMs, mentions).
   */
  ignoreDot?: boolean
}

/** Default order. Which ones are enabled, and their order, becomes a setting in step 5. */
export const SERVICES: readonly ServiceDef[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    url: 'https://web.whatsapp.com',
    hosts: ['web.whatsapp.com', '.whatsapp.com', '.whatsapp.net'],
    icon: 'siWhatsapp'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    url: 'https://www.instagram.com/direct/inbox/',
    hosts: ['.instagram.com'],
    icon: 'siInstagram',
    loginPaths: ['/accounts/login', '/accounts/emailsignup']
  },
  {
    id: 'discord',
    name: 'Discord',
    url: 'https://discord.com/app',
    hosts: ['discord.com', '.discord.com', 'discordapp.com', '.discordapp.com'],
    icon: 'siDiscord',
    loginPaths: ['/login', '/register'],
    ignoreDot: true
  },
  {
    id: 'messenger',
    name: 'Messenger',
    url: 'https://www.messenger.com',
    // Messenger signs in through Facebook.
    hosts: ['.messenger.com', '.facebook.com'],
    icon: 'siMessenger',
    loginPaths: ['/login']
  },
  {
    id: 'telegram',
    name: 'Telegram',
    url: 'https://web.telegram.org/a/',
    hosts: ['web.telegram.org', '.telegram.org'],
    icon: 'siTelegram'
  }
]

export function partitionFor(id: string): string {
  return `persist:${id}`
}
