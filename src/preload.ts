import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('smartnotes', {
  getIpcToken: () => ipcRenderer.invoke('get-ipc-token'),
  setDirty: (noteId: string, isDirty: boolean) => ipcRenderer.send('set-dirty', { noteId, isDirty }),
  onFileConflict: (callback: (noteId: string) => void) => {
    ipcRenderer.on('file-conflict', (_event, noteId) => callback(noteId));
  },
  onSyncRefresh: (callback: () => void) => {
    ipcRenderer.on('sync-refresh', () => callback());
  }
});
