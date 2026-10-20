/**
 * preload.js
 *
 * Runs in a privileged context between the Electron main process and the
 * renderer (React). Because contextIsolation is true and nodeIntegration is
 * false, this is the ONLY safe place to expose selective Node/Electron APIs
 * to the renderer via contextBridge.
 *
 * Currently no APIs are exposed — this file is a ready-to-use scaffold for
 * future commits (e.g., exposing ipcRenderer channels for camera permissions,
 * screen monitoring, etc.).
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose secure APIs to the renderer under window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  appName: 'Newton Athena',
  version: '1.0.0',
  isMac: process.platform === 'darwin',
  getScreenAccessStatus: () => ipcRenderer.invoke('get-screen-access-status'),
  openScreenSecuritySettings: () => ipcRenderer.invoke('open-screen-security-settings'),
});
