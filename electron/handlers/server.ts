import { ipcMain } from 'electron'
import { ServerStatus } from 'eml-lib'
import logger from 'electron-log/main'

export function registerServerHandlers() {
  ipcMain.handle('server:status', async (_event, ip: string, port: number = 25565) => {
    try {
      if (ip !== 'play.osirismc.net' || port !== 25565) {
        logger.warn('Blocked server status request outside the Osiris server')
        return null
      }
      const server = new ServerStatus(ip, port, 'modern', 774)
      const status = await server.getStatus()
      return status
    } catch (err) {
      logger.error('Failed to get server status:', err)
      return null
    }
  })
}
