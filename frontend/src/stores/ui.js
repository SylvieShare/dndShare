import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    headerTitle: '',
    headerHidden: false,
    scrollY: 0,
  }),
  actions: {
    setHeaderTitle(title) {
      this.headerTitle = title || ''
    },
    setHeaderHidden(hidden) {
      this.headerHidden = !!hidden
    },
    setScrollY(y) {
      this.scrollY = y
    },
  },
})
