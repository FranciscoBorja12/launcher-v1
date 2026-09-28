import { app, BrowserWindow, Menu, nativeTheme, shell } from 'electron'
import path from 'node:path'
import { registerAuthHandlers } from './handlers/auth'
import { registerLauncherHandlers } from './handlers/launcher'
import { registerSettingsHandlers } from './handlers/settings'
import { registerServerHandlers } from './handlers/server'
import { registerNewsHandlers } from './handlers/news'
import { registerBackgroundHandlers } from './handlers/background'
import { registerMaintenanceHandlers } from './handlers/maintenance'
import { registerBootstrapHandlers } from './handlers/bootstraps'
import logger from 'electron-log/main'
import fs from 'node:fs'
import { registerProfilesHandlers } from './handlers/profiles'
import { registerSkinHandlers } from './handlers/skin'

const APP_TITLE = 'Osiris Launcher'
const BG_COLOR = '#080b12'

let mainWindow: BrowserWindow | null = null

if (process.env.VITE_DEV_SERVER_URL) {
  app.setName(APP_TITLE)
}

function createWindow() {
  nativeTheme.themeSource = 'dark'

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1000,
    minHeight: 700,
    title: APP_TITLE,
    autoHideMenuBar: true,
    backgroundColor: BG_COLOR,
    show: false,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: Boolean(process.env.VITE_DEV_SERVER_URL),
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url)
      const trustedHosts = ['osirismc.net', 'curseforge.com', 'xbox.com']
      const trusted = target.protocol === 'https:' && trustedHosts.some((host) => target.hostname === host || target.hostname.endsWith(`.${host}`))
      if (trusted) void shell.openExternal(target.toString())
    } catch {
      logger.warn('Blocked malformed external URL')
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
    logger.warn('Blocked renderer navigation attempt')
  })

  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
    logger.warn('Blocked webview attachment attempt')
  })

  mainWindow.webContents.session.setPermissionCheckHandler(() => false)
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))

  // mainWindow.removeMenu()

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function configureAppMenu() {
  app.setAboutPanelOptions({
    applicationName: APP_TITLE,
    applicationVersion: app.getVersion(),
    version: 'Build 2026.1',
    copyright: 'Copyright © 2026 OsirisMC',
    credits: 'Desarrollado con EML Lib y Electron',
    iconPath: path.join(__dirname, '../build/icon.png')
  })

  const template: any[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),

    { label: 'Archivo', submenu: [{ role: 'close', label: 'Cerrar' }] },
    { label: 'Editar', submenu: [{ role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
    { label: 'Ver', submenu: [{ role: 'togglefullscreen', label: 'Pantalla completa' }] }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  logger.initialize()
  try {
    fs.chmodSync(logger.transports.file.getFile().path, 0o600)
  } catch (err) {
    logger.warn('Unable to harden log file permissions:', err)
  }
  configureAppMenu()
  createWindow()

  if (mainWindow) {
    registerAuthHandlers(mainWindow)
    registerProfilesHandlers()
    registerServerHandlers()
    registerSkinHandlers()
    registerNewsHandlers()
    registerBackgroundHandlers()
    registerMaintenanceHandlers()
    registerBootstrapHandlers(mainWindow)
    registerLauncherHandlers(mainWindow)
    registerSettingsHandlers()
  }
})

app.on('window-all-closed', () => {
  app.quit()
})
