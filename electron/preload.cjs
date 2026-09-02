const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  printWindow: () => ipcRenderer.send('app:print'),
  getAppVersion: () => ipcRenderer.invoke('app:get-version')
});
