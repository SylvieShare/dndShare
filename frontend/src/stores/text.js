import { defineStore } from 'pinia'
import { fetchGet } from '@/shared/api/http'

export const useTextStore = defineStore('text', {
  state: () => ({
    common: {},
    loadedCommon: false,
  }),
  getters: {
    commonIsLoaded: state => state.loadedCommon,
  },
  actions: {
    async downloadText() {
      const res = await fetchGet('/text?' + new URLSearchParams({ keysets: ['common'], lang: 'ru' }))
      this.common = res?.keysets?.common || {}
      this.loadedCommon = true
    },
  },
})
