/**
 * Optional "iMessage look" per platform: CSS only, no scripts. It overrides the theme
 * variables the sites define themselves (found by their names in a read-only check), so it
 * survives most redesigns; if a site renames a variable, that part simply stops applying.
 *
 * `*` + !important: sites set these variables on different containers (html, body, theme
 * classes); setting them everywhere wins regardless of where the site puts them.
 *
 * iMessage dark: black background, #1c1c1e surfaces, gray #3a3a3c incoming bubbles,
 * blue #0a84ff outgoing bubbles and accents, pill-shaped input, 18 px bubble radius.
 */

const C = {
  blue: '#0a84ff',
  bluePressed: '#0071e3',
  gray: '#3a3a3c',
  black: '#000000',
  surface: '#1c1c1e',
  surface2: '#2c2c2e',
  border: '#38383a',
  meta: 'rgba(235, 235, 245, 0.6)',
  radius: '18px',
  pill: '20px'
}

/** "PupInter" is embedded where the site allows it; otherwise a local Inter or SF, then system. */
const FONT = '"PupInter", "SF Pro Text", "Inter Variable", "Inter", -apple-system, system-ui, sans-serif'

/**
 * Apply the font to the page's text, not to icon fonts or code. Used on platforms whose
 * own font variables don't reach every element.
 */
const FONT_EVERYWHERE = `
body, body :where(:not(i, code, pre, kbd, samp, [class*="icon" i], [class*="emoji" i], [data-icon])) {
  font-family: ${FONT} !important;
}`

const SKINS: Record<string, string> = {
  whatsapp: `
* {
  --outgoing-background: ${C.blue} !important;
  --WDS-systems-bubble-surface-outgoing: ${C.blue} !important;
  --incoming-background: ${C.gray} !important;
  --WDS-systems-bubble-surface-incoming: ${C.gray} !important;
  --chat-bubble-border-radius: ${C.radius} !important;
  --bubble-meta: ${C.meta} !important;
  /* Black chat background, no doodles. */
  --WDS-systems-chat-background-wallpaper: ${C.black} !important;
  --WDS-systems-chat-foreground-wallpaper: transparent !important;
  /* Pill input on a dark bar. */
  --WDS-systems-chat-surface-composer: ${C.surface} !important;
  --WDS-systems-chat-surface-tray: ${C.surface} !important;
  --input-corner-radius: ${C.pill} !important;
  --panel-input-background: ${C.surface2} !important;
  --search-input-background: ${C.surface2} !important;
  --panel-background: ${C.surface} !important;
  --app-background: ${C.black} !important;
  --font-family-default: ${FONT} !important;
}
${FONT_EVERYWHERE}`,

  telegram: `
* {
  --color-background-own: ${C.blue} !important;
  --color-background-own-selected: ${C.bluePressed} !important;
  --color-text-own: #ffffff !important;
  --color-text-secondary-own: rgba(255, 255, 255, 0.75) !important;
  --color-message-meta-own: rgba(255, 255, 255, 0.75) !important;
  --color-own-links: #ffffff !important;
  --color-accent-own: #ffffff !important;
  --border-radius-messages: ${C.radius} !important;
  /* Blue send button and accents, pill composer, blue selected chat. */
  --color-primary: ${C.blue} !important;
  --color-chat-active: ${C.blue} !important;
  --composer-pill-radius: ${C.pill} !important;
  --composer-control-radius: ${C.pill} !important;
  --color-background-sidebar: ${C.surface} !important;
  --color-borders-input: ${C.border} !important;
  --font-family: ${FONT} !important;
}
${FONT_EVERYWHERE}`,

  messenger: `
* {
  --chat-outgoing-message-bubble-background-color: ${C.blue} !important;
  --chat-incoming-message-bubble-background-color: ${C.gray} !important;
  --chat-bubble-border-radius: ${C.radius} !important;
  --primary-button-background: ${C.blue} !important;
  --input-corner-radius: ${C.pill} !important;
  --input-background: ${C.surface2} !important;
  --search-input-background: ${C.surface2} !important;
  --surface-background: ${C.black} !important;
  --card-background: ${C.surface} !important;
  --messenger-card-background: ${C.surface} !important;
  --font-family-default: ${FONT} !important;
}
${FONT_EVERYWHERE}`,

  // Instagram's --ig-* colors are "r, g, b" triples used as rgb(var(--ig-...)).
  instagram: `
* {
  --chat-outgoing-message-bubble-background-color: ${C.blue} !important;
  --chat-incoming-message-bubble-background-color: ${C.gray} !important;
  --ig-outgoing-message-bubble: 10, 132, 255 !important;
  --ig-incoming-message-bubble: 58, 58, 60 !important;
  --chat-bubble-border-radius: ${C.radius} !important;
  --ig-primary-background: 0, 0, 0 !important;
  --ig-secondary-background: 28, 28, 30 !important;
  --input-corner-radius: ${C.pill} !important;
  --input-border-radius: ${C.pill} !important;
  --ig-input-border-radius: ${C.pill} !important;
  --input-background: ${C.surface2} !important;
  --search-input-background: ${C.surface2} !important;
  --font-family-default: ${FONT} !important;
  --font-family-system: ${FONT} !important;
  --font-family-text: ${FONT} !important;
}
${FONT_EVERYWHERE}`,

  // Discord has no bubbles: iMessage blacks and blue, a pill message box, the font.
  // Discord's security policy blocks embedded fonts, so the font applies only if Inter or
  // SF Pro is installed on the system.
  discord: `
* {
  --brand-500: ${C.blue} !important;
  --chat-background: ${C.black} !important;
  --chat-background-default: ${C.black} !important;
  --background-base-lowest: ${C.black} !important;
  --background-base-lower: ${C.surface} !important;
  --background-base-low: ${C.surface} !important;
  --channeltextarea-background: ${C.surface2} !important;
  --font-primary: ${FONT} !important;
}
[class*="channelTextArea_"] [class*="scrollableContainer_"] {
  border-radius: ${C.pill} !important;
}`
}

/**
 * The skin for a platform. `fontFace` is an @font-face block for "PupInter" with the font
 * embedded; pass it only for sites whose security policy allows embedded (data:) fonts.
 */
export function skinCss(serviceId: string, fontFace = ''): string | null {
  const css = SKINS[serviceId]
  if (!css) return null
  return fontFace ? `${fontFace}\n${css}` : css
}

/** Platforms whose font policy (CSP font-src) allows data: fonts, checked 2026-11-27. */
export const EMBEDDED_FONT_OK = new Set(['whatsapp', 'instagram', 'messenger', 'telegram'])

const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'

/** @font-face for "PupInter" from base64 woff2 data (Inter variable, OFL). */
export function interFontFace(latinB64: string, latinExtB64: string): string {
  const face = (b64: string, range: string): string =>
    `@font-face { font-family: "PupInter"; font-style: normal; font-display: swap; font-weight: 100 900; ` +
    `src: local("Inter Variable"), local("Inter"), url(data:font/woff2;base64,${b64}) format("woff2"); unicode-range: ${range}; }`
  return `${face(latinExtB64, LATIN_EXT)}\n${face(latinB64, LATIN)}`
}
