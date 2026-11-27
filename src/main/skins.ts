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
  /** Your bubble color and its text, from Settings (colorsCss). */
  blue: 'var(--pup-out, #0a84ff)',
  blueText: 'var(--pup-out-text, #ffffff)',
  bluePressed: 'color-mix(in srgb, var(--pup-out, #0a84ff) 85%, black)',
  /** Their bubble color, from Settings. */
  gray: 'var(--pup-in, #3a3a3c)',
  black: '#000000',
  surface: '#1c1c1e',
  surface2: '#2c2c2e',
  border: '#38383a',
  meta: 'rgba(235, 235, 245, 0.6)',
  radius: '18px',
  pill: '20px'
}

/**
 * See-through chats: the page gets a black tint with alpha --pup-a (the "Chat glass"
 * setting, injected separately so the slider doesn't re-send the whole skin). Big
 * background containers go transparent so PupChat's blurred glass shows through.
 */
const TINT = 'rgba(0, 0, 0, var(--pup-a, 0.6))'
/** Frosted bars (headers, input area): a bit lighter than the page, blurred. */
const BAR = `background-color: rgba(28, 28, 30, calc(var(--pup-a, 0.6) * 0.6 + 0.2)) !important;
  backdrop-filter: blur(24px) saturate(160%) !important;`
