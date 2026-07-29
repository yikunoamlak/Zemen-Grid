const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zemen', {
  getState: () => ipcRenderer.invoke('state:get'),
  patchSettings: (patch) => ipcRenderer.invoke('state:patch-settings', patch),
  setNote: (iso, note) => ipcRenderer.invoke('state:set-note', iso, note),
  deleteNote: (iso) => ipcRenderer.invoke('state:delete-note', iso),
  migrateLegacy: (legacy) => ipcRenderer.invoke('state:migrate-legacy', legacy),
  showController: () => ipcRenderer.invoke('window:show-controller'),
  showWidget: (type) => ipcRenderer.invoke('window:show-widget', type),
  hideController: () => ipcRenderer.invoke('window:hide-controller'),
  openNote: (iso) => ipcRenderer.invoke('window:open-note', iso),
  closeNote: () => ipcRenderer.invoke('window:close-note'),
  fitWidget: (type, height) => ipcRenderer.invoke('window:fit-widget', type, height),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  onState(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  },
  platform: process.platform
});
