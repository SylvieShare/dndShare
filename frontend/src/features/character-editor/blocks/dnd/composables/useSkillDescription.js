import { onBeforeUnmount, ref } from 'vue'

const TOOLTIP_DELAY_MS = 450

export function useSkillDescription(rollMenu) {
  const tooltip = ref({ visible: false, pinned: false, id: null, anchor: null, title: '', desc: '', bonuses: [], total: 0, x: 0, top: null, bottom: null })
  let tooltipTimer = null
  function hideTooltip() {
    if (tooltipTimer != null) window.clearTimeout(tooltipTimer)
    tooltipTimer = null
    tooltip.value.visible = false
    tooltip.value.pinned = false
  }
  function details(event, skill, pinned) {
    const rect = event.currentTarget.getBoundingClientRect()
    const above = window.innerHeight - rect.bottom < 180
    return { visible: true, pinned, id: skill.id, anchor: pinned ? event.currentTarget : null,
      title: skill.title, desc: skill.desc, bonuses: skill.bonusDetails || [], total: skill.bonus,
      x: Math.max(8, Math.min(rect.left, window.innerWidth - 380)),
      top: above ? null : rect.bottom + 8, bottom: above ? window.innerHeight - rect.top + 8 : null }
  }
  function showTooltip(event, skill) {
    if (tooltip.value.pinned || rollMenu.value || !window.matchMedia('(hover: hover)').matches) return
    hideTooltip()
    const value = details(event, skill, false)
    tooltipTimer = window.setTimeout(() => { tooltip.value = value; tooltipTimer = null }, TOOLTIP_DELAY_MS)
  }
  function hideHoverTooltip() { if (!tooltip.value.pinned) hideTooltip() }
  function toggleDescription(event, skill) {
    const close = tooltip.value.pinned && tooltip.value.id === skill.id
    hideTooltip()
    rollMenu.value = null
    if (!close) tooltip.value = details(event, skill, true)
  }
  onBeforeUnmount(hideTooltip)
  return { tooltip, showTooltip, hideTooltip, hideHoverTooltip, toggleDescription }
}
