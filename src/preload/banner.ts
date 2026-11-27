import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

export interface BannerData {
  service: string
  name: string
  title: string
  body: string
  /** https: or data:image URL from the site, or '' */
  icon: string
  /** More banners waiting after this one. */
  more: number
  /** Play the banner sound now (a new banner, platform not muted). */
  play: boolean
}

/** Banner bridge: receive the banner to show; report click, dismiss and hover. */
const api = {
  onShow: (fn: (b: BannerData) => void): void => {
    ipcRenderer.on('pupchat:banner-show', (_e: IpcRendererEvent, b: BannerData) => fn(b))
  },
  /** The banner sound (data: URL or '') and its volume; 'preview' plays it once now. */
  onSound: (fn: (src: string, volume: number, preview: boolean) => void): void => {
    ipcRenderer.on('pupchat:banner-sound', (_e: IpcRendererEvent, src: unknown, volume: unknown, preview: unknown) => {
      if (typeof src === 'string' && (src === '' || src.startsWith('data:audio/')) && typeof volume === 'number')
        fn(src, Math.min(1, Math.max(0, volume)), preview === true)
    })
  },
  click: (): void => ipcRenderer.send('pupchat:banner-click'),
  dismiss: (): void => ipcRenderer.send('pupchat:banner-dismiss'),
  hover: (on: boolean): void => ipcRenderer.send('pupchat:banner-hover', on === true)
}
contextBridge.exposeInMainWorld('banner', api)
