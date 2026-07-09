import { defineStore } from 'pinia'
import { fetchGet, fetchPost, fetchGetEmpty } from '@/shared/api/http'

export const useAccountStore = defineStore('account', {
  state: () => ({
    status: 'check',
    user: { id: 0, login: '', roles: [] },
    _authPromise: null,
  }),
  getters: {
    authStatus: state => state.status,
    hasRole: state => role => state.user.roles.includes(role),
  },
  actions: {
    async login(credentials) {
      this.status = 'process'
      try {
        const res = await fetchPost('/user/auth', credentials)
        if (res.auth) {
          this.user = res.user
          this.status = 'success'
          window.location.reload()
        } else {
          this.status = 'none'
          throw new Error('auth failed')
        }
      } catch {
        this.status = 'none'
        throw new Error('auth failed')
      }
    },
    async checkAuth() {
      const promise = fetchGet('/user/checkAuth').then(res => {
        if (res?.auth) {
          this.user = res.user
          this.status = 'success'
        } else {
          this.status = 'none'
        }
        return res?.user || null
      })
      this._authPromise = promise
      return promise
    },
    // Resolves auth without re-fetching when it's already known (or in flight).
    // App.vue triggers checkAuth on boot, so pages can await this instead of refetching.
    async ensureAuth() {
      if (this.status === 'success' || this.status === 'none') return this.user?.id ? this.user : null
      if (this._authPromise) return this._authPromise
      return this.checkAuth()
    },
    async logout() {
      await fetchGetEmpty('/user/logout')
      this.status = 'none'
      window.location.reload()
    },
  },
})
