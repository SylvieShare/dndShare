import { reactive } from 'vue'

export function useInventoryTooltip() {
  const tooltip = reactive({ visible: false, anchor: null, name: '', desc: '', item: null })
  function showTooltip(event, display) {
    if (!display) return
    const item = display.base
      ? { ...display.base, data: { ...display.base.data, cost: display.cost || null, weight: display.weight } }
      : { name: display.name, data: { desc: display.desc, consumable: display.consumable } }
    Object.assign(tooltip, { visible: true, anchor: event.currentTarget, name: display.name, desc: display.desc || '', item })
  }
  function hideTooltip() { tooltip.visible = false; tooltip.anchor = null }
  return { tooltip, showTooltip, hideTooltip }
}
