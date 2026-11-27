/**
 * Optional "iMessage look" per platform: CSS only, no scripts. It overrides the theme
 * variables the sites define themselves (found by their names), so it survives most
 * redesigns. When a site renames a variable, that part simply stops applying.
 *
 * `*` + !important: the sites set these variables on different containers (html, body,
 * theme classes); setting them everywhere wins regardless of where the site puts them.
 */

const BLUE = '#0a84ff'
const BLUE_PRESSED = '#0071e3'
const GRAY = '#3a3a3c'
const RADIUS = '18px'
const FONT = '"SF Pro Text", "Inter Variable", "Inter", -apple-system, system-ui, sans-serif'

const SKINS: Record<string, string> = {
  whatsapp: `
* {
  --outgoing-background: ${BLUE} !important;
  --WDS-systems-bubble-surface-outgoing: ${BLUE} !important;
  --incoming-background: ${GRAY} !important;
  --WDS-systems-bubble-surface-incoming: ${GRAY} !important;
  --chat-bubble-border-radius: ${RADIUS} !important;
  --bubble-meta: rgba(235, 235, 245, 0.65) !important;
  --font-family-default: ${FONT} !important;
}`,

  telegram: `
* {
  --color-background-own: ${BLUE} !important;
  --color-background-own-selected: ${BLUE_PRESSED} !important;
  --color-text-own: #ffffff !important;
  --color-text-secondary-own: rgba(255, 255, 255, 0.75) !important;
  --color-message-meta-own: rgba(255, 255, 255, 0.75) !important;
  --color-own-links: #ffffff !important;
  --color-accent-own: #ffffff !important;
  --border-radius-messages: ${RADIUS} !important;
  --font-family: ${FONT} !important;
}`,

  messenger: `
* {
  --chat-outgoing-message-bubble-background-color: ${BLUE} !important;
  --chat-incoming-message-bubble-background-color: ${GRAY} !important;
  --chat-bubble-border-radius: ${RADIUS} !important;
  --font-family-default: ${FONT} !important;
}`,

  // Instagram's --ig-* colors are "r, g, b" triples used as rgb(var(--ig-...)).
  instagram: `
* {
  --chat-outgoing-message-bubble-background-color: ${BLUE} !important;
  --chat-incoming-message-bubble-background-color: ${GRAY} !important;
  --ig-outgoing-message-bubble: 10, 132, 255 !important;
  --ig-incoming-message-bubble: 58, 58, 60 !important;
  --chat-bubble-border-radius: ${RADIUS} !important;
  --font-family-default: ${FONT} !important;
  --font-family-system: ${FONT} !important;
}`,

  // Discord has no bubbles: iMessage blue as its accent, and the font.
  discord: `
* {
  --brand-500: ${BLUE} !important;
  --font-primary: ${FONT} !important;
}`
}

export function skinCss(serviceId: string): string | null {
  return SKINS[serviceId] ?? null
}
