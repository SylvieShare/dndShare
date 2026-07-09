import { defineStore } from 'pinia'
import { fetchGet } from '@/shared/api/http'

let pending = null

export const useTemplateStore = defineStore('template', {
  state: () => ({
    templates: null,
  }),
  getters: {
    all: state => state.templates || [],
    byId: state => id => (state.templates || []).find(t => t.id === id) || null,
  },
  actions: {
    ensure() {
      if (this.templates !== null) return Promise.resolve()
      if (pending) return pending
      pending = fetchGet('/templates').then(res => {
        this.templates = res?.templates || []
        pending = null
      })
      return pending
    },
    add(template) {
      if (this.templates !== null) this.templates = [...this.templates, template]
    },
  },
})
