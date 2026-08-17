import { defineStore } from 'pinia'
import { fetchGet, fetchPut } from '@/shared/api/http'
import { rulesPathForGameContext } from '@/shared/lib/gameSystems'
import { useAccountStore } from '@/stores/account'

const GUEST_STORAGE_KEY = 'dndshare.gameContext.sourceVersionId'
let ensureInflight = null

function allVersions(sources) {
  return sources.flatMap(source => (source.versions || []).map(version => ({ source, version })))
}

function defaultVersion(sources) {
  const versions = allVersions(sources)
  return versions.find(({ source, version }) => (
    String(source.name).toLocaleLowerCase() === 'dnd5e' && String(version.version) === '2014'
  )) || versions[0] || null
}

function readGuestVersionID() {
  try {
    const value = Number(localStorage.getItem(GUEST_STORAGE_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeGuestVersionID(value) {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, String(value))
  } catch {
    // The selection remains active for this page when storage is unavailable.
  }
}

export const useGameContextStore = defineStore('gameContext', {
  state: () => ({
    sources: [],
    sourceVersionId: null,
    ready: false,
    loading: false,
    saving: false,
    error: '',
  }),
  getters: {
    selectedPair: state => allVersions(state.sources)
      .find(({ version }) => Number(version.id) === Number(state.sourceVersionId)) || null,
    selectedSource() {
      return this.selectedPair?.source || null
    },
    selectedVersion() {
      return this.selectedPair?.version || null
    },
    context() {
      if (!this.selectedPair) return null
      return {
        sourceId: this.selectedSource.id,
        sourceName: this.selectedSource.name,
        sourceVersionId: this.selectedVersion.id,
        version: this.selectedVersion.version,
      }
    },
    rulesPath() {
      return rulesPathForGameContext(this.context)
    },
  },
  actions: {
    async ensure() {
      if (this.ready) return this.context
      if (ensureInflight) return ensureInflight
      this.loading = true
      ensureInflight = (async () => {
        try {
          const account = useAccountStore()
          const [sourcesResponse, user] = await Promise.all([
            fetchGet('/sources'),
            account.ensureAuth().catch(() => null),
          ])
          this.sources = sourcesResponse?.sources || []
          const preferredID = user?.gameContext?.sourceVersionId || readGuestVersionID()
          const preferred = allVersions(this.sources)
            .find(({ version }) => Number(version.id) === Number(preferredID))
          this.sourceVersionId = (preferred || defaultVersion(this.sources))?.version?.id || null
          this.ready = true
          this.error = ''
          return this.context
        } catch (error) {
          this.error = 'Не удалось загрузить игровые системы'
          throw error
        } finally {
          this.loading = false
          ensureInflight = null
        }
      })()
      return ensureInflight
    },
    async selectVersion(sourceVersionID) {
      await this.ensure()
      const next = allVersions(this.sources)
        .find(({ version }) => Number(version.id) === Number(sourceVersionID))
      if (!next || this.saving || Number(next.version.id) === Number(this.sourceVersionId)) return this.context

      const previousID = this.sourceVersionId
      this.sourceVersionId = next.version.id
      this.saving = true
      this.error = ''
      try {
        const account = useAccountStore()
        if (account.authStatus === 'success') {
          const response = await fetchPut('/account/game-context', { sourceVersionId: next.version.id })
          account.user = { ...account.user, gameContext: response.gameContext }
        } else {
          writeGuestVersionID(next.version.id)
        }
        return this.context
      } catch (error) {
        this.sourceVersionId = previousID
        this.error = 'Не удалось сохранить выбор'
        throw error
      } finally {
        this.saving = false
      }
    },
    selectSource(sourceID) {
      const source = this.sources.find(item => Number(item.id) === Number(sourceID))
      const version = source?.versions?.[0]
      return version ? this.selectVersion(version.id) : Promise.resolve(this.context)
    },
  },
})
