const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { fork } = require('child_process');

let mainWindow = null;
let serverProcess = null;
const PORT = process.env.PORT || '3000';
const SERVER_URL = `http://127.0.0.1:${PORT}`;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Configure persistent UserData directories
const userDataPath = app.getPath('userData');
const whatsappAuthDir = path.join(userDataPath, 'whatsapp_auth');
const logsDir = path.join(userDataPath, 'logs');

if (!fs.existsSync(whatsappAuthDir)) {
  fs.mkdirSync(whatsappAuthDir, { recursive: true });
}
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

process.env.WHATSAPP_AUTH_DIR = whatsappAuthDir;
process.env.PORT = PORT;

function logMessage(msg) {
  const logLine = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(path.join(logsDir, 'app.log'), logLine);
  } catch {
    // ignore
  }
  console.log(msg);
}

// Check if server is already responding
function checkServerHealth(timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_URL}/api/health`, { timeout: timeoutMs }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Wait for server with retries
async function waitForServer(maxAttempts = 40, intervalMs = 250) {
  for (let i = 0; i < maxAttempts; i++) {
    const isReady = await checkServerHealth();
    if (isReady) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// Start backend server
async function startBackendServer() {
  const isAlreadyRunning = await checkServerHealth();
  if (isAlreadyRunning) {
    logMessage('Backend server is already running on port ' + PORT);
    return;
  }

  logMessage('Starting backend server...');
  const isPackaged = app.isPackaged;
  const appPath = app.getAppPath();
  
  let serverScript;
  if (isPackaged) {
    serverScript = path.join(appPath, 'dist', 'server.cjs');
  } else {
    serverScript = path.join(appPath, 'dist', 'server.cjs');
    if (!fs.existsSync(serverScript)) {
      serverScript = path.join(appPath, 'server.ts');
    }
  }

  logMessage('Server script target: ' + serverScript);

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: isPackaged ? 'production' : (process.env.NODE_ENV || 'production'),
    WHATSAPP_AUTH_DIR: whatsappAuthDir,
    PORT: PORT
  };

  try {
    serverProcess = fork(serverScript, [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    const serverLogStream = fs.createWriteStream(path.join(logsDir, 'server.log'), { flags: 'a' });

    if (serverProcess.stdout) {
      serverProcess.stdout.pipe(serverLogStream);
      serverProcess.stdout.on('data', (d) => console.log(`[Server] ${d.toString().trim()}`));
    }
    if (serverProcess.stderr) {
      serverProcess.stderr.pipe(serverLogStream);
      serverProcess.stderr.on('data', (d) => console.error(`[Server Error] ${d.toString().trim()}`));
    }

    serverProcess.on('exit', (code, signal) => {
      logMessage(`Backend process exited with code ${code}, signal ${signal}`);
      serverProcess = null;
    });
  } catch (err) {
    logMessage('Failed to fork backend server: ' + err.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    title: 'Smart Bill - Billing Software',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    backgroundColor: '#F8FAFC',
    show: false
  });

  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('127.0.0.1') && !url.includes('localhost')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup IPC handlers
ipcMain.handle('app:get-printers', async () => {
  if (!mainWindow) return [];
  try {
    return await mainWindow.webContents.getPrintersAsync();
  } catch (e) {
    return [];
  }
});

ipcMain.handle('app:print-html', async (_event, { html, options }) => {
  return new Promise((resolve) => {
    let workerWin = new BrowserWindow({
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    workerWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    workerWin.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        if (!workerWin) return;
        workerWin.webContents.print(
          {
            silent: false,
            printBackground: true,
            color: true,
            deviceName: options?.deviceName || ''
          },
          (success, failureReason) => {
            if (workerWin) {
              try {
                workerWin.close();
              } catch (e) {}
              workerWin = null;
            }
            resolve({ success, failureReason });
          }
        );
      }, 150);
    });

    workerWin.on('unresponsive', () => {
      if (workerWin) {
        try {
          workerWin.close();
        } catch (e) {}
        workerWin = null;
      }
      resolve({ success: false, failureReason: 'unresponsive' });
    });
  });
});

ipcMain.on('app:print', () => {
  if (mainWindow) {
    mainWindow.webContents.print({ silent: false, printBackground: true });
  }
});

ipcMain.handle('app:get-version', () => app.getVersion());

app.whenReady().then(async () => {
  logMessage('Smart Bill Electron app starting...');
  createWindow();

  // Start backend
  await startBackendServer();

  // Wait for health check
  const ready = await waitForServer(40, 250);
  if (ready) {
    logMessage('Backend server confirmed ready. Loading UI at ' + SERVER_URL);
    mainWindow.loadURL(SERVER_URL);
  } else {
    logMessage('ERROR: Backend server failed to start within timeout.');
    dialog.showErrorBox(
      'Smart Bill Startup Error',
      'The background billing service could not be started.\n\nPlease check if port 3000 is occupied or restart the application.'
    );
  }
});

function stopBackendServer() {
  if (serverProcess) {
    logMessage('Terminating backend process...');
    try {
      serverProcess.kill('SIGTERM');
    } catch {
      // ignore
    }
    serverProcess = null;
  }
}

app.on('window-all-closed', () => {
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
});
