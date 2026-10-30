import { getCurrentInstance, inject, unref } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'

// Owned by the open character. Responsive block remounts reuse data and pending requests.
export function useCharacterItemCatalog(context) {
  const owner = context ?? (getCurrentInstance() ? inject('charCtx', null) : null)
  const resources = owner?.characterResources
  return {
    snapshot: () => Object.fromEntries(unref(resources?.itemsById) || []),
    load: ids => resources?.ensureItems ? resources.ensureItems(ids) : itemsApi.byIds(ids),
    remember: items => resources?.rememberItems?.(items),
  }
}
