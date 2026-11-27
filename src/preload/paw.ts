import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CH } from '../shared/ipc'

/** Minimal, typed bridge for the paw: report a click, receive the total unread count. */
const api = {
  click: (): void => ipcRenderer.send('pupchat:paw-click'),
  onUnread: (fn: (n: number) => void): void => {
    ipcRenderer.on(CH.pawUnread, (_e: IpcRendererEvent, n: unknown) => {
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) fn(n)
    })
  }
}
export type PawApi = typeof api
contextBridge.exposeInMainWorld('paw', api)
