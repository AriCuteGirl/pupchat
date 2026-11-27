import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CH, type ShellApi, type ShellState } from '../shared/ipc'

const api: ShellApi = {
  getState: () => ipcRenderer.invoke(CH.getState) as Promise<ShellState>,
  onState: (fn) => {
    const h = (_e: IpcRendererEvent, s: ShellState): void => fn(s)
    ipcRenderer.on(CH.state, h)
    return () => ipcRenderer.removeListener(CH.state, h)
  },
  select: (id) => ipcRenderer.send(CH.select, id),
  setCollapsed: (c) => ipcRenderer.send(CH.setCollapsed, c),
  retry: (id) => ipcRenderer.send(CH.retry, id),
  setPanelWidth: (px) => ipcRenderer.send(CH.setPanelWidth, px),
  resetZoom: () => ipcRenderer.send(CH.resetZoom),
  home: (id) => ipcRenderer.send(CH.home, id),
  reload: (id) => ipcRenderer.send(CH.reload, id)
}
contextBridge.exposeInMainWorld('pupchat', api)
