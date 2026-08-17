<template>
  <div class="dict-outer" :class="mobilePanelClass">

    <DictTopBar
      :type-name="selectedType && selectedType.name"
      :can-add="isAuth"
      @add="openAddSheet"
    />

    <div class="dict-page">
      <div class="dict-body">

        <DictTypeSidebar
          :types="types"
          :selected-type-id="selectedType && selectedType.id"
          class="dict-sidebar-slot"
          @select="selectType"
        />

        <DictItemGrid
          :type="selectedType"
          :items="items"
          :selected-item="selectedItem"
          :loading="loading"
          class="dict-grid-slot"
          @select="selectItem"
        />

        <DictItemView
          :item="selectedItem"
          :type-id="selectedType && selectedType.id"
          :can-edit="canEditSelected"
          :is-admin="isAdmin"
          class="dict-editor-slot"
          @edit="editModalOpen = true"
          @saved="onItemSaved"
          @deleted="onItemDeleted"
        />

      </div>
    </div>

    <!-- Edit modal (also handles create when item is null) -->
    <SuggestEditModal
      v-if="editModalOpen && selectedItem && selectedType"
      :item="selectedItem"
      :type-id="selectedType.id"
      @close="editModalOpen = false"
      @saved="onItemSaved"
    />

    <SuggestEditModal
      v-if="createSheetOpen && selectedType"
      :type-id="selectedType.id"
      @close="createSheetOpen = false"
      @created="onItemCreated"
    />

  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { suggestApi } from '@/shared/api/suggestApi'
import { useAccountStore } from '@/stores/account'
import { useUiStore } from '@/stores/ui'
import { createHeaderChip } from '@/shared/lib/appHeader'
import DictItemGrid from '@/features/handbook/dictionary/components/DictItemGrid'
import DictItemView from '@/features/handbook/dictionary/components/DictItemView'
import DictTopBar from '@/features/handbook/dictionary/components/DictTopBar'
import DictTypeSidebar from '@/features/handbook/dictionary/components/DictTypeSidebar'
import SuggestEditModal from '@/shared/ui/SuggestEditModal'

const route = useRoute()
const router = useRouter()
const headerOwner = String(route.name)
const accountStore = useAccountStore()
const uiStore = useUiStore()

// ── State ────────────────────────────────────────────────────────────────────
const types = ref([])
const selectedType = ref(null)
const items = ref([])
const loading = ref(false)
const selectedItem = ref(null)
const createSheetOpen = ref(false)
const editModalOpen = ref(false)

// ── Auth ─────────────────────────────────────────────────────────────────────
const isAuth = computed(() => accountStore.authStatus === 'success')
const isAdmin = computed(() => accountStore.user?.roles?.includes('HANDBOOK_ADMIN'))
const canEditSelected = computed(() =>
  isAuth.value && (selectedItem.value?.userId != null || isAdmin.value)
)

// ── Mobile panel ─────────────────────────────────────────────────────────────
const mobilePanelClass = computed(() => {
  if (!selectedType.value) return 'panel-types'
  if (!selectedItem.value) return 'panel-grid'
  return 'panel-editor'
})

// ── Data loading ─────────────────────────────────────────────────────────────
async function fetchTypes() {
  const res = await suggestApi.types()
  types.value = res.items || []
}

async function fetchItems(typeId) {
  loading.value = true
  try {
    const res = await suggestApi.list(typeId)
    items.value = res.items || []
  } finally {
    loading.value = false
  }
}

// ── Selection ─────────────────────────────────────────────────────────────────
function selectType(type) {
  selectedType.value = type
  selectedItem.value = null
  items.value = []
  router.push({ query: { type: type.id } })
  fetchItems(type.id)
}

function selectItem(item) {
  selectedItem.value = item
  router.replace({ query: { type: selectedType.value?.id, item: item.id } })
}

function openAddSheet() { createSheetOpen.value = true }

