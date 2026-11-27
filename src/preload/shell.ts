import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CH, type ImportResult, type ShellApi, type ShellState } from '../shared/ipc'

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
  reload: (id) => ipcRenderer.send(CH.reload, id),
  updateSettings: (patch) => ipcRenderer.send(CH.updateSettings, patch),
  setSettingsOpen: (open) => ipcRenderer.send(CH.setSettingsOpen, open),
  importDiscordTheme: () => ipcRenderer.invoke(CH.importDiscordTheme) as Promise<ImportResult>,
  chooseSound: () => ipcRenderer.send(CH.chooseSound),
  previewSound: () => ipcRenderer.send(CH.previewSound),
  pinCurrent: () => ipcRenderer.send(CH.pinCurrent),
  unpin: (id) => ipcRenderer.send(CH.unpin, id),
  openPin: (id) => ipcRenderer.send(CH.openPin, id),
  renamePin: (id, name) => ipcRenderer.send(CH.renamePin, id, name),
  renameCategory: (id, name) => ipcRenderer.send(CH.renameCategory, id, name),
  toggleCategory: (id) => ipcRenderer.send(CH.toggleCategory, id),
  pinMenu: (id) => ipcRenderer.send(CH.pinMenu, id),
  categoryMenu: (id) => ipcRenderer.send(CH.categoryMenu, id),
  addCategory: (service) => ipcRenderer.send(CH.addCategory, service),
  onStartRename: (fn) => {
    ipcRenderer.on(CH.startRename, (_e: IpcRendererEvent, r: { kind: 'pin' | 'category'; id: string }) => fn(r))
  }
}
contextBridge.exposeInMainWorld('pupchat', api)
