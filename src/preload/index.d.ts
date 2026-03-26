import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      importDocument: () => Promise<{
        title: string
        content: string
        rawData?: Uint8Array
        extension?: string
      } | null>
    }
  }
}

