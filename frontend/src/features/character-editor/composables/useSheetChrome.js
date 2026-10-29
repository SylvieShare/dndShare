import { onBeforeUnmount, onMounted, onUpdated } from 'vue'

// Measure the real, font-scaled chrome. Scroll viewports overlap it; their own
// content padding keeps the first row below the controls without clipping underlay.
export function useSheetChrome(root) {
  let observer
  const update = () => {
    const element = root.value
    if (!element) return
    const parts = [...element.querySelectorAll(':scope > [data-sheet-chrome]')]
    const height = parts.reduce((sum, part) => sum + part.getBoundingClientRect().height + parseFloat(getComputedStyle(part).marginTop || 0) + parseFloat(getComputedStyle(part).marginBottom || 0), 0)
    const main = parts[0]?.getBoundingClientRect().height || 0
    element.style.setProperty('--sheet-chrome-height', `${height}px`)
    element.style.setProperty('--workspace-extra-fade', `${height - main}px`)
    parts.forEach(part => observer?.observe(part))
  }
  onMounted(() => { observer = new ResizeObserver(update); update() })
  onUpdated(update)
  onBeforeUnmount(() => observer?.disconnect())
}
