const { app, BrowserWindow, session } = require('electron');
const path = require('path');

// Detect if running in development (Vite dev server) or production (built files)
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Newton Athena',
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

app.whenReady().then(() => {
  // Explicitly handle media (camera) permission requests from renderer securely
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
      return;
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media') {
      return true;
    }
    return false;
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
