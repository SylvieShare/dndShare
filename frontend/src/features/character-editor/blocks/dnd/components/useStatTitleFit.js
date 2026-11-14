import { onBeforeUnmount, onMounted, watch } from 'vue'

export function useStatTitleFit(element, container, content, compact) {
  let observer, frame, canvas
  function fit() {
    const node = element.value, parent = container.value
    if (!node || !parent || parent.clientWidth <= 0) return
    canvas ||= document.createElement('canvas')
    const context = canvas.getContext('2d'), style = getComputedStyle(node)
    if (!context) return
    const maximum = parseFloat(style.getPropertyValue('--stat-title-max-size')) || 13
    context.font = `${style.fontStyle} ${style.fontWeight} ${maximum}px ${style.fontFamily}`
    const text = style.textTransform === 'uppercase' ? String(content()).toLocaleUpperCase('ru-RU') : String(content())
    const measured = context.measureText(text).width
    const size = Math.min(maximum, maximum * Math.max(1, parent.clientWidth - 1) / Math.max(1, measured))
    const value = `${Math.floor(size * 64) / 64}px`
    if (node.style.getPropertyValue('--stat-title-fitted-size') !== value) node.style.setProperty('--stat-title-fitted-size', value)
  }
  function schedule() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(fit)
  }
  function observe() {
    observer?.disconnect()
    if (container.value) observer?.observe(container.value)
    schedule()
  }
  onMounted(() => {
    observer = new ResizeObserver(schedule)
    observe()
    document.fonts?.addEventListener('loadingdone', schedule)
  })
  watch([element, container, content, compact], observe, { flush: 'post' })
  onBeforeUnmount(() => {
    observer?.disconnect()
    cancelAnimationFrame(frame)
    document.fonts?.removeEventListener('loadingdone', schedule)
  })
}
