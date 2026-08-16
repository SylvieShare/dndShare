<template>
  <div v-if="entity" class="scene-entity-preview" :class="`scene-entity-preview--${type}`">
    <template v-if="type === 'location'">
      <div class="scene-entity-location-hero" :style="{ '--entity-image': `url(${sessionImageUrl(entity)})` }">
        <span><MapPin :size="13" />{{ locationMeta.label }}</span>
        <strong>{{ entity.name }}</strong>
      </div>
      <div v-if="locationPath" class="scene-entity-path">{{ locationPath }}</div>
      <p v-if="entity.description" class="scene-entity-description">{{ entity.description }}</p>
      <div class="scene-entity-facts">
        <span>{{ childCount }} {{ ruPlural(childCount, 'место внутри', 'места внутри', 'мест внутри') }}</span>
        <span>{{ relationCountLabel }}</span>
      </div>
    </template>

    <template v-else-if="type === 'npc'">
      <div class="scene-entity-npc-head" :style="{ '--npc-color': entity.color }">
        <img :src="npcImageUrl(entity)" alt="" :style="npcPortraitStyle" />
        <div>
          <span>NPC</span>
          <strong>{{ entity.name }}</strong>
          <small>{{ npcIdentity }}</small>
        </div>
      </div>
      <p v-if="entity.description" class="scene-entity-description">{{ entity.description }}</p>
      <div class="scene-entity-facts">
        <span v-if="linkedLocations.length"><MapPin :size="12" />{{ linkedLocations.join(', ') }}</span>
        <span>{{ relationCountLabel }}</span>
      </div>
    </template>

    <template v-else-if="type === 'quest'">
      <div v-if="questFields.length" class="scene-entity-quest-fields">
        <section v-for="field in questFields" :key="field.key" :class="{ primary: field.key === 'goal' }">
          <strong>{{ field.label }}</strong>
          <p>{{ field.value }}</p>
        </section>
      </div>
      <span v-else class="scene-entity-empty">Детали задания не заполнены</span>
      <div class="scene-entity-facts"><span :style="{ color: questMeta.color }">{{ questMeta.label }}</span><span>{{ relationCountLabel }}</span></div>
    </template>

    <template v-else-if="type === 'material'">
      <div v-if="['image', 'map'].includes(entity.kind)" class="scene-entity-material-image">
        <img :src="entity.assetUrl" :alt="entity.name" />
      </div>
      <p v-if="entity.caption" class="scene-entity-description scene-entity-description--caption">{{ entity.caption }}</p>
      <div v-if="entity.content" class="scene-entity-material-content" :class="entity.kind === 'note' ? `material-note--${entity.noteStyle}` : ''">
        {{ entity.content }}
      </div>
      <div class="scene-entity-facts"><span>{{ relationCountLabel }}</span></div>
    </template>

    <footer v-if="resolvedRelations.length" class="scene-entity-relations">
      <span>Связи</span>
      <div>
        <span v-for="relation in resolvedRelations" :key="relation.key" :style="{ '--relation-color': relation.typeMeta.color }">
          <i />{{ relation.title }}
        </span>
      </div>
    </footer>
    <section v-if="note" class="scene-entity-canvas-note">
      <strong>Заметка в сценарии</strong>
      <p>{{ note }}</p>
    </section>
  </div>
  <span v-else class="scene-entity-empty">Объект не найден</span>
</template>

<script setup>
import { computed, inject } from 'vue'
import { MapPin } from '@lucide/vue'
import { locationBreadcrumb, locationKind, ruPlural } from '@/features/sessions/lib/sessionWorld'
import { buildSessionEntityCatalog, questStatus, sessionEntityKey } from '@/features/sessions/lib/sessionEntityRelations'
import { npcImageUrl, sessionImageUrl } from '@/features/sessions/lib/sessionImages'

const props = defineProps({
  type: { type: String, required: true },
  referenceId: { type: [Number, String], default: null },
  note: { type: String, default: '' },
})

