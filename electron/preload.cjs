const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  printHtml: (html, options) => ipcRenderer.invoke('app:print-html', { html, options }),
  getPrinters: () => ipcRenderer.invoke('app:get-printers'),
  printWindow: () => ipcRenderer.send('app:print'),
  getAppVersion: () => ipcRenderer.invoke('app:get-version')
});
