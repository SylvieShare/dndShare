<template>
  <article class="scene-block-node" :style="{ '--block-color': sceneBlockColor(block.type) }">
    <header class="scene-block-node-heading">
      <span>{{ fallbackTitle }}</span>
      <strong>{{ block.title || fallbackTitle }}</strong>
    </header>
    <div class="scene-block-node-preview">
      <template v-if="block.type === 'list'">
        <div
          v-for="(row, index) in previewRows"
          :key="index"
          class="scene-block-node-dialogue"
          :style="{ '--dialogue-color': row.color }"
        >
          <b class="scene-block-node-speaker">{{ row.left || 'Реплика' }}</b>
          <span class="scene-block-node-dialogue-line" aria-hidden="true" />
          <p>{{ row.right }}</p>
        </div>
        <span v-if="!previewRows.length" class="scene-block-node-empty">Диалог пуст</span>
      </template>
      <template v-else-if="block.type === 'combat'">
        <div v-for="(creature, index) in creatures" :key="creatureKey(creature, index)" class="scene-block-node-creature">
          <ItemIcon
            v-if="creature.kind === 'handbook'"
            :item="itemById(creature.itemId)"
            :size="32"
            placeholder
          />
          <span v-else class="scene-block-node-creature-placeholder" aria-hidden="true"><Sparkles :size="16" /></span>
          <b>{{ itemById(creature.itemId)?.name || creature.name || 'Существо' }}</b>
          <span v-if="creature.count > 1">×{{ creature.count }}</span>
        </div>
        <span v-if="!creatures.length" class="scene-block-node-empty">Существа не добавлены</span>
      </template>
      <template v-else-if="block.type === 'reward'">
        <div v-for="(item, index) in rewardItems" :key="`${item.itemId}:${index}`" class="scene-block-node-reward">
          <ItemIcon :item="itemById(item.itemId)" :size="28" placeholder />
          <b>{{ itemById(item.itemId)?.name || item.name || `Предмет #${item.itemId}` }}</b>
          <span v-if="item.count > 1">×{{ item.count }}</span>
        </div>
        <span v-if="!rewardItems.length" class="scene-block-node-empty">Награда не добавлена</span>
      </template>
      <template v-else-if="block.type === 'image'">
        <img v-if="material" class="scene-block-node-image" :src="material.assetUrl" :alt="material.name" />
        <span v-else class="scene-block-node-empty">Материал не выбран</span>
      </template>
      <template v-else-if="block.type === 'material'">
        <div v-if="material" class="scene-block-node-material">
          <img v-if="['image', 'map'].includes(material.kind)" :src="material.assetUrl" :alt="material.name" />
          <span v-else><component :is="materialType(material.kind).icon" :size="24" /></span>
          <div><b>{{ material.name }}</b><small>{{ materialType(material.kind).label }}<template v-if="material.caption"> · {{ material.caption }}</template></small></div>
        </div>
        <span v-else class="scene-block-node-empty">Материал не выбран</span>
      </template>
      <RichContent v-else-if="block.data?.text" class="scene-block-node-text" :html="block.data.text" />
      <span v-else class="scene-block-node-empty">Описание пусто</span>
    </div>
  </article>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Sparkles } from '@lucide/vue'
import { RichContent } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { hydrateDialogueRows } from '@/features/sessions/lib/dialogueRows'
import { sceneBlockColor, sceneBlockType } from '@/features/sessions/lib/sceneBlockTypes'
import { materialType } from '@/features/sessions/lib/sessionMaterials'

const props = defineProps({
  block: { type: Object, required: true },
  itemsById: { type: Map, default: () => new Map() },
})

const fallbackTitle = computed(() => sceneBlockType(props.block.type).label)
const previewRows = computed(() => {
  const rows = Array.isArray(props.block.data?.rows) ? props.block.data.rows : []
  return hydrateDialogueRows(rows.filter(row => row?.left || row?.right))
})
const creatures = computed(() => Array.isArray(props.block.data?.creatures) ? props.block.data.creatures : [])
const rewardItems = computed(() => Array.isArray(props.block.data?.items) ? props.block.data.items : [])
const sessionMaterials = inject('sessionMaterials', null)
const material = computed(() => sessionMaterials?.byId(props.block.materialId) || null)

function itemById(id) {
  return props.itemsById.get(String(id)) ?? null
}

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
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--block-color) 52%, var(--border));
  user-select: none;
  transition: background 0.15s, box-shadow 0.15s;
}
.scene-block-node:hover {
  background: color-mix(in srgb, var(--block-color) 8%, var(--surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--block-color) 82%, var(--border));
}
.scene-block-node-heading {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-bottom: 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--block-color) 32%, var(--border));
}
.scene-block-node-heading > span {
  color: var(--block-color);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.11em;
  line-height: 1;
  text-transform: uppercase;
}
.scene-block-node-heading > strong {
  overflow-wrap: anywhere;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 760;
  line-height: 1.18;
  text-shadow: 0 1px 12px color-mix(in srgb, var(--block-color) 16%, transparent);
}
.scene-block-node-preview { color: var(--text-2); font-size: 11px; line-height: 1.42; overflow-wrap: anywhere; }
.scene-block-node-dialogue { display: grid; grid-template-columns: minmax(58px, .42fr) 2px minmax(0, 1fr); align-items: stretch; gap: 9px; padding: 7px 0; }
.scene-block-node-dialogue + .scene-block-node-dialogue { border-top: 1px solid var(--border); }
.scene-block-node-speaker { min-width: 0; align-self: start; overflow-wrap: anywhere; color: var(--dialogue-color); text-align: right; }
.scene-block-node-dialogue-line { min-height: 24px; border-radius: 2px; background: var(--dialogue-color); }
.scene-block-node-dialogue p { min-width: 0; margin: 0; color: var(--text-2); white-space: pre-wrap; }
.scene-block-node-text :deep(:first-child) { margin-top: 0; }
.scene-block-node-text :deep(:last-child) { margin-bottom: 0; }
.scene-block-node-creature,
.scene-block-node-reward { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border); }
.scene-block-node-creature:last-child { border-bottom: 0; }
.scene-block-node-reward:last-child { border-bottom: 0; }
.scene-block-node-creature-placeholder { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--block-color) 11%, var(--surface-raised)); color: var(--block-color); }
.scene-block-node-creature b,
.scene-block-node-reward b { min-width: 0; overflow-wrap: anywhere; }
.scene-block-node-creature > span:last-child,
.scene-block-node-reward > span:last-child { color: var(--block-color); font-weight: 800; }
.scene-block-node-empty { color: var(--text-muted); font-style: italic; }
.scene-block-node-image { width: 100%; max-height: 220px; display: block; border-radius: 7px; object-fit: cover; }
.scene-block-node-material { display: grid; grid-template-columns: 46px minmax(0, 1fr); align-items: center; gap: 10px; }.scene-block-node-material > img, .scene-block-node-material > span { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 8px; object-fit: cover; background: color-mix(in srgb, var(--block-color) 12%, var(--surface-raised)); color: var(--block-color); }.scene-block-node-material > div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }.scene-block-node-material b, .scene-block-node-material small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.scene-block-node-material b { color: var(--text-1); font-size: 13px; }.scene-block-node-material small { color: var(--text-muted); font-size: 10px; }
</style>
