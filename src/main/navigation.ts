import type { ServiceDef } from '../shared/services'

/** True when `url` is https and on one of the service's own hosts. */
export function isServiceUrl(service: ServiceDef, url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  return service.hosts.some((h) =>
    h.startsWith('.') ? host === h.slice(1) || host.endsWith(h) : host === h
  )
}

/** Only plain web links may leave the app for the default browser. */
export function isExternalSafe(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}
