const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('toolApi', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getConfig: () => ipcRenderer.invoke('app:get-config'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  getUpdateStatus: () => ipcRenderer.invoke('update:status'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update:status', (_event, status) => callback(status));
  },
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  getCurrentUser: (token) => ipcRenderer.invoke('auth:me', token),
  getAdminDashboard: () => ipcRenderer.invoke('admin:dashboard'),
  createMemberUser: (member) => ipcRenderer.invoke('admin:create-user', member),
  updateMemberUser: (payload) => ipcRenderer.invoke('admin:update-user', payload),
  generateImage: (config) => ipcRenderer.invoke('image:generate', config),
  cancelImage: (requestId) => ipcRenderer.invoke('image:cancel', requestId),
  selectOutputDir: () => ipcRenderer.invoke('dialog:select-output-dir'),
  writeBatchManifest: (config) => ipcRenderer.invoke('batch:write-manifest', config)
});
