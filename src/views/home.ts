import { setView, getUser } from '../state'
import { game, news, server, settings, profiles } from '../ipc'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import logger from 'electron-log/renderer'

marked.use({
  renderer: {
    link(link) {
      const href = link.href ?? '#'
      const titleAttr = link.title ? ` title="${link.title}"` : ''
    const safeHref = /^(https:\/\/|mailto:)/i.test(href) ? href : '#'
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${titleAttr}>${link.text}</a>`
    }
  }
})

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-SV', { month: 'short', day: 'numeric', year: 'numeric' })
}

const escapeHTML = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const safeColor = (value: unknown) => (/^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : '#e4ab3f')

const safeImage = (value: unknown) => {
  const url = String(value ?? '')
  return /^(https:\/\/|data:image\/)/i.test(url) ? escapeHTML(url) : ''
}

const parseNews = (rawContent: string) =>
  DOMPurify.sanitize(marked.parse(rawContent) as string, {
    ADD_ATTR: ['target']
  })

const backgroundColor = (rawColor: string) => {
  const color = safeColor(rawColor)
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, 0.1)`
}

export function initHome() {
  const body = document.body
  const playBtn = document.getElementById('btn-play')
  const settingsBtn = document.getElementById('btn-settings')
  const progressContainer = document.getElementById('launch-progress-container')
  const progressBar = document.getElementById('launch-progress-bar')
  const progressLabel = document.getElementById('launch-progress-label')
  const progressPercent = document.getElementById('launch-progress-percent')
  const statusDot = document.getElementById('server-status-dot')
  const statusText = document.getElementById('server-status-text')
  const playerCount = document.getElementById('player-count')
  const newsList = document.getElementById('news-list')
  const profileSelector = document.getElementById('profile-selector')
  const profileDropdown = document.getElementById('profile-dropdown')
  const currentProfileName = document.getElementById('current-profile-name')

  let selectedProfile: any = null
  let allProfiles: any[] = []
  let totalToDownload = 0
  let totalDownloadedByType: { type: string; size: number }[] = []

  const loadProfiles = async () => {
    allProfiles = await profiles.get()
    if (allProfiles.length > 0) {
      selectProfile(allProfiles[0])
      renderDropdown()
    }
  }

  const renderDropdown = () => {
    if (!profileDropdown) return
    profileDropdown.innerHTML = allProfiles
      .map(
        (p) => `
      <div class="profile-option ${selectedProfile?.id === p.id ? 'active' : ''}" data-id="${p.id}">
        ${escapeHTML(p.name)}
      </div>
    `
      )
      .join('')

    profileDropdown.querySelectorAll('.profile-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.id
        const profile = allProfiles.find((p) => p.id === id)
        if (profile) selectProfile(profile)
        profileSelector?.classList.remove('open')
      })
    })
  }

  const selectProfile = (profile: any) => {
    selectedProfile = profile
    if (currentProfileName) currentProfileName.innerText = profile.name
    renderDropdown()
    updateServerStatus()
  }

  const updateServerStatus = async () => {
    if (statusDot) {
      statusDot.classList.remove('online', 'offline')
      statusDot.classList.add('pinging')
    }
    if (statusText) statusText.innerText = 'Consultando...'
    if (playerCount) playerCount.innerHTML = ''

    const status = selectedProfile ? await server.getStatus(selectedProfile.ip, selectedProfile.port || 25565) : null

    if (status) {
      if (statusDot) {
        statusDot.classList.remove('pinging', 'offline')
        statusDot.classList.add('online')
      }
      if (statusText) statusText.innerText = 'En línea'

      if (playerCount) {
        playerCount.innerHTML = `<i class="fa-fw fa-solid fa-users"></i>&nbsp;&nbsp;${Number(status.players.online).toLocaleString()} / ${Number(status.players.max).toLocaleString()}`
      }
    } else {
      if (statusDot) {
        statusDot.classList.remove('pinging', 'online')
        statusDot.classList.add('offline')
      }
      if (statusText) statusText.innerText = 'Fuera de línea'
      if (playerCount) playerCount.innerHTML = ''
    }
  }

  const loadNews = async () => {
    if (!newsList) return
    newsList.innerHTML = '<div style="text-align:center; padding: 20px; color: #888;">Cargando noticias...</div>'
    const feed = await news.getNews()

    newsList.innerHTML = ''

    if (!feed || feed.length === 0) {
      newsList.innerHTML = '<div style="text-align:center; color: #888;">Todavía no hay noticias publicadas.</div>'
      return
    }

    feed.forEach((item: any) => {
      let tagsHTML = ''
      item.tags.forEach((tag: any) => {
        const color = safeColor(tag.color)
        tagsHTML += `<span class="tag" style="color: ${color}; background-color: ${backgroundColor(color)}">${escapeHTML(tag.name)}</span>`
      })
      const articleHTML = `
        <article class="news-article">
          <div class="article-meta">
            <div class="author">
              <img src="https://minotar.net/helm/${encodeURIComponent(item.author.username ?? 'Steve')}/24" alt="Autor" />
              <span>${escapeHTML(item.author.username ?? 'Equipo Osiris')}</span>
            </div>
            <span class="separator">•</span>
            <span class="date">${formatDate(item.createdAt)}</span>
            <span class="separator">•</span>
            <div class="tags-container">${tagsHTML}</div>
          </div>

          <h3>${escapeHTML(item.title)}</h3>
          
          ${safeImage(item.image) ? `<img src="${safeImage(item.image)}" alt="Imagen de la noticia"/>` : ''}

          <div class="article-content">
            ${parseNews(item.content)}
          </div>
        </article>
      `

      newsList.insertAdjacentHTML('beforeend', articleHTML)
    })
  }

  loadProfiles()
  updateServerStatus()
  loadNews()

  const setIndeterminate = (active: boolean) => {
    if (!progressBar || !progressPercent) return

    if (active) {
      progressBar.classList.add('indeterminate')
      progressPercent.style.display = 'none'
    } else {
      progressBar.classList.remove('indeterminate')
      progressPercent.style.display = 'block'
    }
  }

  settingsBtn?.addEventListener('click', () => {
    setView('settings')
  })

  playBtn?.addEventListener('click', async () => {
    setIndeterminate(true)
    if (playBtn) playBtn.style.display = 'none'
    if (progressContainer) progressContainer.classList.remove('hidden')
    if (progressBar) progressBar.style.width = '0%'
    if (progressPercent) progressPercent.innerText = '0%'

    const user = getUser()
    if (!user) return

    const config = await settings.get()

    const message = `
Ready to launch the game with the following settings:
      
👤 Account: ${user.name}
🧠 RAM: ${config.memory.min} - ${config.memory.max}
☕️ Java: ${config.java}
🖥️ Resolution: ${config.resolution.width}x${config.resolution.height}
🚀 Action on launch: ${config.launcherAction}
    `

    logger.log(message)
    game.launch({ settings: config, profileSlug: selectedProfile?.slug })
  })

  profileSelector?.querySelector('.selected-profile')?.addEventListener('click', () => {
    profileSelector.classList.toggle('open')
  })

  body.addEventListener('click', (e) => {
    if (!profileSelector?.contains(e.target as Node)) {
      profileSelector?.classList.remove('open')
    }
  })

  game.launchComputeDownload(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Preparando descarga...'
    if (progressPercent) progressPercent.innerText = ''
  })
  game.launchDownload((download) => {
    setIndeterminate(false)
    totalToDownload = download.total.size
    if (progressLabel) progressLabel.innerText = `Descargando archivos...`
  })
  game.downloadProgress((progress) => {
    if (!totalDownloadedByType.find((t) => t.type === progress.type)) {
      totalDownloadedByType.push({ type: progress.type, size: progress.downloaded.size })
    } else {
      totalDownloadedByType[totalDownloadedByType.findIndex((t) => t.type === progress.type)].size = progress.downloaded.size
    }
    if (progressBar && progressLabel && progressPercent) {
      const downloadedSum = totalDownloadedByType.reduce((acc, curr) => acc + curr.size, 0)
      progressBar.style.width = `${Math.min((downloadedSum / totalToDownload) * 100, 100)}%`
      progressLabel.innerText = `Descargando ${progress.type === 'JAVA' ? 'Java' : 'archivos del juego'}...`
      progressPercent.innerText = `${Math.round(Math.min((downloadedSum / totalToDownload) * 100, 100))}%`
    }
  })
  game.launchInstallLoader(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Extrayendo archivos...'
    if (progressPercent) progressPercent.innerText = ''
  })
  game.launchExtractNatives(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Extrayendo archivos...'
  })
  game.launchCopyAssets(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Preparando recursos...'
  })
  game.launchPatchLoader(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Finalizando instalación...'
  })
  game.launchLaunch(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Iniciando Minecraft...'
  })
  game.launched(() => {
    setTimeout(() => {
      if (playBtn) playBtn.style.display = 'block'
      if (progressContainer) progressContainer.classList.add('hidden')
      if (progressBar) progressBar.style.width = '0%'
      if (progressPercent) progressPercent.innerText = ''
    }, 10000)
  })
}



