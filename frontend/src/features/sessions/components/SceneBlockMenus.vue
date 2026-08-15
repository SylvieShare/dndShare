<template>
  <BasePopover v-model:open="open" :anchor="anchor" :min-width="210" placement="bottom-start">
    <div v-if="block" class="scene-block-menu">
      <RowActionItem
        v-if="block.type === 'combat'"
        :icon="Swords"
        tone="danger"
        @click="run('send-to-combat', block)"
      >В бой</RowActionItem>
      <span v-if="block.type === 'combat'" class="scene-block-menu-rule" />
      <RowActionItem action="edit" @click="run('edit', block)">Редактировать</RowActionItem>
      <RowActionItem action="copy" @click="run('copy', block)">Копировать</RowActionItem>
      <RowActionItem action="delete" tone="danger" @click="run('delete', block)">Удалить</RowActionItem>
    </div>
  </BasePopover>
</template>

<script setup>
import { ref } from 'vue'
import { Swords } from '@lucide/vue'
import { BasePopover } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'

const emit = defineEmits(['edit', 'copy', 'delete', 'send-to-combat'])
const open = ref(false)
const anchor = ref(null)
const block = ref(null)

function openFor(nextBlock, nextAnchor) {
  block.value = nextBlock
  anchor.value = nextAnchor
  open.value = true
}

function close() {
  open.value = false
}

function run(event, value) {
  close()
  emit(event, value)
}

defineExpose({ openFor, close })
</script>

<style scoped>
.scene-block-menu { display: flex; min-width: 200px; flex-direction: column; gap: 2px; padding: 5px; }
.scene-block-menu-rule { height: 1px; margin: 3px 5px; background: var(--border); }
</style>
