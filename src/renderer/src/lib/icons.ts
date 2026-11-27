import { siDiscord, siInstagram, siMessenger, siTelegram, siWhatsapp } from 'simple-icons'

/** Service logos from simple-icons (CC0), used unmodified. */
const ICONS: Record<string, { path: string; hex: string }> = {
  siWhatsapp,
  siInstagram,
  siDiscord,
  siMessenger,
  siTelegram
}

export function serviceIcon(name: string): { path: string; hex: string } | undefined {
  return ICONS[name]
}