// ── Events from children ──────────────────────────────────────────────────────
function onItemCreated(item) {
  items.value = [item, ...items.value]
  selectItem(item)
  createSheetOpen.value = false
}

function onItemSaved(item) {
  items.value = items.value.map(i => i.id === item.id ? item : i)
  selectedItem.value = item
}

function onItemDeleted(item) {
  items.value = items.value.filter(i => i.id !== item.id)
  if (selectedItem.value?.id === item.id) selectedItem.value = null
}

// ── URL sync & init ───────────────────────────────────────────────────────────
watch(
  () => [route.query.type, route.query.item],
  async ([rawType, rawItem]) => {
    const typeId = rawType ? Number(rawType) : null
    const itemId = rawItem ? Number(rawItem) : null

    if (!typeId) {
      selectedType.value = null
      selectedItem.value = null
      items.value = []
      return
    }

    if (selectedType.value?.id !== typeId) {
      const type = types.value.find(t => t.id === typeId)
      if (!type) return
      selectedType.value = type
      selectedItem.value = null
      await fetchItems(typeId)
    }

    const item = itemId ? items.value.find(i => i.id === itemId) : null
    selectedItem.value = item || null
  }
)

watch(
  [selectedType, () => items.value.length, loading],
  ([type, count, isLoading]) => {
    uiStore.setHeaderContext({
      title: type?.name || route.meta?.title || 'Словари',
      chip: type && !isLoading ? createHeaderChip(count) : null,
    }, headerOwner)
  },
  { immediate: true },
)

async function init() {
  await fetchTypes()
  const typeId = route.query.type ? Number(route.query.type) : null
  const itemId = route.query.item ? Number(route.query.item) : null
  if (!typeId) return
  const type = types.value.find(t => t.id === typeId)
  if (!type) return
  selectedType.value = type
  await fetchItems(typeId)
  if (itemId) {
    const item = items.value.find(i => i.id === itemId)
    if (item) selectedItem.value = item
  }
}

init()

onBeforeUnmount(() => {
  uiStore.clearHeaderContext(headerOwner)
})
</script>

<style scoped>
.dict-outer {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-h));
  height: calc(100dvh - var(--header-h));
  overflow: hidden;
}

.dict-page {
  flex: 1;
  min-height: 0;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  padding: 0 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* ── 3-panel body ── */
.dict-body {
  flex: 1;
  min-height: 0;
  display: flex;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  border-top: 1px solid var(--border);
  overflow: hidden;
}

/* ── Responsive ── */
@media (max-width: 760px) {
  .dict-outer {
    height: auto;
    min-height: calc(100vh - var(--header-h));
    min-height: calc(100dvh - var(--header-h));
    overflow: visible;
  }
  .dict-page {
    min-height: 0;
    overflow: visible;
    padding: 0 14px;
  }
  .dict-body {
    flex-direction: column;
    overflow: visible;
    border-radius: 8px;
  }
}

@media (max-width: 640px) {
  .dict-outer :deep(.bar-type-name) { display: none; }
}

@media (max-width: 520px) {
  .dict-page {
    padding: 0 10px;
    overflow: visible;
  }

  .dict-body {
    display: block;
    border: none;
    border-radius: 0;
    background: transparent;
    overflow: visible;
  }

  /* panel-types: show only sidebar */
  .panel-types .dict-sidebar-slot {
    display: flex;
    max-height: none;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .panel-types .dict-grid-slot { display: none; }
  .panel-types .dict-editor-slot { display: none; }

  /* panel-grid: show only grid */
  .panel-grid .dict-sidebar-slot { display: none; }
  .panel-grid .dict-grid-slot {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    max-height: none;
  }
  .panel-grid .dict-editor-slot { display: none; }

  /* panel-editor: show only view */
  .panel-editor .dict-sidebar-slot { display: none; }
  .panel-editor .dict-grid-slot { display: none; }
  .panel-editor .dict-editor-slot {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    max-height: none;
    width: 100%;
  }
}
</style>
