import { onBeforeUnmount, onMounted, ref } from 'vue'

const QUERY = '(max-width: 768px)'

export function useIsMobile() {
  const isMobile = ref(typeof window !== 'undefined' && window.matchMedia(QUERY).matches)
  let mq = null
  function onChange(e) { isMobile.value = e.matches }
  onMounted(() => {
    mq = window.matchMedia(QUERY)
    isMobile.value = mq.matches
    mq.addEventListener('change', onChange)
  })
  onBeforeUnmount(() => { mq?.removeEventListener('change', onChange) })
  return isMobile
}
