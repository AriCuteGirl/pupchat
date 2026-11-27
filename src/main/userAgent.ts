/** The UA a real, current Chrome on this OS sends (Chrome reduces it to major.0.0.0). */
export function chromeUserAgent(chromeVersion: string, platform: NodeJS.Platform): string {
  const major = chromeVersion.split('.')[0] ?? '0'
  const os =
    platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : platform === 'darwin'
        ? 'Macintosh; Intel Mac OS X 10_15_7'
        : 'X11; Linux x86_64'
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
}
