import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useFullscreenViewportHeight(scale = 0.94) {
  const height = ref(`${Math.round(scale * 100)}dvh`)

  function sync() {
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    height.value = `${Math.floor(viewportHeight * scale)}px`
  }

  onMounted(() => {
    sync()
    window.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('resize', sync)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', sync)
    window.visualViewport?.removeEventListener('resize', sync)
  })

  return height
}
