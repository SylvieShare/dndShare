import { nextTick, onBeforeUnmount, onMounted, onUpdated, ref } from 'vue'

export function useCreatureNameFit() {
  const nameRow = ref(null), nameText = ref(null)
  let observer, frame = 0

  function fit() {
    frame = 0
    const row = nameRow.value, text = nameText.value
    if (!row || !text || !row.clientWidth) return
    const children = [...row.children]
    const siblings = children.filter(child => !child.contains(text))
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0
    const available = Math.max(0, row.clientWidth - siblings.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) - gap * (children.length - 1))
    text.style.fontSize = '13px'
    const natural = text.getBoundingClientRect().width
    text.style.fontSize = `${Math.min(13, Math.max(.1, 13 * (available - .5) / (natural || 1)))}px`
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(fit)
  }
  onMounted(async () => {
    await nextTick()
    if (!nameRow.value) return
    observer = new ResizeObserver(schedule)
    if (nameRow.value) observer.observe(nameRow.value)
    schedule()
    document.fonts?.ready.then(() => { if (nameRow.value) schedule() })
  })
  onUpdated(schedule)
  onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(frame) })
  return { nameRow, nameText }
}
