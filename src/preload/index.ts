import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  importDocument: async () => {

    const result = await ipcRenderer.invoke('import-document')
    if (!result) return null


    if (result.filePath && (result.extension === 'pdf' || result.extension === 'docx' || result.extension === 'doc')) {
      const fs = require('fs/promises')
      const buffer = await fs.readFile(result.filePath)

      result.rawData = new Uint8Array(buffer)
    }

    return result
  }
}



if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {

  window.electron = electronAPI

  window.api = api
}

