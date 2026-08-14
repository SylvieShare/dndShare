<template>
  <article class="scene-block-node" :style="{ '--block-color': sceneBlockColor(block.type) }">
    <span class="scene-block-node-strip" />
    <strong>{{ block.title || fallbackTitle }}</strong>
    <div class="scene-block-node-preview">
      <template v-if="block.type === 'list'">
        <div v-for="(row, index) in previewRows" :key="index" class="scene-block-node-row">
          <b>{{ row.left }}</b><span>{{ row.right }}</span>
        </div>
        <span v-if="!previewRows.length" class="scene-block-node-empty">Пустой список</span>
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
import RichContent from '@/shared/ui/RichContent'
import { sceneBlockColor, sceneBlockType } from '@/features/sessions/lib/sceneBlockTypes'

const props = defineProps({
  block: { type: Object, required: true },
})

const fallbackTitle = computed(() => sceneBlockType(props.block.type).label)
const previewRows = computed(() => {
  const rows = Array.isArray(props.block.data?.rows) ? props.block.data.rows : []
  return rows.filter(row => row?.left || row?.right)
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
  padding: 15px 16px 14px 18px;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  user-select: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.scene-block-node:hover { border-color: color-mix(in srgb, var(--block-color) 62%, var(--border)); }
.scene-block-node-strip { position: absolute; top: 0; bottom: 0; left: 0; width: 4px; background: var(--block-color); }
.scene-block-node > strong {
  overflow-wrap: anywhere;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 1.24;
}
.scene-block-node-preview { color: var(--text-2); font-size: 11px; line-height: 1.42; overflow-wrap: anywhere; }
.scene-block-node-row { display: grid; grid-template-columns: minmax(52px, .7fr) 1.3fr; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--border); }
.scene-block-node-row:last-child { border-bottom: 0; }
.scene-block-node-row b { min-width: 0; color: var(--block-color); overflow-wrap: anywhere; }
.scene-block-node-row span { min-width: 0; overflow-wrap: anywhere; }
.scene-block-node-text :deep(:first-child) { margin-top: 0; }
.scene-block-node-text :deep(:last-child) { margin-bottom: 0; }
.scene-block-node-creature { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px solid var(--border); }
.scene-block-node-creature:last-child { border-bottom: 0; }
.scene-block-node-creature-mark { color: var(--block-color); font-size: 9px; }
.scene-block-node-creature b { min-width: 0; overflow-wrap: anywhere; }
.scene-block-node-creature > span:last-child { color: var(--block-color); font-weight: 800; }
.scene-block-node-empty { color: var(--text-muted); font-style: italic; }
</style>
