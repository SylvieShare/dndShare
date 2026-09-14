<template>
  <AppModalFrame v-if="state.view === 'send'" title="Передать другому игроку" :width="520" :z-index="3400" close-label="Закрыть"
    :dismissible="!state.busy" :show-close="!state.busy" @close="controller.close">
    <CharacterTransferContent :controller="controller" :character-uuid="characterUuid" @view-item="openItem" />
    <template #footer>
      <ActionButton :disabled="state.busy || state.loading || !state.recipient" @click="controller.send">{{ state.busy ? 'Передача…' : 'Передать' }}</ActionButton>
      <ActionButton variant="quiet" :disabled="state.busy" @click="controller.close">Закрыть</ActionButton>
    </template>
  </AppModalFrame>
  <BasePopover :open="popoverOpen" :anchor="controller.anchor" :min-width="0" :z-index="3400" :close-on-scroll="false" :close-on-resize="false"
    role="dialog" :aria-label="title" transition-preset="action-menu" @update:open="!$event && controller.close()">
    <div ref="popoverContent" class="session-popover" tabindex="-1">
      <div class="session-popover-heading">
        <strong>{{ title }}</strong>
        <RemoveButton label="Закрыть" :disabled="state.busy" @click="controller.close" />
      </div>
      <CharacterTransferContent :controller="controller" :character-uuid="characterUuid" @view-item="openItem" />
    </div>
  </BasePopover>
  <ItemViewModal v-if="viewedItem" :item-id="viewedItem.id" :item="viewedItem.item" :item-type-id="viewedItem.typeId" :instance="viewedItem.entry" :z-index="3600" @close="viewedItem = null" />
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ActionButton, AppModalFrame, BasePopover, RemoveButton } from '@sylvieshare/share-ui'
import CharacterTransferContent from './CharacterTransferContent.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
const props = defineProps({ controller: { type: Object, required: true }, characterUuid: { type: String, required: true } })
const viewedItem = ref(null)
function openItem(item) { props.controller.close(); viewedItem.value = item }
const state = computed(() => props.controller.state)
const title = computed(() => state.value.view === 'players' ? 'Другие игроки' : 'События')
const popoverOpen = computed(() => ['players', 'events'].includes(state.value.view))
const popoverContent = ref(null)
watch(() => state.value.view, async (view, previous) => {
  if (['players', 'events'].includes(view)) { await nextTick(); popoverContent.value?.focus({ preventScroll: true }) }
  else if (!view && ['players', 'events'].includes(previous) && popoverContent.value?.contains(document.activeElement)) props.controller.anchor?.focus({ preventScroll: true })
})
</script>
<style scoped>
.session-popover { width: min(360px, calc(100vw - 32px)); max-height: min(540px, calc(100dvh - 32px)); overflow-y: auto; box-sizing: border-box; padding: 14px; outline: none; }
.session-popover-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; color: var(--text-1); font-size: 15px; }
</style>
