const { contextBridge, ipcRenderer } = require('electron');

const toolApi = {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getConfig: () => ipcRenderer.invoke('app:get-config'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  getUpdateStatus: () => ipcRenderer.invoke('update:status'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update:status', (_event, status) => callback(status));
  },
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  getCurrentUser: (token) => ipcRenderer.invoke('auth:me', token),
  getRouterQuota: (token) => ipcRenderer.invoke('admin:router-quota', token),
  getAdminDashboard: () => ipcRenderer.invoke('admin:dashboard'),
  createMemberUser: (member) => ipcRenderer.invoke('admin:create-user', member),
  updateMemberUser: (payload) => ipcRenderer.invoke('admin:update-user', payload),
  generateImage: (config) => ipcRenderer.invoke('image:generate', config),
  saveImageDataUrl: (config) => ipcRenderer.invoke('image:save-data-url', config),
  cancelImage: (requestId) => ipcRenderer.invoke('image:cancel', requestId),
  selectOutputDir: () => ipcRenderer.invoke('dialog:select-output-dir'),
  writeBatchManifest: (config) => ipcRenderer.invoke('batch:write-manifest', config)
};

contextBridge.exposeInMainWorld('toolApi', toolApi);
