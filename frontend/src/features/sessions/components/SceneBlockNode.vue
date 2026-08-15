<template>
  <article class="scene-block-node" :style="{ '--block-color': sceneBlockColor(block.type) }">
    <strong>{{ block.title || fallbackTitle }}</strong>
    <div class="scene-block-node-preview">
      <template v-if="block.type === 'list'">
        <div
          v-for="(row, index) in previewRows"
          :key="index"
          class="scene-block-node-dialogue"
          :style="{ '--dialogue-color': row.color }"
        >
          <div class="scene-block-node-speaker">
            <span aria-hidden="true" />
            <b>{{ row.left || 'Реплика' }}</b>
          </div>
          <p>{{ row.right }}</p>
        </div>
        <span v-if="!previewRows.length" class="scene-block-node-empty">Диалог пуст</span>
      </template>
      <template v-else-if="block.type === 'combat'">
        <div v-for="(creature, index) in creatures" :key="creatureKey(creature, index)" class="scene-block-node-creature">
          <span class="scene-block-node-creature-mark" aria-hidden="true">{{ creature.kind === 'handbook' ? '◆' : '◇' }}</span>
          <b>{{ creature.name || 'Существо' }}</b>
          <span v-if="creature.count > 1">×{{ creature.count }}</span>
        </div>
        <span v-if="!creatures.length" class="scene-block-node-empty">Существа не добавлены</span>
      </template>
      <RichContent v-else-if="block.data?.text" class="scene-block-node-text" :html="block.data.text" />
      <span v-else class="scene-block-node-empty">Пустой текст</span>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { RichContent } from '@sylvieshare/share-ui'
import { hydrateDialogueRows } from '@/features/sessions/lib/dialogueRows'
import { sceneBlockColor, sceneBlockType } from '@/features/sessions/lib/sceneBlockTypes'

const props = defineProps({
  block: { type: Object, required: true },
})

const fallbackTitle = computed(() => sceneBlockType(props.block.type).label)
const previewRows = computed(() => {
  const rows = Array.isArray(props.block.data?.rows) ? props.block.data.rows : []
  return hydrateDialogueRows(rows.filter(row => row?.left || row?.right))
})
const creatures = computed(() => Array.isArray(props.block.data?.creatures) ? props.block.data.creatures : [])

function creatureKey(creature, index) {
  return creature.id || `${creature.kind}:${creature.itemId ?? creature.name}:${index}`
}
</script>

<style scoped>
.scene-block-node {
  position: relative;
  width: 100%;
  min-height: 96px;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 15px 16px 14px;
  border: none;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--border);
  user-select: none;
  transition: background 0.15s, box-shadow 0.15s;
}
.scene-block-node:hover {
  background: color-mix(in srgb, var(--block-color) 8%, var(--surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--block-color) 38%, var(--border));
}
.scene-block-node > strong {
  overflow-wrap: anywhere;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 1.24;
}
.scene-block-node-preview { color: var(--text-2); font-size: 11px; line-height: 1.42; overflow-wrap: anywhere; }
.scene-block-node-dialogue { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 5px 0; }
.scene-block-node-dialogue + .scene-block-node-dialogue { border-top: 1px solid var(--border); }
.scene-block-node-speaker { display: flex; align-items: center; gap: 6px; min-width: 0; color: var(--dialogue-color); }
.scene-block-node-speaker > span { width: 7px; height: 7px; flex: none; border-radius: 50%; background: currentColor; }
.scene-block-node-speaker b { min-width: 0; overflow-wrap: anywhere; }
.scene-block-node-dialogue p { margin: 0 0 0 13px; padding: 5px 8px; border-radius: 3px 9px 9px 9px; background: color-mix(in srgb, var(--dialogue-color) 9%, transparent); color: var(--text-2); white-space: pre-wrap; }
.scene-block-node-text :deep(:first-child) { margin-top: 0; }
.scene-block-node-text :deep(:last-child) { margin-bottom: 0; }
.scene-block-node-creature { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px solid var(--border); }
.scene-block-node-creature:last-child { border-bottom: 0; }
.scene-block-node-creature-mark { color: var(--block-color); font-size: 9px; }
.scene-block-node-creature b { min-width: 0; overflow-wrap: anywhere; }
.scene-block-node-creature > span:last-child { color: var(--block-color); font-weight: 800; }
.scene-block-node-empty { color: var(--text-muted); font-style: italic; }
</style>
