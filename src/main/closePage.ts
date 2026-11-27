import type { WebContents } from 'electron'

/**
 * Close a platform page the way a browser tab closes: its beforeunload/unload handlers run
 * first. Some sites (Discord) write the login back to storage only then, so skipping this
 * logs you out. Then flush the session's storage to disk.
 * Resolves when the page is gone, or after `timeoutMs` (then it's destroyed).
 */
export function closePageGracefully(wc: WebContents, timeoutMs = 3000): Promise<void> {
  if (wc.isDestroyed()) return Promise.resolve()
  const ses = wc.session
  return new Promise<void>((resolve) => {
    let finished = false
    const finish = (): void => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      ses.flushStorageData()
      resolve()
    }
    const timer = setTimeout(() => {
      // The page didn't close by itself (e.g. its beforeunload asked to stay): close it anyway.
      if (!wc.isDestroyed()) wc.close()
      setTimeout(finish, 200)
    }, timeoutMs)
    wc.once('destroyed', finish)
    // A beforeunload "are you sure?" prompt would block; we always leave.
    wc.once('will-prevent-unload', (e) => e.preventDefault())
    wc.close({ waitForBeforeUnload: true })
  })
}
