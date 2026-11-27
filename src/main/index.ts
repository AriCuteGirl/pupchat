import { app, BrowserWindow, dialog, ipcMain, screen, type WebContents } from 'electron'
import { readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'
import { join } from 'node:path'
import { CH } from '../shared/ipc'
import { windowWidth } from '../shared/layout'
import { totalUnread } from './badge'
import { isCliCommand, parseCli, type CliCommand } from './cli'
import { isHyprland, placeBanner, placePanel, placePaw, pupMonitorName, SPECIAL, workspaceOf } from './hyprland'
import { Panel } from './panel'
import { createPaw, PAW_TITLE } from './paw'
import { OverlayPaw, overlayPawAvailable } from './overlayPaw'
import { resourcePath } from './tray'
import { setLaunchAtLogin } from './autostart'
import { BANNER_SIZE, BANNER_TITLE, Banners, safeIcon } from './banners'
import { loadSettings, makeSaver } from './settings'
import { Shell, SERVICE_IDS } from './shell'
import { FIND_TOP_CHAT_AVATAR, grabAvatar } from './pins'
import { PupTray } from './tray'
import { activeWorkArea, glassWindowOptions, setGlobalHotkey } from './platform'

const PANEL_TITLE = 'PupChat'

app.setName('PupChat')

// Single instance: a second launch hands its parsed flags to us and exits.
const launch = parseCli(process.argv)
if (!app.requestSingleInstanceLock(launch as unknown as Record<string, unknown>)) {
  app.quit()
} else {
  void app.whenReady().then(start)
}

/** Files Quickshell must read from disk: outside app.asar when packaged. */
function unpacked(p: string): string {
  return p.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
}

async function start(): Promise<void> {
  const settingsFile = join(app.getPath('userData'), 'settings.json')
  const settings = loadSettings(settingsFile, SERVICE_IDS)
  const save = makeSaver(settingsFile, SERVICE_IDS)
  const area = screen.getPrimaryDisplay().workArea
  const width = windowWidth(settings.panelWidth, settings.collapsed)
  const win = new BrowserWindow({
    title: PANEL_TITLE,
    width,
    height: area.height,
    x: settings.side === 'left' ? area.x : area.x + area.width - width,
    y: area.y,
    frame: false,
    ...glassWindowOptions(),
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/shell.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  // Keep our title so Hyprland rules and our own lookups can find the window.
  win.on('page-title-updated', (e) => e.preventDefault())
  // Without a compositor that places us (Windows, other desktops): stay above games.
  if (!isHyprland()) win.setAlwaysOnTop(true, 'screen-saver')
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // Our own UI's errors go to the terminal (service pages' consoles are not logged).
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') console.warn(`[shell ${e.level}] ${e.message}`)
  })

  // Keys handled before the page sees them, in the shell and in every service view.
  // Esc hides the panel only from PupChat's own UI: inside a site it belongs to the site
  // (closing GIF/sticker pickers, menus, image viewers).
  const keys = (wc: WebContents): void => {
    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return
      const plain = !input.control && !input.alt && !input.meta && !input.shift
      const ownUi = wc === win.webContents || wc.getURL().startsWith('file:') || wc.getURL().includes('/paw.html')
      if (input.key === 'Escape' && plain && ownUi) {
        e.preventDefault()
        void panel?.hide()
      } else if (input.control && input.shift && !input.alt && input.key.toLowerCase() === 'b') {
        e.preventDefault()
        shell?.setCollapsed(!shell.isCollapsed)
      } else if (input.control && !input.alt && ['Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract', 'Digit0', 'Numpad0'].includes(input.code) && wc !== win.webContents) {
        // Zoom the platform you're in; remembered per platform.
        e.preventDefault()
        shell?.zoomActive(input.code.includes('0') ? 0 : input.code === 'Minus' || input.code === 'NumpadSubtract' ? -1 : 1)
      } else if (input.control && !input.shift && !input.alt && /^Digit[1-9]$/.test(input.code)) {
        // Ctrl+1..9 by key position, so it also works on the CZ layout (+ěščř…).
        e.preventDefault()
        shell?.selectIndex(Number(input.code.slice(5)) - 1)
      }
    })
  }
  keys(win.webContents)
  // Every web contents created from now on (service views, paw) gets the same keys.
  app.on('web-contents-created', (_e, wc) => keys(wc))

  // Registered before any service view exists, so every view gets the keys.
  let panel: Panel | null = null
  const shell: Shell = new Shell(win, settings, save)

  if (process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  await new Promise<void>((r) => win.once('ready-to-show', () => r()))

  // On Hyprland the window rule may already have put us on special:pupchat.
  let mode: 'special' | 'window' = 'window'
  if (isHyprland()) {
    win.showInactive()
    await new Promise((r) => setTimeout(r, 300))
    const ws = await workspaceOf(process.pid, PANEL_TITLE).catch(() => null)
    if (ws === `special:${SPECIAL}`) mode = 'special'
    else win.hide()
    console.log(`[pupchat] window on workspace ${ws ?? '?'}, using "${mode}" mode`)
  }
  const p = new Panel(win, mode)
  panel = p
  shell.isPanelVisible = () => p.isVisible

  // Flush to the right edge, full height. Calls are coalesced: while one placement runs,
  // only the newest request waits (dragging the edge sends many).
  let placing = false
  let placeAgain = false
  const place = (): void => {
    if (placing) {
      placeAgain = true
      return
    }
    placing = true
    const w = windowWidth(shell.panelWidth, shell.isCollapsed)
    const done = (): void => {
      placing = false
      if (placeAgain) {
        placeAgain = false
        place()
      }
    }
    if (isHyprland()) {
      placePanel(PANEL_TITLE, w, shell.current.side)
        .catch((e) => console.warn('[pupchat] place:', e))
        .finally(done)
    } else {
      const wa = p.isVisible ? screen.getDisplayMatching(win.getBounds()).workArea : activeWorkArea()
      const x = shell.current.side === 'left' ? wa.x : wa.x + wa.width - w
      win.setBounds({ x, y: wa.y, width: w, height: wa.height })
      done()
    }
  }
  // Window mode: open on the monitor the mouse is on.
  p.beforeShow = place
  let lastW = windowWidth(shell.panelWidth, shell.isCollapsed)
  shell.onState((s) => {
    const w = windowWidth(s.panelWidth, s.collapsed)
    if (w !== lastW) {
      lastW = w
      place()
    }
  })

  // Focus the chat when the panel appears, so you can type right away.
  const focusChat = (): void => shell.activeView()?.webContents.focus()
  win.on('focus', focusChat)
  p.onChange((v) => {
    if (!v) return
    place()
    focusChat()
  })

  // The paw stays visible: on the screen edge when closed, beside the panel when open,
  // so one click opens and the next click slides the panel away again.
  // On Hyprland with Quickshell the paw is an overlay layer, visible even over fullscreen
  // games; otherwise (or if Quickshell stops) PupChat's own paw window.
  let overlay: OverlayPaw | null = overlayPawAvailable()
    ? new OverlayPaw(unpacked(resourcePath('quickshell', 'paw')), () => {
        overlay = null
        paw.showInactive()
        placeTheWholeEdge()
      })
    : null
  const paw = createPaw(() => void p.toggleFromPaw(), overlay === null)
  const unreadTotal = (): number => totalUnread(shell.state().services.map((x) => x.unread))
  const overlayState = async (): Promise<import('./overlayPaw').OverlayPawState> => ({
    monitor: await pupMonitorName(p.homeMonitor).catch(() => ''),
    unread: unreadTotal(),
    open: p.isVisible,
    side: shell.current.side,
    panelWidth: windowWidth(shell.panelWidth, shell.isCollapsed),
    top: 0.45,
    icon: unpacked(resourcePath('tray', 'paw.svg'))
  })
  const placeTheWholeEdge = (): void => {
    const w = windowWidth(shell.panelWidth, shell.isCollapsed)
    const side = shell.current.side
    if (overlay) {
      void overlayState().then((st) => overlay?.write(st))
      return
    }
    if (isHyprland()) void placePaw(PAW_TITLE, p.isVisible, w, p.homeMonitor, side).catch(() => {})
    else {
      const wa = screen.getDisplayMatching(win.getBounds()).workArea
      const x =
        side === 'right'
          ? p.isVisible ? wa.x + wa.width - w - 62 : wa.x + wa.width - 64
          : p.isVisible ? wa.x + w + 6 : wa.x + 8
      paw.setPosition(x, Math.round(wa.y + wa.height * 0.45))
    }
  }
  p.onChange(placeTheWholeEdge)
  // The paw lives on the monitor you last clicked into; while the panel is open it stays beside it.
  p.onMonitorChange(() => {
    if (!p.isVisible) placeTheWholeEdge()
  })
  let lastPawWidth = -1
  shell.onState((st) => {
    const w = windowWidth(st.panelWidth, st.collapsed)
    if (w !== lastPawWidth) {
      lastPawWidth = w
      placeTheWholeEdge()
    }
    sendPawUnread(totalUnread(st.services.map((x) => x.unread)))
    if (overlay) placeTheWholeEdge() // unread count changed, maybe
  })
  if (overlay) void overlayState().then((st) => overlay?.start(st))
  app.on('will-quit', () => overlay?.stop())
  let lastTotal = -1
  const sendPawUnread = (n: number): void => {
    if (n === lastTotal || paw.isDestroyed()) return
    lastTotal = n
    paw.webContents.send(CH.pawUnread, n)
  }
  paw.webContents.on('did-finish-load', () => {
    lastTotal = -1
    sendPawUnread(totalUnread(shell.state().services.map((x) => x.unread)))
  })
  paw.once('show', placeTheWholeEdge)

  // Notification banners: the sites' own notifications, shown iMessage-style.
  const banners = new Banners({
    open: (service) => {
      shell.select(service)
      void p.show()
    },
    place: () => {
      const side = shell.current.side
      if (isHyprland()) void placeBanner(BANNER_TITLE, BANNER_SIZE, p.homeMonitor, side).catch(() => {})
      else {
        const wa = activeWorkArea()
        banners.win.setPosition(Math.round(wa.x + (wa.width - BANNER_SIZE.width) / 2), wa.y + 10)
      }
    },
    refocusPrevious: () => void p.refocusPrevious()
  })
  // When the site sent its own notification (sender + preview), remember it: the fallback
  // banner below then stays quiet for that platform.
  const lastRealNotification = new Map<string, number>()
  const bannerAllowed = (id: string): boolean => {
    const set = shell.current
    if (!set.services[id]?.notifications || set.gameMode) return false
    return !(p.isVisible && shell.activeId() === id && !shell.isSettingsOpen)
  }
  ipcMain.on('pupchat:notify', (e, raw: unknown) => {
    const svc = shell.serviceOf(e.sender)
    if (!svc || typeof raw !== 'object' || raw === null) return
    lastRealNotification.set(svc.id, Date.now())
    const r = raw as Record<string, unknown>
    const str = (v: unknown, n: number): string => (typeof v === 'string' ? v.slice(0, n) : '')
    const set = shell.current
    // Banners off for this platform, game mode, or you're already looking at it: no banner.
    if (!set.services[svc.id]?.notifications || set.gameMode) return
    if (p.isVisible && shell.activeId() === svc.id && !shell.isSettingsOpen) return
    banners.push({
      silent: Boolean(set.services[svc.id]?.muted),
      service: svc.id,
      name: svc.name,
      title: str(r['title'], 120) || svc.name,
      body: str(r['body'], 400),
      icon: safeIcon(str(r['icon'], 300_000)),
      notifId: typeof r['id'] === 'number' && Number.isInteger(r['id']) ? r['id'] : -1,
      pageId: e.sender.id
    })
  })
  // Fallback: the badge went up but the site sent no notification of its own (Instagram
  // relies on browser push, which apps don't get). Show a banner without content.
  const FALLBACK_WAIT_MS = 3000
  shell.onUnreadGrowth((id, name, added) => {
    const at = Date.now()
    setTimeout(async () => {
      if ((lastRealNotification.get(id) ?? 0) >= at - 500) return
      if (!bannerAllowed(id)) return
      // Instagram: show who wrote via the newest chat's avatar (its page has no names when narrow).
      const page = id === 'instagram' ? shell.pageOf(id) : null
      const icon = page ? safeIcon(await grabAvatar(page, FIND_TOP_CHAT_AVATAR)) : ''
      banners.push({
        silent: Boolean(shell.current.services[id]?.muted),
        service: id,
        name,
        title: added === 1 ? 'New message' : `${added} new messages`,
        body: '',
        icon,
        notifId: -1,
        pageId: -1
      })
    }, FALLBACK_WAIT_MS)
  })

  // Opening PupChat on a platform clears its waiting banners.
  p.onChange((v) => v && banners.clear(shell.activeId()))

  // Tray icon: show/hide, game mode, mute, settings, quit.
  const tray = new PupTray({
    isVisible: () => p.isVisible,
    toggle: () => void p.toggle(),
    openSettings: () => run({ action: 'settings', service: null }),
    settings: () => shell.current,
    update: (patch) => shell.updateSettings(patch)
  })
  const unreadNow = (): number => totalUnread(shell.state().services.map((x) => x.unread))
  let trayKey = ''
  shell.onState((st) => {
    const key = JSON.stringify([st.settings.gameMode, st.settings.order, st.settings.services, unreadNow()])
    if (key !== trayKey) {
      trayKey = key
      tray.refresh(unreadNow())
    }
  })
  p.onChange(() => tray.refresh(unreadNow()))

  // Global show/hide shortcut (Windows, X11). Hyprland binds its own key.
  const applyHotkey = (): void => {
    const ok = setGlobalHotkey(shell.current.windowsHotkey, () => void p.toggle())
    shell.setHotkeyProblem(!ok)
  }
  applyHotkey()

  // Banner sound: read the chosen file once into memory (≤ 2 MB) and hand it to the banner.
  const SOUND_MIME: Record<string, string> = {
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
    '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.webm': 'audio/webm'
  }
  let soundData = ''
  const loadSound = (preview = false): void => {
    const path = shell.current.bannerSound
    soundData = ''
    if (path) {
      try {
        if (statSync(path).size <= 2_000_000)
          soundData = `data:${SOUND_MIME[extname(path).toLowerCase()] ?? 'audio/mpeg'};base64,${readFileSync(path).toString('base64')}`
      } catch (e) {
        console.warn('[pupchat] banner sound:', e instanceof Error ? e.message : e)
      }
    }
    void banners.setSound(soundData, shell.current.bannerVolume, preview)
  }
  loadSound()
  ipcMain.on(CH.chooseSound, (e) => {
    if (e.sender !== win.webContents) return
    void dialog
      .showOpenDialog(win, {
        title: 'Banner sound',
        properties: ['openFile'],
        filters: [{ name: 'Audio', extensions: ['mp3', 'ogg', 'oga', 'opus', 'wav', 'm4a', 'aac', 'flac', 'webm'] }]
      })
      .then((r) => {
        if (!r.canceled && r.filePaths[0]) shell.updateSettings({ bannerSound: r.filePaths[0] })
      })
  })
  ipcMain.on(CH.previewSound, (e) => {
    if (e.sender === win.webContents) void banners.setSound(soundData, shell.current.bannerVolume, true)
  })

  // Settings that act outside the shell.
  p.onChange(() => {
    shell.applyAudio() // game mode: quiet while hidden
    shell.syncVisibility() // pages count as background tabs while the panel is hidden
  })
  p.onOtherWindowFocused(() => {
    if (shell.current.hideOnBlur && p.isVisible) void p.hide()
  })
  shell.onSettings((s, prev) => {
    if (s.side !== prev.side) {
      place()
      placeTheWholeEdge()
    }
    if (s.gameMode && !prev.gameMode) banners.clear()
    if (s.windowsHotkey !== prev.windowsHotkey) applyHotkey()
    if (s.bannerSound !== prev.bannerSound) loadSound(Boolean(s.bannerSound))
    else if (s.bannerVolume !== prev.bannerVolume) void banners.setSound(soundData, s.bannerVolume)
    if (s.launchAtLogin !== prev.launchAtLogin) {
      try {
        setLaunchAtLogin(s.launchAtLogin)
      } catch (e) {
        console.warn('[pupchat] launch at login:', e)
      }
    }
  })

  const run = (cmd: CliCommand): void => {
    if (cmd.service) shell.select(cmd.service)
    if (cmd.action === 'toggle') void p.toggle()
    else if (cmd.action === 'show') void p.show()
    else if (cmd.action === 'hide') void p.hide()
    else if (cmd.action === 'quit') app.quit()
    else if (cmd.action === 'settings') {
      shell.setSettingsOpen(true)
      void p.show()
    }
  }
  app.on('second-instance', (_e, _argv, _cwd, data) => {
    if (isCliCommand(data)) run(data)
  })
  run(launch.action ? launch : { action: 'show', service: null })

  // Quit properly: let every platform page close itself first (keeps Discord logged in).
  let closing = false
  app.on('before-quit', (e) => {
    if (closing) return
    closing = true
    e.preventDefault()
    void shell.closeAll().finally(() => app.quit())
  })
  // kill, logout and reboot send these: take the same careful path.
  for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) process.on(sig, () => app.quit())
}

app.on('window-all-closed', () => app.quit())
