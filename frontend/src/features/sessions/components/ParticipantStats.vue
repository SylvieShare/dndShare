<template>
  <div class="participant-stats" aria-label="Защита и пассивные навыки">
    <LoadingIndicator v-if="loading" inline size="xs" label="Расчёт показателей" />
    <p v-else-if="error" role="alert" :title="error">{{ error }}</p>
    <template v-else>
      <span v-for="indicator in indicators" :key="indicator.key" class="participant-stat" tabindex="0" :aria-label="`${indicator.label}: ${indicator.value}`"
        @mouseenter="showTooltip($event, indicator)" @mouseleave="tooltip = null" @focus="showTooltip($event, indicator)" @blur="tooltip = null">
        <strong>{{ indicator.value }}</strong><component :is="indicator.icon" :size="14" aria-hidden="true" />
      </span>
    </template>
  </div>
  <ItemTooltip v-if="tooltip" :anchor="tooltip.anchor" :title="tooltip.label" :desc="tooltip.description" :width="280" :z-index="9500" />
</template>
<script setup>
import { computed, ref, shallowRef, watch } from 'vue'
import { Eye, Search, Shield } from '@lucide/vue'
import { LoadingIndicator } from '@sylvieshare/share-ui'
import { itemsApi } from '@/shared/api/itemsApi'
import { useSuggestStore } from '@/stores/suggest'
import { featureItemIds, inventoryEntries } from '@/features/character-editor/lib/characterMagicItems'
import { armorBaseId } from '@/features/character-editor/lib/magicArmor'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'
import { participantDefenses } from '../lib/participantDefenses'
const props = defineProps({ participant: { type: Object, required: true } })
const items = shallowRef(new Map()), loading = ref(true), error = ref(''), suggest = useSuggestStore()
const values = computed(() => props.participant.data?.values || {})
const stats = computed(() => participantDefenses(values.value, items.value, type => suggest.items(type), props.participant.sourceVersion || '2014'))
const indicators = computed(() => [
  { key: 'ac', label: 'Класс доспеха', value: stats.value.armorClass, icon: Shield, description: 'Защита от попадания атакой. Учитывает экипированные доспехи, щит и настроенные бонусы.' },
  ...stats.value.passives.map(skill => ({ ...skill, key: skill.id, icon: skill.id === '10' ? Eye : Search,
    description: `${skill.id === '10' ? 'Мудрость (Внимательность): заметить скрытое или опасность.' : 'Интеллект (Расследование): найти подсказки и сделать выводы.'}<br>${skill.description}` })),
])
const tooltip = shallowRef(null)
function showTooltip(event, indicator) { tooltip.value = { ...indicator, anchor: event.currentTarget } }

watch(() => props.participant.data, async (_, __, onCleanup) => {
  let cancelled = false
  onCleanup(() => { cancelled = true })
  loading.value = true; error.value = ''
  try {
    const loaded = new Map()
    const ids = [...new Set([...featureItemIds(values.value), ...(values.value.states || []).map(state => state.effect_id)].filter(Boolean))]
    const load = async ids => {
      for (let i = 0; i < ids.length; i += 100) {
        const result = await itemsApi.byIds(ids.slice(i, i + 100))
        for (const item of result.items || []) loaded.set(String(item.id), item)
      }
    }
    await suggest.ensure(3)
    await load(ids)
    const bases = inventoryEntries(values.value).map(({ entry }) => armorBaseId(loaded.get(String(entry.magic_item_id ?? entry.item_id)), entry)).filter(id => id && !loaded.has(String(id)))
    await load([...new Set(bases)])
    if (!cancelled) items.value = loaded
  } catch (cause) { if (!cancelled) error.value = cause.message || 'Не удалось рассчитать показатели.' }
  finally { if (!cancelled) loading.value = false }
}, { immediate: true })
</script>
<style scoped>
.participant-stats { display: flex; align-items: center; min-height: 18px; line-height: 18px; }
.participant-stat { display: inline-flex; flex: 1; align-items: center; justify-content: center; gap: 4px; padding: 0 6px; color: var(--text-2); cursor: help; }
.participant-stat + .participant-stat { border-left: 1px solid var(--border); }
.participant-stat:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: var(--r-sm); }
.participant-stat svg { flex-shrink: 0; color: var(--info); }
.participant-stat strong { color: var(--text-1); font-size: 13px; font-variant-numeric: tabular-nums; }
.participant-stats p { margin: 0; overflow: hidden; color: var(--danger); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
</style>
