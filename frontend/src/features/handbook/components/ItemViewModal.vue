<template>
  <AppModal
    ref="modal"
    wide
    flush
    :show-close="false"
    :show-handle="false"
    :aria-label="item?.name || (loading ? 'Загрузка…' : 'Предмет')"
    @close="$emit('close')"
  >
    <section class="iv-shell">
      <span class="iv-handle" aria-hidden="true"></span>
      <button class="iv-close" type="button" aria-label="Закрыть" @click="close">
        <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </button>

      <div class="iv-body">
        <div v-if="loading" class="iv-loading">Загрузка…</div>
        <HandbookItemDetail v-else :item="item" :type="type" :can-edit="false" :show-title="true" :actor-name="actorName" />
      </div>

      <footer v-if="item && $slots.actions" class="iv-footer">
        <slot name="actions" :item="item" :type="type" />
      </footer>
    </section>
  </AppModal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { useItemTypesStore } from '@/stores/itemTypes'
import { AppModal } from '@sylvieshare/share-ui'
import HandbookItemDetail from '@/features/handbook/components/HandbookItemDetail'

const itemCache = new Map()
const inflightItems = new Map()

async function loadItem(id) {
  if (itemCache.has(id)) return itemCache.get(id)
  if (inflightItems.has(id)) return inflightItems.get(id)
  const p = itemsApi.byIds([id]).then(res => {
    const found = res?.items?.[0] ?? null
    if (found) itemCache.set(id, found)
    inflightItems.delete(id)
    return found
  }).catch(() => { inflightItems.delete(id); return null })
  inflightItems.set(id, p)
  return p
}

const props = defineProps({
  itemTypeId: { type: Number, required: true },
  itemId: { type: Number, default: null },
  item: { type: Object, default: null },
  actorName: { type: String, default: '' },
})

defineEmits(['close'])

const item = ref(props.item)
const type = ref(null)
const loading = ref(false)
const modal = ref(null)

const itemTypesStore = useItemTypesStore()
async function load() {
  loading.value = true
  try {
    const [typeRes, itemRes] = await Promise.all([
      itemTypesStore.ensureType(props.itemTypeId).catch(() => null),
      props.item ? Promise.resolve(props.item) : (props.itemId != null ? loadItem(props.itemId) : Promise.resolve(null)),
    ])
    type.value = typeRes ?? { id: props.itemTypeId, name: '', fields: [] }
    item.value = itemRes
  } finally {
    loading.value = false
  }
}

watch(() => [props.itemId, props.itemTypeId, props.item], load, { immediate: true })

function close() {
  modal.value?.requestClose()
}
</script>

<style scoped>
.iv-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  max-height: inherit;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}

.iv-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.iv-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 16%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--scrim) 72%, transparent);
  color: var(--text-on-accent);
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: background .15s, transform .15s;
}

.iv-close:hover {
  background: var(--scrim);
  transform: scale(1.04);
}

.iv-handle {
  display: none;
}

.iv-footer {
  position: relative;
  z-index: 2;
  flex: none;
  min-height: 62px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 24px;
  background: var(--bg);
  border-top: 1px solid var(--border);
}

.iv-loading {
  padding: 60px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-2);
}

@media (max-width: 640px) {
  .iv-handle {
    position: absolute;
    top: 8px;
    left: 50%;
    z-index: 10;
    display: block;
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--text-on-accent) 58%, transparent);
    box-shadow: 0 1px 6px var(--scrim);
    transform: translateX(-50%);
  }

  .iv-close {
    top: 14px;
    right: 12px;
  }

  .iv-footer {
    min-height: 66px;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  }
}
</style>