const sessionMaterials = inject('sessionMaterials', null)
const sessionWorld = inject('sessionWorld', null)

const entity = computed(() => {
  const id = Number(props.referenceId)
  if (!id) return null
  if (props.type === 'material') return sessionMaterials?.byId(id) || null
  if (props.type === 'location') return sessionWorld?.locationsById.value.get(id) || null
  if (props.type === 'npc') return sessionWorld?.npcsById.value.get(id) || null
  if (props.type === 'quest') return sessionWorld?.questsById.value.get(id) || null
  return null
})

const catalog = computed(() => buildSessionEntityCatalog(sessionWorld, sessionMaterials))
const catalogByKey = computed(() => new Map(catalog.value.map(item => [item.key, item])))
const resolvedRelations = computed(() => (entity.value?.relations || [])
  .map(relation => catalogByKey.value.get(sessionEntityKey(relation.type, relation.id)))
  .filter(Boolean))
const relationCountLabel = computed(() => {
  const count = entity.value?.relations?.length || 0
  return `${count} ${ruPlural(count, 'связь', 'связи', 'связей')}`
})

const locationMeta = computed(() => locationKind(entity.value?.kind))
const locationPath = computed(() => {
  if (!entity.value || props.type !== 'location') return ''
  return locationBreadcrumb(entity.value, sessionWorld?.locationsById.value || new Map())
    .slice(0, -1).map(item => item.name).join(' / ')
})
const childCount = computed(() => props.type === 'location'
  ? (sessionWorld?.locations.value || []).filter(item => item.parentLocationId === entity.value?.id).length
  : 0)

const npcIdentity = computed(() => [entity.value?.raceName, entity.value?.role].filter(Boolean).join(' · ') || 'Раса и роль не указаны')
const npcPortraitStyle = computed(() => ({ objectPosition: `${(entity.value?.imageFocalX ?? .5) * 100}% ${(entity.value?.imageFocalY ?? .5) * 100}%` }))
const linkedLocations = computed(() => (entity.value?.relations || [])
  .filter(relation => relation.type === 'location')
  .map(relation => sessionWorld?.locationsById.value.get(Number(relation.id))?.name)
  .filter(Boolean))

const questMeta = computed(() => questStatus(entity.value?.status))
const questFields = computed(() => [
  { key: 'goal', label: 'Цель', value: entity.value?.goal },
  { key: 'condition', label: 'Условие', value: entity.value?.condition },
  { key: 'reward', label: 'Награда', value: entity.value?.reward },
  { key: 'consequences', label: 'Последствия', value: entity.value?.consequences },
  { key: 'notes', label: 'Заметки', value: entity.value?.notes },
].filter(field => field.value))

</script>

