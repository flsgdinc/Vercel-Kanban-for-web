const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs').promises;

if (process.platform === 'win32') {
    app.setAppUserModelId('com.kanban.app');
}

let mainWindow;
let tray = null;
let isQuitting = false;
/** Синхронизируется из рендерера (Настройки): при false — крестик закрывает приложение. */
let closeToTrayEnabled = true;

function trayIconImage() {
    const fromPath = (p) => {
        try {
            const i = nativeImage.createFromPath(p);
            return i.isEmpty() ? null : i;
        } catch {
            return null;
        }
    };
    const candidates = [
        path.join(__dirname, 'src', 'icon.png'),
        path.join(__dirname, 'icon.png'),
    ];
    for (const p of candidates) {
        const appIcon = fromPath(p);
        if (appIcon) {
            return appIcon.resize({ width: 32, height: 32 });
        }
    }
    const onePx = nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAgcB8B9QZ8QAAAAASUVORK5CYII='
    );
    return onePx.resize({ width: 32, height: 32 });
}

function createTray() {
    if (tray) return;
    try {
        tray = new Tray(trayIconImage());
        tray.setToolTip('Kanban Task Manager');
        const menu = Menu.buildFromTemplate([
            {
                label: 'Открыть',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Выход',
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);
        tray.setContextMenu(menu);
        tray.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    mainWindow.focus();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        });
    } catch (e) {
        console.error('Tray init failed', e);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,           // Безопасность: отключено
            contextIsolation: true,           // Безопасность: включено
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.cjs')  // Безопасный preload
        },
        icon: path.join(__dirname, 'src', 'icon.png'),
    });

    mainWindow.loadFile('src/index.html');

    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('close', (e) => {
        if (!isQuitting && closeToTrayEnabled) {
            e.preventDefault();
            mainWindow.hide();
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    createTray();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC handlers для безопасности
ipcMain.handle('save-state', async (event, data) => {
    try {
        await fs.writeFile(path.join(app.getPath('userData'), 'kanban-state.json'), JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving state:', error);
        return false;
    }
});

ipcMain.handle('load-state', async () => {
    try {
        const statePath = path.join(app.getPath('userData'), 'kanban-state.json');
        const data = await fs.readFile(statePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading state:', error);
        return null;
    }
});

ipcMain.handle('save-file', async (event, data, filename) => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: filename,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled) {
            await fs.writeFile(result.filePath, JSON.stringify(data, null, 2));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error saving file:', error);
        return false;
    }
});

ipcMain.handle('open-file', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            const data = await fs.readFile(result.filePaths[0], 'utf8');
            return JSON.parse(data);
        }
        return null;
    } catch (error) {
        console.error('Error opening file:', error);
        return null;
    }
});

ipcMain.handle('minimize', () => mainWindow.minimize());
ipcMain.handle('maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});
ipcMain.handle('close', () => mainWindow.close());

ipcMain.handle('set-close-behavior', (event, closeToTray) => {
    closeToTrayEnabled = !!closeToTray;
    return true;
});

const SUPABASE_CONFIG_FILE = 'supabase-config.json';
const SUPABASE_SESSION_FILE = 'supabase-session.json';

function supabaseConfigPath() {
    return path.join(app.getPath('userData'), SUPABASE_CONFIG_FILE);
}

function supabaseSessionPath() {
    return path.join(app.getPath('userData'), SUPABASE_SESSION_FILE);
}

ipcMain.handle('supabase-load-config', async () => {
    try {
        const raw = await fs.readFile(supabaseConfigPath(), 'utf8');
        const data = JSON.parse(raw);
        if (!data?.url || !data?.anonKey) return null;
        return { url: String(data.url), anonKey: String(data.anonKey) };
    } catch {
        return null;
    }
});

ipcMain.handle('supabase-save-config', async (event, config) => {
    try {
        if (!config?.url || !config?.anonKey) return false;
        await fs.writeFile(
            supabaseConfigPath(),
            JSON.stringify({ url: String(config.url), anonKey: String(config.anonKey) }, null, 2)
        );
        return true;
    } catch (error) {
        console.error('supabase-save-config failed', error);
        return false;
    }
});

ipcMain.handle('supabase-load-session', async () => {
    try {
        const raw = await fs.readFile(supabaseSessionPath(), 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
});

ipcMain.handle('supabase-save-session', async (event, session) => {
    try {
        if (!session) {
            try {
                await fs.unlink(supabaseSessionPath());
            } catch {
                /* no session file */
            }
            return true;
        }
        await fs.writeFile(supabaseSessionPath(), JSON.stringify(session));
        return true;
    } catch (error) {
        console.error('supabase-save-session failed', error);
        return false;
    }
});

ipcMain.handle('show-notification', async (event, { title, body }) => {
    if (!Notification.isSupported()) return false;
    try {
        const n = new Notification({
            title: title || 'Kanban',
            body: body || ''
        });
        n.show();
        n.on('click', () => {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
        });
        return true;
    } catch (err) {
        console.error('Notification failed', err);
        return false;
    }
});