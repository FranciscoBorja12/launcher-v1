import { setUser, setView } from '../state'
import { auth, skin } from '../ipc'
import { Dialog } from './dialog'
import logger from 'electron-log/renderer'

export function initLogin() {
  const btn = document.getElementById('btn-login-ms') as HTMLButtonElement | null
  const offlineBtn = document.getElementById('btn-login-offline') as HTMLButtonElement | null
  const usernameInput = document.getElementById('offline-username') as HTMLInputElement | null
  if (!btn || !offlineBtn || !usernameInput) return

  btn.addEventListener('click', async () => {
    const originalText = btn.innerHTML

    btn.disabled = true
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Conectando...'

    try {
      const session = await auth.login()

      if (session.success) {
        const [__, skins, capes, avatar] = await Promise.all([skin.reload(), skin.getSkin(), skin.getCape(), skin.getAvatar()])

        setUser(session.account, { skins, capes, avatar })
        setView('home')
      } else {
        logger.error(session.error)
        await Dialog.show('No fue posible iniciar sesión.', [{ text: 'Aceptar', type: 'ok' }])
      }
    } catch (err) {
      logger.error(err)
      await Dialog.show('Ocurrió un error durante el inicio de sesión.', [{ text: 'Aceptar', type: 'ok' }])
    } finally {
      btn.disabled = false
      btn.innerHTML = originalText
    }
  })

  const offlineLogin = async () => {
    const username = usernameInput.value.trim()
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
      await Dialog.show('El nombre debe tener entre 3 y 16 caracteres y usar solo letras, números o guion bajo.', [{ text: 'Aceptar', type: 'ok' }])
      return
    }

    const originalText = offlineBtn.innerHTML
    offlineBtn.disabled = true
    usernameInput.disabled = true
    offlineBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Preparando...'

    try {
      const session = await auth.offline(username)
      if (!session.success) {
        await Dialog.show('No fue posible crear la sesión no-premium.', [{ text: 'Aceptar', type: 'ok' }])
        return
      }

      await setUser(session.account, { skins: [], capes: [], avatar: null })
      setView('home')
    } catch (err) {
      logger.error(err)
      await Dialog.show('Ocurrió un error al preparar la sesión no-premium.', [{ text: 'Aceptar', type: 'ok' }])
    } finally {
      offlineBtn.disabled = false
      usernameInput.disabled = false
      offlineBtn.innerHTML = originalText
    }
  }

  offlineBtn.addEventListener('click', offlineLogin)
  usernameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void offlineLogin()
  })
}