<style scoped>
.scene-entity-preview { display: flex; flex-direction: column; gap: 10px; color: var(--text-2); }
.scene-entity-location-hero { position: relative; min-height: 116px; display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; overflow: hidden; padding: 13px; border-radius: 9px; background-image: linear-gradient(0deg, color-mix(in srgb, var(--bg) 94%, transparent), color-mix(in srgb, var(--bg) 18%, transparent)), var(--entity-image); background-position: center; background-size: cover; }
.scene-entity-location-hero span { display: flex; align-items: center; gap: 5px; color: color-mix(in srgb, var(--block-color) 78%, var(--text-on-accent)); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
.scene-entity-location-hero strong { color: var(--text-on-accent); font-family: var(--font-display); font-size: 20px; line-height: 1.05; text-shadow: 0 2px 12px var(--bg); }
.scene-entity-path { color: var(--text-muted); font-size: 9px; }
.scene-entity-description { margin: 0; color: var(--text-2); font-size: 11px; line-height: 1.55; white-space: pre-wrap; }
.scene-entity-description--caption { color: var(--text-muted); font-style: italic; }
.scene-entity-facts { display: flex; flex-wrap: wrap; gap: 6px; }
.scene-entity-facts > span { min-height: 23px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border: 1px solid color-mix(in srgb, var(--block-color) 24%, var(--border)); border-radius: 999px; background: color-mix(in srgb, var(--block-color) 6%, transparent); color: var(--text-muted); font-size: 9px; }
.scene-entity-npc-head { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: 12px; padding: 10px; border-radius: 10px; background: linear-gradient(120deg, color-mix(in srgb, var(--npc-color) 15%, var(--surface-raised)), var(--surface-raised)); }
.scene-entity-npc-head img { width: 76px; height: 76px; display: block; border: 1px solid color-mix(in srgb, var(--npc-color) 52%, var(--border)); border-radius: 18px; object-fit: cover; }
.scene-entity-npc-head > div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.scene-entity-npc-head span { color: var(--block-color); font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
.scene-entity-npc-head strong { overflow-wrap: anywhere; color: var(--text-1); font-family: var(--font-display); font-size: 17px; line-height: 1.1; }
.scene-entity-npc-head small { color: var(--text-muted); font-size: 9px; line-height: 1.35; }
.scene-entity-quest-fields { display: flex; flex-direction: column; gap: 6px; }
.scene-entity-quest-fields section { padding: 8px 9px; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--surface-raised) 75%, transparent); }
.scene-entity-quest-fields section.primary { border-color: color-mix(in srgb, var(--block-color) 34%, var(--border)); background: color-mix(in srgb, var(--block-color) 6%, var(--surface-raised)); }
.scene-entity-quest-fields strong { display: block; margin-bottom: 3px; color: var(--text-muted); font-size: 8px; text-transform: uppercase; letter-spacing: .08em; }
.scene-entity-quest-fields section.primary strong { color: var(--block-color); }
.scene-entity-quest-fields p { margin: 0; color: var(--text-2); font-size: 10px; line-height: 1.45; white-space: pre-wrap; }
.scene-entity-material-image { position: relative; overflow: hidden; border-radius: 9px; background: var(--bg); }
.scene-entity-material-image img { width: 100%; max-height: 230px; display: block; object-fit: contain; }
.scene-entity-material-content { max-height: 260px; overflow: auto; padding: 13px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-2); font-size: 10px; line-height: 1.55; white-space: pre-wrap; user-select: text; }
.scene-entity-material-content.material-note--parchment { background: var(--material-note-parchment-bg); color: var(--material-note-parchment-text); }.scene-entity-material-content.material-note--letter { background: var(--material-note-letter-bg); color: var(--material-note-letter-text); }.scene-entity-material-content.material-note--dossier { border-color: var(--material-note-dossier-border); background: var(--material-note-dossier-bg); color: var(--material-note-dossier-text); }.scene-entity-material-content.material-note--arcane { background: var(--material-note-arcane-bg); color: var(--material-note-arcane-text); }
.scene-entity-relations { display: flex; flex-direction: column; gap: 5px; padding-top: 8px; border-top: 1px solid var(--border); }
.scene-entity-relations > span { color: var(--text-muted); font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .09em; }
.scene-entity-relations > div { display: flex; flex-wrap: wrap; gap: 4px; }
.scene-entity-relations > div > span { display: inline-flex; align-items: center; gap: 5px; padding: 3px 6px; border-radius: 6px; background: color-mix(in srgb, var(--relation-color) 8%, var(--surface-raised)); color: var(--text-2); font-size: 8px; }
.scene-entity-relations i { width: 5px; height: 5px; flex: none; border-radius: 50%; background: var(--relation-color); }
.scene-entity-canvas-note { padding: 9px 10px; border: 1px dashed color-mix(in srgb, var(--block-color) 38%, var(--border)); border-radius: 8px; background: color-mix(in srgb, var(--block-color) 6%, transparent); }.scene-entity-canvas-note strong { display: block; margin-bottom: 4px; color: var(--block-color); font-size: 8px; letter-spacing: .08em; text-transform: uppercase; }.scene-entity-canvas-note p { margin: 0; color: var(--text-2); font-size: 10px; line-height: 1.5; white-space: pre-wrap; }
.scene-entity-empty { color: var(--text-muted); font-size: 10px; font-style: italic; }
</style>
