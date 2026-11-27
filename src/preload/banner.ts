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
}

/** Banner bridge: receive the banner to show; report click, dismiss and hover. */
const api = {
  onShow: (fn: (b: BannerData) => void): void => {
    ipcRenderer.on('pupchat:banner-show', (_e: IpcRendererEvent, b: BannerData) => fn(b))
  },
  click: (): void => ipcRenderer.send('pupchat:banner-click'),
  dismiss: (): void => ipcRenderer.send('pupchat:banner-dismiss'),
  hover: (on: boolean): void => ipcRenderer.send('pupchat:banner-hover', on === true)
}
contextBridge.exposeInMainWorld('banner', api)
