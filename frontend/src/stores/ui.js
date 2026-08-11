import { defineStore } from 'pinia'
import { normalizeHeaderChip, resolveAppHeaderContext } from '@/shared/lib/appHeader'

export const useUiStore = defineStore('ui', {
  state: () => ({
    headerTitle: '',
    headerChip: null,
    headerOwner: null,
    headerHidden: false,
    scrollY: 0,
  }),
  actions: {
    setHeaderTitle(title) {
      this.headerTitle = title || ''
      this.headerChip = null
      this.headerOwner = null
    },
    setHeaderContext(context = {}, owner = null) {
      this.headerTitle = context.title || ''
      this.headerChip = normalizeHeaderChip(context.chip)
      this.headerOwner = owner == null ? null : String(owner)
    },
    clearHeaderContext(owner = null) {
      if (owner != null && String(owner) !== this.headerOwner) return
      this.headerTitle = ''
      this.headerChip = null
      this.headerOwner = null
    },
    resolveHeader(routeName, routeTitle, allowUnscoped = false) {
      return resolveAppHeaderContext({
        routeName,
        routeTitle,
        title: this.headerTitle,
        chip: this.headerChip,
        owner: this.headerOwner,
        allowUnscoped,
      })
    },
    setHeaderHidden(hidden) {
      this.headerHidden = !!hidden
    },
    setScrollY(y) {
      this.scrollY = y
    },
  },
})
