import { defineStore } from 'pinia'
import { fetchGet } from '@/shared/api/http'
import { selectableIconPresets } from '@/features/inventory/lib/iconPresets'

const inflight = new WeakMap()

export const useInventoryIconPresetsStore = defineStore('inventoryIconPresets', {
  state: () => ({ presets: [], loaded: false, loading: false, error: '' }),
  getters: {
    byId: state => Object.fromEntries(state.presets.map(preset => [preset.id, preset])),
    forTypes: state => typeIds => selectableIconPresets(state.presets, typeIds),
    emptyCellUrl: state => state.presets.find(preset => preset.purpose === 'empty_cell' && preset.itemTypeId === 2)?.imageUrl || '',
  },
  actions: {
    async ensureLoaded() {
      if (this.loaded) return
      if (inflight.has(this)) return inflight.get(this)
      this.loading = true
      this.error = ''
      const request = (async () => {
        try {
          const response = await fetchGet('/inventory/icon-presets')
          this.presets = response.presets || []
          this.loaded = true
        } catch {
          this.error = 'Не удалось загрузить иконки.'
        } finally {
          this.loading = false
          inflight.delete(this)
        }
      })()
      inflight.set(this, request)
      return request
    },
  },
})
