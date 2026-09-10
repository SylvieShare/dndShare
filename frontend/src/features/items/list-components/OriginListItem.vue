<template>
  <ObjectListItem
    :item="item"
    :type="type"
    :name-en="item.nameEn || ''"
    :custom="item.userId != null"
    :subtitle="subtitle"
    :icon-fallback-to-type="false"
  >
    <template v-if="!kind.includes('class')" #icon>
      <span class="origin-list-portrait" :class="`origin-list-portrait--${kind}`">
        <img v-if="imageUrl" :src="imageUrl" alt="" aria-hidden="true" />
        <span v-else>{{ monogram }}</span>
        <small>{{ kindLabel }}</small>
      </span>
    </template>
    <template #icon-fallback><span class="origin-list-monogram">{{ monogram }}</span></template>
    <template v-if="kind === 'subclass' || kind === 'subrace'" #metric>
      <span class="origin-list-metric">
        <strong>{{ metricValue }}</strong>
        <small>{{ metricLabel }}</small>
      </span>
    </template>
    <template v-if="relationBadge" #trailing>
      <span class="origin-list-relation">{{ relationBadge }}</span>
    </template>
  </ObjectListItem>
</template>

<script setup>
import { computed, watch } from 'vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem.vue'
import { ensureItemNames, itemName } from '@/features/handbook/objects/lib/itemNames'
import {
  abilityNames,
  asiLabel,
  originKind,
  originKindLabel,
  originParentId,
  plainOriginDescription,
  subclassGrantedSpellMetric,
  subclassSpellcastingLabel,
} from '@/features/items/lib/originPresentation'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const data = computed(() => props.item.data || {})
const kind = computed(() => originKind(props.type?.id || props.item.typeId))
const kindLabel = computed(() => originKindLabel(props.type?.id || props.item.typeId))
const parentId = computed(() => originParentId(props.item))
const parentName = computed(() => parentId.value == null ? '' : itemName(parentId.value))
const imageUrl = computed(() => props.item.coverImageUrl || props.item.iconImageUrl || '')
const monogram = computed(() => String(props.item.name || '?').trim().slice(0, 1).toLocaleUpperCase('ru'))
const subclassSpellMetric = computed(() => subclassGrantedSpellMetric(data.value))
const metricValue = computed(() => {
  if (kind.value === 'subclass') return subclassSpellMetric.value.value
  return asiLabel(data.value)?.split(' · ')[0] || '·'
})
const metricLabel = computed(() => {
  if (kind.value === 'subclass') return subclassSpellMetric.value.label
  return 'бонус'
})
const relationBadge = computed(() => {
  if (kind.value === 'race' || kind.value === 'class') return ''
  return parentName.value
})
const subtitle = computed(() => {
  if (kind.value === 'race' || kind.value === 'subrace') {
    return [
      kind.value === 'subrace' ? parentName.value : '',
      data.value.size,
      data.value.speed != null ? `${data.value.speed} фт.` : '',
      plainOriginDescription(props.item, 90),
    ].filter(Boolean).join(' · ')
  }
  return [
    kind.value === 'subclass' ? parentName.value : abilityNames(data.value.primary_abilities).join(', '),
    kind.value === 'subclass' ? subclassSpellcastingLabel(data.value) : '',
    plainOriginDescription(props.item, 90),
  ].filter(Boolean).join(' · ')
})

watch(parentId, id => id != null && ensureItemNames([id]), { immediate: true })
</script>

<style scoped>
.origin-list-portrait {
  position: relative;
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 10px;
  background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 20%, var(--surface)), var(--surface));
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
}
.origin-list-portrait img { width: 100%; height: 100%; object-fit: cover; }
.origin-list-monogram { color: var(--text-muted); font: 700 28px var(--font-display); }
.origin-list-portrait::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 52%, color-mix(in srgb, var(--scrim) 82%, transparent)); pointer-events: none; }
.origin-list-portrait small { position: absolute; z-index: 1; right: 5px; bottom: 4px; color: var(--text-on-accent); font: 750 7px/1 var(--font-ui); letter-spacing: .08em; text-transform: uppercase; text-shadow: 0 1px 4px var(--scrim); }
.origin-list-portrait--subrace,
.origin-list-portrait--subclass { border-radius: 18px 10px 18px 10px; }
.origin-list-metric { min-width: 48px; display: flex; flex-direction: column; align-items: center; gap: 2px; color: var(--text-1); text-align: center; }
.origin-list-metric strong { max-width: 72px; overflow: hidden; font-size: 16px; font-weight: 850; line-height: 1.05; text-overflow: ellipsis; white-space: nowrap; }
.origin-list-metric small { color: var(--text-muted); font-size: 7px; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
.origin-list-relation { max-width: 105px; overflow: hidden; padding: 3px 7px; border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border)); border-radius: 999px; background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--text-2); font-size: 9px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
</style>
