const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'editor', 'index.html'));  // Updated path

    ipcMain.handle('dialog:openFile', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'MermaidJS Files', extensions: ['mmd'] }],
        });

        if (canceled) {
            return;
        } else {
            const content = fs.readFileSync(filePaths[0], 'utf-8');
            return content;
        }
    });

    ipcMain.handle('dialog:saveFile', async (event, content) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save MermaidJS Diagram',
            defaultPath: 'diagram.mmd',
            filters: [{ name: 'MermaidJS Files', extensions: ['mmd'] }],
        });

        if (canceled) {
            return;
        } else {
            fs.writeFileSync(filePath, content, 'utf-8');
            return filePath;
        }
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
