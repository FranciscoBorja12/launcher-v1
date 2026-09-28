import { ipcMain, app, safeStorage } from 'electron'
import { CrackAuth, MicrosoftAuth } from 'eml-lib'
import type { Account } from 'eml-lib'
import logger from 'electron-log/main'
import * as fs from 'node:fs'
import * as path from 'node:path'

const sessionPath = path.join(app.getPath('userData'), 'session.bin')
const legacySessionPath = path.join(app.getPath('userData'), 'session.json')
let activeAccount: Account | null = null

export type RendererAccount = Pick<Account, 'name' | 'uuid' | 'meta'>

function toRendererAccount(account: Account): RendererAccount {
  return {
    name: account.name,
    uuid: account.uuid,
    meta: { ...account.meta }
  }
}

export function getAuthenticatedAccount(): Account | null {
  return activeAccount
}

function saveSession(account: Account) {
  if (!safeStorage.isEncryptionAvailable()) {
    logger.warn('Secure credential storage is unavailable; the session will not be persisted.')
    return
  }

  const encrypted = safeStorage.encryptString(JSON.stringify(account))
  fs.writeFileSync(sessionPath, encrypted, { mode: 0o600 })
  fs.chmodSync(sessionPath, 0o600)
  if (fs.existsSync(legacySessionPath)) fs.unlinkSync(legacySessionPath)
}

function loadSession(): Account | null {
  if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(sessionPath)) return null
  return JSON.parse(safeStorage.decryptString(fs.readFileSync(sessionPath))) as Account
}

export type IAuthResponse = { success: true; account: RendererAccount } | { success: false; error?: string }

export function registerAuthHandlers(mainWindow: Electron.BrowserWindow) {
  const auth = new MicrosoftAuth(mainWindow)

  ipcMain.handle('auth:login', async () => {
    try {
      const account = await auth.auth()
      activeAccount = account
      saveSession(account)
      return { success: true, account: toRendererAccount(account) } as IAuthResponse
    } catch (err: any) {
      logger.error('Failed to login:', err)
      return { success: false, error: err.message ?? 'Unknown error' }
    }
  })

  ipcMain.handle('auth:offline', async (_event, username: string) => {
    try {
      const account = new CrackAuth().auth(username.trim())
      activeAccount = account
      saveSession(account)
      return { success: true, account: toRendererAccount(account) } as IAuthResponse
    } catch (err: any) {
      logger.error('Failed to create offline session:', err)
      return { success: false, error: err.message ?? 'Invalid username' } as IAuthResponse
    }
  })

  ipcMain.handle('auth:refresh', async () => {
    if (!fs.existsSync(sessionPath)) {
      return { success: false } as { success: false }
    }

    try {
      const savedSession = loadSession()

      if (savedSession?.meta.type === 'crack') {
        activeAccount = savedSession
        return { success: true, account: toRendererAccount(savedSession) } as IAuthResponse
      }

      if (savedSession && savedSession.uuid) {
        const valid = await auth.validate(savedSession)
        if (valid) {
          activeAccount = savedSession
          return { success: true, account: toRendererAccount(savedSession) } as IAuthResponse
        }
        const account = await auth.refresh(savedSession)
        activeAccount = account
        saveSession(account)
        return { success: true, account: toRendererAccount(account) } as IAuthResponse
      }
      return { success: false }
    } catch (err: any) {
      activeAccount = null
      logger.error('Failed to refresh session:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    activeAccount = null
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath)
    }
    if (fs.existsSync(legacySessionPath)) fs.unlinkSync(legacySessionPath)
    return { success: true }
  })
}
