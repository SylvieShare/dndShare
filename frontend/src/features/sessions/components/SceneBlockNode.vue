<template>
  <article class="scene-block-node" :style="{ '--block-color': block.color || 'var(--accent)' }">
    <span class="scene-block-node-strip" />
    <header>
      <span class="scene-block-node-kind">{{ block.type === 'list' ? 'СПИСОК' : 'ТЕКСТ' }}</span>
      <RowActionMenu v-if="isDm">
        <template #default="{ close }">
          <RowActionItem action="edit" @click="$emit('edit', block); close()">Редактировать</RowActionItem>
          <RowActionItem action="delete" tone="danger" @click="$emit('delete', block); close()">Удалить</RowActionItem>
        </template>
      </RowActionMenu>
    </header>
    <strong>{{ block.title || (block.type === 'list' ? 'Список' : 'Текст') }}</strong>
    <div class="scene-block-node-preview">
      <template v-if="block.type === 'list'">
        <div v-for="(row, index) in previewRows" :key="index" class="scene-block-node-row">
          <b>{{ row.left }}</b><span>{{ row.right }}</span>
        </div>
        <span v-if="!previewRows.length" class="scene-block-node-empty">Пустой список</span>
      </template>
      <RichContent v-else-if="block.data?.text" class="scene-block-node-text" :html="block.data.text" />
      <span v-else class="scene-block-node-empty">Пустой текст</span>
    </div>
    <small>Двойной клик — редактировать</small>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import RichContent from '@/shared/ui/RichContent'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionMenu from '@/shared/ui/RowActionMenu.vue'

const props = defineProps({
  block: { type: Object, required: true },
  isDm: { type: Boolean, default: false },
})
defineEmits(['edit', 'delete'])

const previewRows = computed(() => {
  const rows = Array.isArray(props.block.data?.rows) ? props.block.data.rows : []
  return rows.filter(row => row?.left || row?.right).slice(0, 3)
})
</script>

<style scoped>
.scene-block-node {
  position: absolute;
  inset: 0;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px 13px 10px 16px;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  user-select: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.scene-block-node:hover { border-color: color-mix(in srgb, var(--block-color) 62%, var(--border)); }
.scene-block-node-strip { position: absolute; top: 0; bottom: 0; left: 0; width: 4px; background: var(--block-color); }
.scene-block-node header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.scene-block-node-kind { color: var(--block-color); font-size: 9px; font-weight: 850; letter-spacing: 0.09em; }
.scene-block-node > strong {
  overflow: hidden;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.scene-block-node-preview {
  min-height: 0;
  flex: 1;
  overflow: hidden;
  color: var(--text-2);
  font-size: 11px;
  line-height: 1.38;
}
.scene-block-node-row { display: grid; grid-template-columns: minmax(52px, .7fr) 1.3fr; gap: 8px; padding: 3px 0; border-bottom: 1px solid var(--border); }
.scene-block-node-row b { overflow: hidden; color: var(--block-color); text-overflow: ellipsis; white-space: nowrap; }
.scene-block-node-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scene-block-node-text { max-height: 82px; overflow: hidden; }
.scene-block-node-empty { color: var(--text-muted); font-style: italic; }
.scene-block-node > small { color: var(--text-muted); font-size: 9px; }
</style>
