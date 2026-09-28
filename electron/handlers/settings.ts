import { ipcMain, app, screen, dialog } from 'electron'
import logger from 'electron-log/main'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const settingsPath = path.join(app.getPath('userData'), 'settings.json')

function isValidSettings(value: unknown): value is IGameSettings {
  if (!value || typeof value !== 'object') return false
  const settings = value as IGameSettings
  const memory = settings.memory
  const resolution = settings.resolution
  return (
    ['bundled', 'system', 'path'].includes(settings.java) &&
    Number.isFinite(memory?.min) &&
    Number.isFinite(memory?.max) &&
    memory.min >= 0.5 &&
    memory.max <= 16 &&
    memory.min <= memory.max &&
    Number.isInteger(resolution?.width) &&
    Number.isInteger(resolution?.height) &&
    resolution.width >= 640 &&
    resolution.width <= 7680 &&
    resolution.height >= 480 &&
    resolution.height <= 4320 &&
    typeof resolution.fullscreen === 'boolean' &&
    ['close', 'keep', 'hide'].includes(settings.launcherAction)
  )
}

export interface ISystemInfo {
  totalMem: number // in GB
  resolution: {
    width: number
    height: number
  }
  version: string
}

export interface IGameSettings {
  java: string
  memory: {
    min: number
    max: number
  }
  resolution: {
    width: number
    height: number
    fullscreen: boolean
  }
  launcherAction: 'close' | 'keep' | 'hide'
}

export const DEFAULT_SETTINGS: IGameSettings = {
  java: 'bundled',
  memory: {
    min: 1,
    max: 4
  },
  resolution: {
    width: 1280,
    height: 720,
    fullscreen: false
  },
  launcherAction: 'close'
}

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', async () => {
    try {
      if (!fs.existsSync(settingsPath)) {
        fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2))
        return DEFAULT_SETTINGS
      }
      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      fs.chmodSync(settingsPath, 0o600)
      return isValidSettings(parsed) ? parsed : DEFAULT_SETTINGS
    } catch (err) {
      logger.error('Error reading settings:', err)
      return DEFAULT_SETTINGS
    }
  })

  ipcMain.handle('settings:set', async (_event, newSettings: IGameSettings) => {
    try {
      if (!isValidSettings(newSettings)) {
        logger.warn('Rejected invalid game settings')
        return false
      }
      fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), { mode: 0o600 })
      fs.chmodSync(settingsPath, 0o600)
      return true
    } catch (err) {
      logger.error('Error writing settings:', err)
      return false
    }
  })

  ipcMain.handle('system:info', async () => {
    const totalMemBytes = os.totalmem()
    const totalMemGB = Math.round(totalMemBytes / 1024 / 1024 / 1024)

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize

    return {
      totalMem: totalMemGB,
      resolution: { width, height },
      version: app.getVersion()
    }
  })

  ipcMain.handle('settings:pick_java', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Java Executable', extensions: ['exe', 'bin', ''] }]
    })
    return result.filePaths[0] ?? null
  })
}
