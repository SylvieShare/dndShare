import { computed } from 'vue'
import { useMediaQuery } from '@sylvieshare/share-ui'
import { designMediaQueries } from '@/app/design-tokens'

// CSS px in the browser correspond to the width classes expressed in dp on Android.
export function useAppLayout() {
  const phone = useMediaQuery(designMediaQueries['--ui-phone'])
  const compact = useMediaQuery(designMediaQueries['--ui-compact'])
  const format = computed(() => phone.value ? 'phone' : compact.value ? 'tablet' : 'desktop')
  return { phone, compact, format }
}
