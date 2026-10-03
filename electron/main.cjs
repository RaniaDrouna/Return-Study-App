const { app, BrowserWindow, ipcMain, Notification, Tray, Menu } = require('electron');
const path = require('path');

const APP_NAME = 'Return';
const BACKGROUND = '#e9eef2'; // matches the .app-shell background in index.css

app.setName(APP_NAME);

if (process.platform === 'win32') {
    app.setAppUserModelId('com.yourname.studyapp'); // match "build.appId" in package.json
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');

const isDev = !!process.env.ELECTRON_START_URL;

// The web version shows the app as a centered 1040px card with gutters around it.
// In Electron the window itself is the frame, so make the shell fill it edge to edge.
// Injected from the main process so it works no matter what the renderer CSS/JS does.
const ELECTRON_CSS = `
    html, body { background: ${BACKGROUND} !important; }
    .app-shell { width: 100% !important; max-width: none !important; margin: 0 !important; box-shadow: none !important; }
    .topbar { -webkit-app-region: drag; }
    .topbar button, .window-control { -webkit-app-region: no-drag; cursor: pointer; }
`;

let mainWindow = null;
let tray = null;
let isQuitting = false; // true only when the user picks Quit from the tray

function showWindow() {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    tray.setToolTip(`${APP_NAME} (reminders active)`);
    tray.setContextMenu(
        Menu.buildFromTemplate([
            { label: `Open ${APP_NAME}`, click: showWindow },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    isQuitting = true;
                    app.quit();
                },
            },
        ])
    );
    tray.on('click', showWindow);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        title: APP_NAME,
        width: 1040, // matches the .app-shell width in index.css
        height: 780,
        useContentSize: true, // 1040px is the app area itself, not the window including its frame
        minWidth: 900,
        minHeight: 640,
        center: true,
        show: false,
        frame: false, // removes the native title bar and its buttons
        backgroundColor: BACKGROUND, // avoids a white flash before the UI paints
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false, // timer keeps running accurately when hidden or minimized
            autoplayPolicy: 'no-user-gesture-required', // interface sounds (Web Audio) stay reliable
        },
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.webContents.on('dom-ready', () => {
        mainWindow.webContents.insertCSS(ELECTRON_CSS);
    });

    // Closing the window hides it to the tray so reminders keep running.
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    if (isDev) {
        mainWindow.loadURL(process.env.ELECTRON_START_URL);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'public', 'index.html'));
    }

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[renderer] ${message} (${sourceId}:${line})`);
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.log(`[did-fail-load] ${errorCode} ${errorDescription} — ${validatedURL}`);
    });
}

// Main-process notifications (reminders) — more reliable than the renderer's
// Web Notification API in a packaged Electron app on Windows.
// Registered once at app level so re-creating the window never duplicates the handler.
// silent: true because the app plays its own notification sound.
ipcMain.on('show-notification', (event, payload) => {
    if (!Notification.isSupported()) return;
    const title = String((payload && payload.title) || APP_NAME);
    const body = String((payload && payload.body) || '');
    const notification = new Notification({ title, body, silent: true });
    notification.on('click', showWindow);
    notification.show();
});

// Window controls for the circles in the app's own top bar.
// Close hides to the tray; use the tray menu to quit completely.
ipcMain.on('window-minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.on('window-toggle-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
});
ipcMain.on('window-close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
});

// Only one instance, so reminders never fire twice.
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', showWindow);

    app.whenReady().then(() => {
        createWindow();
        createTray();
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
}

app.on('before-quit', () => {
    isQuitting = true;
});

// Stay alive in the tray when every window is hidden or closed.
app.on('window-all-closed', () => {});