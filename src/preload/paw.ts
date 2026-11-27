import { contextBridge, ipcRenderer } from 'electron'

/** Minimal, typed bridge for the paw: it can only say "I was clicked". */
const api = {
  click: (): void => ipcRenderer.send('pupchat:paw-click')
}
export type PawApi = typeof api
contextBridge.exposeInMainWorld('paw', api)
