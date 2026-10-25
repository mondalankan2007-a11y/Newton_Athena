const { app, BrowserWindow, session, desktopCapturer, systemPreferences, shell, ipcMain } = require('electron');
const path = require('path');

// Detect if running in development (Vite dev server) or production (built files)
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Newton Athena — Technical Assessment',
    backgroundColor: '#0f1117',
    webPreferences: {
      // Security: context isolation ON, Node integration OFF
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    // Load the Vite dev server during development
    win.loadURL('http://localhost:5173');
    // Uncomment the next line to open DevTools automatically during dev
    // win.webContents.openDevTools();
  } else {
    // Load the built React app in production
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// IPC handler to query macOS screen recording status
ipcMain.handle('get-screen-access-status', () => {
  if (process.platform === 'darwin' && systemPreferences && systemPreferences.getMediaAccessStatus) {
    try {
      return systemPreferences.getMediaAccessStatus('screen');
    } catch (e) {
      return 'unknown';
    }
  }
  return 'granted';
});

// IPC handler to open macOS System Settings -> Screen Recording pane
ipcMain.handle('open-screen-security-settings', async () => {
  if (process.platform === 'darwin') {
    try {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
      return true;
    } catch (e) {
      console.warn('Failed to open security settings:', e);
      return false;
    }
  }
  return false;
});

app.whenReady().then(() => {
  // Handle media and screen capture permission requests securely
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'display-capture') {
      callback(true);
      return;
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'display-capture') {
      return true;
    }
    return false;
  });

  // Handle standard navigator.mediaDevices.getDisplayMedia() in Electron 33+
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      let sources = null;
      try {
        // First attempt: lightweight screen capture without thumbnail overhead
        sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 0, height: 0 },
        });
      } catch (screenErr) {
        // Fallback attempt: screen + window
        sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 150, height: 150 },
        });
      }

      if (!sources || sources.length === 0) {
        callback(null);
        return;
      }

      callback({ video: sources[0] });
    } catch (err) {
      console.warn('desktopCapturer error:', err?.message || err);
      // Deny gracefully by passing null (NEVER pass { video: null } as it throws TypeError)
      callback(null);
    }
  });

  createWindow();

  // macOS: re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit the app when all windows are closed (Windows / Linux behaviour)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
