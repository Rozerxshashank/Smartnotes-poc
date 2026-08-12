import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import * as chokidar from 'chokidar';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let ipcToken: string = '';
const dirtyNoteIds = new Set<string>();

// Generate token on launch
ipcToken = crypto.randomBytes(32).toString('hex');

const BACKEND_URL = 'http://127.0.0.1:8765';
const HEALTH_URL = `${BACKEND_URL}/health`;

// Default notes path. This centralizes the logic so if electron-store is used later, 
// we only update it here and pass it down.
const SMARTNOTES_DIR = process.env.SMARTNOTES_DIR || path.join(app.getPath('documents'), 'SmartNotes');

async function pollHealthCheck(timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      http.get(HEALTH_URL, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          retry();
        }
      }).on('error', () => {
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        resolve(false);
      } else {
        setTimeout(check, 1000);
      }
    };

    check();
  });
}

function spawnBackend() {
  if (process.env.SMARTNOTES_SIMULATE_BACKEND_FAILURE === 'true') {
    console.log('Simulating backend failure - skipping spawn');
    return;
  }

  const venvPython = path.join(app.getAppPath(), 'venv', process.platform === 'win32' ? 'Scripts' : 'bin', 'python');
  
  backendProcess = spawn(venvPython, ['-m', 'backend.main'], {
    cwd: app.getAppPath(),
    env: {
      ...process.env,
      IPC_TOKEN: ipcToken,
      SMARTNOTES_DIR: SMARTNOTES_DIR,
      PYTHONPATH: app.getAppPath()
    }
  });

  backendProcess.stdout?.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr?.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });
}

function createWindow(isError: boolean = false) {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Strict CSP for production
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; connect-src 'self' http://127.0.0.1:8765; style-src 'self' 'unsafe-inline'"]
        }
      });
    });
  }

  if (isError) {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/error.html'));
    return;
  }

  // Load React app
  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }
}

function setupWatcher() {
  const watcher = chokidar.watch(SMARTNOTES_DIR, {
    ignored: /(^|[\/\\])\..*|\.tmp$|\.swp$/, // ignore dotfiles and temp swap files
    persistent: true,
    ignoreInitial: true // Ignore initial add events to avoid flooding backend on startup
  });

  watcher.on('all', (event, filePath) => {
    if (!filePath.endsWith('.md')) return;
    if (['add', 'change', 'unlink'].includes(event)) {
      const payload = JSON.stringify({ 
        event, 
        path: filePath,
        dirty_note_ids: Array.from(dirtyNoteIds)
      });
      const req = http.request(`${BACKEND_URL}/api/sync/fs-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-IPC-Token': ipcToken
        }
      });
      req.on('error', (e) => {
        console.error(`[Chokidar Sync] Error: ${e.message}`);
      });
      req.on('response', (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.status === 'conflict' && data.note_id && mainWindow) {
              mainWindow.webContents.send('file-conflict', data.note_id);
            } else if (data.status === 'processed' && mainWindow) {
              mainWindow.webContents.send('sync-refresh');
            }
          } catch (e) {
            console.error('Failed to parse sync response', e);
          }
        });
      });
      req.write(payload);
      req.end();
    }
  });
}

app.whenReady().then(async () => {
  // 1. Spawn backend
  spawnBackend();

  // 2. Poll health check
  const isHealthy = await pollHealthCheck(30000);

  // 3. Create window & setup watcher (success) or show error
  if (isHealthy) {
    createWindow(false);
    setupWatcher();
  } else {
    createWindow(true);
  }

  // 4. Handle IPC
  ipcMain.handle('get-ipc-token', () => {
    return ipcToken;
  });

  ipcMain.on('set-dirty', (event, { noteId, isDirty }) => {
    if (isDirty) {
      dirtyNoteIds.add(noteId);
    } else {
      dirtyNoteIds.delete(noteId);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
