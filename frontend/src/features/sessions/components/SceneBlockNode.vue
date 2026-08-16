<template>
  <article class="scene-block-node" :style="{ '--block-color': sceneBlockColor(block.type) }">
    <header class="scene-block-node-heading" :class="{ 'scene-block-node-heading--icon': headingIcon }">
      <span v-if="headingIcon" class="scene-block-node-heading-icon"><component :is="headingIcon" :size="21" /></span>
      <div class="scene-block-node-heading-copy">
        <span>{{ displayTypeTitle }}</span>
        <strong>{{ displayTitle }}</strong>
      </div>
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
      <SceneEntityBlockPreview
        v-else-if="['location', 'npc', 'quest', 'material'].includes(block.type)"
        :type="block.type"
        :reference-id="block.type === 'material' ? block.materialId : block.data?.referenceId"
        :note="block.data?.note"
      />
      <RichContent v-else-if="block.data?.text" class="scene-block-node-text" :html="block.data.text" />
      <span v-else class="scene-block-node-empty">Описание пусто</span>
    </div>
  </article>
</template>

<script setup>
import { computed, inject } from 'vue'
import { FileText, Gift, Image as ImageIcon, MapPin, MessagesSquare, ScrollText, Sparkles, Swords, UserRound } from '@lucide/vue'
import { RichContent } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import SceneEntityBlockPreview from '@/features/sessions/components/SceneEntityBlockPreview.vue'
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
const sessionWorld = inject('sessionWorld', null)
const material = computed(() => sessionMaterials?.byId(props.block.materialId) || null)
const referenceEntity = computed(() => {
  const id = Number(props.block.type === 'material' ? props.block.materialId : props.block.data?.referenceId)
  if (!id) return null
  if (props.block.type === 'material') return sessionMaterials?.byId(id) || null
  if (props.block.type === 'location') return sessionWorld?.locationsById.value.get(id) || null
  if (props.block.type === 'npc') return sessionWorld?.npcsById.value.get(id) || null
  if (props.block.type === 'quest') return sessionWorld?.questsById.value.get(id) || null
  return null
})
const displayTitle = computed(() => referenceEntity.value?.name || props.block.title || fallbackTitle.value)
const materialMeta = computed(() => materialType(referenceEntity.value?.kind))
const headingIcons = {
  text: FileText,
  list: MessagesSquare,
  combat: Swords,
  reward: Gift,
  image: ImageIcon,
  location: MapPin,
  npc: UserRound,
  quest: ScrollText,
}
const headingIcon = computed(() => props.block.type === 'material'
  ? materialMeta.value.icon
  : headingIcons[props.block.type] || FileText)
const displayTypeTitle = computed(() => props.block.type === 'material' && referenceEntity.value
  ? `${fallbackTitle.value} · ${materialMeta.value.label}`
  : fallbackTitle.value)

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
.scene-block-node-heading--icon { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; gap: 9px; }
.scene-block-node-heading-icon { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid color-mix(in srgb, var(--block-color) 42%, var(--border)); border-radius: 9px; background: color-mix(in srgb, var(--block-color) 10%, var(--surface-raised)); color: var(--block-color); }
.scene-block-node-heading-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.scene-block-node-heading-copy > span {
  color: var(--block-color);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.11em;
  line-height: 1;
  text-transform: uppercase;
}
.scene-block-node-heading-copy > strong {
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
</style>
