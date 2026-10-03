const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    notify: (title, body) =>
        ipcRenderer.send('show-notification', { title: String(title), body: String(body) }),
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    toggleMaximizeWindow: () => ipcRenderer.send('window-toggle-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
});