const BASE_GLASS = `
html { background: ${TINT} !important; }
body { background: transparent !important; }`
/** Round blue send button. */
const SEND = `background-color: var(--pup-out, #0a84ff) !important; border-radius: 50% !important; color: var(--pup-out-text, #fff) !important;`

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
  /* See-through chat background, no doodles. */
  --WDS-systems-chat-background-wallpaper: transparent !important;
  --WDS-systems-chat-foreground-wallpaper: transparent !important;
  --app-background: transparent !important;
  --panel-background: transparent !important;
  --panel-background-deep: transparent !important;
  /* Pill input on a frosted bar. */
  --WDS-systems-chat-surface-composer: transparent !important;
  --WDS-systems-chat-surface-tray: transparent !important;
  --input-corner-radius: ${C.pill} !important;
  --panel-input-background: rgba(58, 58, 60, 0.7) !important;
  --search-input-background: rgba(58, 58, 60, 0.7) !important;
  --font-family-default: ${FONT} !important;
}
${BASE_GLASS}
#app, #app > div, #app > div > div, div.two, #side, #pane-side, #main,
[data-testid="intro-panel"], [data-testid="conversation-panel-wrapper"] {
  background-color: transparent !important;
}
#main header, #main footer, #side > header, [data-testid="chatlist-header"] { ${BAR} }
button:has(span[data-icon*="send"]) { ${SEND} }
button:has(span[data-icon*="send"]) span[data-icon] { color: var(--pup-out-text, #fff) !important; }
${FONT_EVERYWHERE}`,

  telegram: `
* {
  --color-background-own: ${C.blue} !important;
  --color-background-own-selected: ${C.bluePressed} !important;
  --color-text-own: ${C.blueText} !important;
  --color-text-secondary-own: rgba(255, 255, 255, 0.75) !important;
  --color-message-meta-own: rgba(255, 255, 255, 0.75) !important;
  --color-own-links: ${C.blueText} !important;
  --color-accent-own: ${C.blueText} !important;
  --border-radius-messages: ${C.radius} !important;
  /* Blue send button and accents, pill composer, blue selected chat. */
  --color-primary: ${C.blue} !important;
  --color-chat-active: ${C.blue} !important;
  --composer-pill-radius: ${C.pill} !important;
  --composer-control-radius: ${C.pill} !important;
  --color-borders-input: ${C.border} !important;
  --theme-background-color: transparent !important;
  --font-family: ${FONT} !important;
}
${BASE_GLASS}
#UiLoader, #Main, #LeftColumn, #LeftColumn-main, #MiddleColumn, #MiddleColumn > *, #RightColumn,
.chat-list, .messages-layout, .Transition, .Transition_slide, .left-header {
  background-color: transparent !important;
  background-image: none !important;
}
#MiddleColumn::before, #MiddleColumn::after { background: none !important; }
/* Their messages: solid gray bubbles (and tails) so text stays readable on glass. */
.Message:not(.own) { --background-color: ${C.gray} !important; --color-background: ${C.gray} !important; }
.MiddleHeader, .middle-column-footer .Composer .composer-wrapper, .left-header { ${BAR} }
.Composer .Button.send, .Composer .Button.main-button { ${SEND} }
${FONT_EVERYWHERE}`,

  messenger: `
* {
  --chat-outgoing-message-bubble-background-color: ${C.blue} !important;
  --chat-incoming-message-bubble-background-color: ${C.gray} !important;
  --chat-bubble-border-radius: ${C.radius} !important;
  --primary-button-background: ${C.blue} !important;
  --input-corner-radius: ${C.pill} !important;
  --input-background: rgba(58, 58, 60, 0.7) !important;
  --search-input-background: rgba(58, 58, 60, 0.7) !important;
  --surface-background: transparent !important;
  --messenger-card-background: transparent !important;
  --font-family-default: ${FONT} !important;
}
${BASE_GLASS}
[role="main"], [role="navigation"], [role="banner"] { background-color: transparent !important; }
${FONT_EVERYWHERE}`,

  // Instagram's --ig-* colors are "r, g, b" triples used as rgb(var(--ig-...)).
  instagram: `
* {
  --chat-outgoing-message-bubble-background-color: ${C.blue} !important;
  --chat-incoming-message-bubble-background-color: ${C.gray} !important;
  --ig-outgoing-message-bubble: var(--pup-out-rgb, 10, 132, 255) !important;
  --ig-incoming-message-bubble: var(--pup-in-rgb, 58, 58, 60) !important;
  --chat-bubble-border-radius: ${C.radius} !important;
  /* Space syntax with alpha: rgb(var(--ig-primary-background)) becomes transparent. */
  --ig-primary-background: 0 0 0 / 0 !important;
  --ig-secondary-background: 28 28 30 / 0.5 !important;
  --input-corner-radius: ${C.pill} !important;
  --input-border-radius: ${C.pill} !important;
  --ig-input-border-radius: ${C.pill} !important;
  --input-background: rgba(58, 58, 60, 0.7) !important;
  --search-input-background: rgba(58, 58, 60, 0.7) !important;
  --font-family-default: ${FONT} !important;
  --font-family-system: ${FONT} !important;
  --font-family-text: ${FONT} !important;
}
${BASE_GLASS}
[role="main"], [role="navigation"] { background-color: transparent !important; }
${FONT_EVERYWHERE}`,

  // Discord has no bubbles: iMessage blacks and blue, a pill message box, the font.
  // Discord's security policy blocks embedded fonts, so the font applies only if Inter or
  // SF Pro is installed on the system.
  discord: `
* {
  --brand-500: ${C.blue} !important;
  --chat-background: transparent !important;
  --chat-background-default: transparent !important;
  --background-base-lowest: transparent !important;
  --background-base-lower: transparent !important;
  --background-base-low: transparent !important;
  --background-primary: transparent !important;
  --background-secondary: transparent !important;
  --background-tertiary: transparent !important;
  --channeltextarea-background: rgba(58, 58, 60, 0.7) !important;
  --font-primary: ${FONT} !important;
}
${BASE_GLASS}
#app-mount, [class^="app_"], [class^="bg_"], [class*=" bg_"], [class^="chat_"], [class*=" chat_"],
main[class*="chatContent_"], nav[class*="privateChannels_"], nav[class*="guilds_"],
[class^="sidebar_"], [class*=" sidebar_"] {
  background-color: transparent !important;
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

/** Bubble colors from Settings, as variables the skins read (one tiny stylesheet). */
export function colorsCss(out: string, inc: string, outText: string, inText: string, outRgb: string, inRgb: string): string {
  const ok = (c: string): boolean => /^#[0-9a-f]{6}$/i.test(c)
  const okRgb = (c: string): boolean => /^\d{1,3}, \d{1,3}, \d{1,3}$/.test(c)
  if (![out, inc, outText, inText].every(ok) || ![outRgb, inRgb].every(okRgb)) return ''
  return (
    `html { --pup-out: ${out} !important; --pup-in: ${inc} !important; ` +
    `--pup-out-text: ${outText} !important; --pup-in-text: ${inText} !important; ` +
    `--pup-out-rgb: ${outRgb} !important; --pup-in-rgb: ${inRgb} !important; }`
  )
}

/** Chat glass: how solid the page tint is (0 = clear, 1 = solid black). */
export function glassCss(alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha))
  return `html { --pup-a: ${a.toFixed(2)} !important; }`
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
