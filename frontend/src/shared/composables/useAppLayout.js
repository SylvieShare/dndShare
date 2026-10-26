import { computed } from 'vue'
import { useIsMobile } from '@sylvieshare/share-ui'

// CSS px in the browser correspond to the width classes expressed in dp on Android.
export function useAppLayout() {
  const phone = useIsMobile(599)
  const compact = useIsMobile(1199)
  const format = computed(() => phone.value ? 'phone' : compact.value ? 'tablet' : 'desktop')
  return { phone, compact, format }
}
