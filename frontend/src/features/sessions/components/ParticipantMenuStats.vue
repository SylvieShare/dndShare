<template>
  <div class="participant-menu-stats" aria-label="Защита и пассивные навыки">
    <LoadingIndicator v-if="loading" label="Расчёт показателей" />
    <p v-else-if="error" role="alert">{{ error }}</p>
    <template v-else>
      <div class="participant-menu-stat"><Shield :size="18" /><span>Класс доспеха</span><strong>{{ stats.armorClass }}</strong></div>
      <div v-for="skill in stats.passives" :key="skill.id" class="participant-menu-stat" :title="skill.description">
        <component :is="skill.id === '10' ? Eye : Search" :size="18" /><span>{{ skill.label }}</span><strong>{{ skill.value }}</strong>
      </div>
    </template>
  </div>
</template>
<script setup>
import { computed, ref, shallowRef, watch } from 'vue'
import { Eye, Search, Shield } from '@lucide/vue'
import { LoadingIndicator } from '@sylvieshare/share-ui'
import { itemsApi } from '@/shared/api/itemsApi'
import { useSuggestStore } from '@/stores/suggest'
import { featureItemIds, inventoryEntries } from '@/features/character-editor/lib/characterMagicItems'
import { armorBaseId } from '@/features/character-editor/lib/magicArmor'
import { participantDefenses } from '../lib/participantDefenses'
const props = defineProps({ participant: { type: Object, required: true } })
const items = shallowRef(new Map()), loading = ref(true), error = ref(''), suggest = useSuggestStore()
const values = computed(() => props.participant.data?.values || {})
const stats = computed(() => participantDefenses(values.value, items.value, type => suggest.items(type)))
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
.participant-menu-stats { display: grid; gap: 10px; padding: 8px 10px 12px; margin-bottom: 6px; border-bottom: 1px solid var(--border); min-width: 240px; }
.participant-menu-stat { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); }
.participant-menu-stat svg { flex-shrink: 0; color: var(--info); }
.participant-menu-stat strong { margin-left: auto; color: var(--text-1); font-size: 16px; font-variant-numeric: tabular-nums; }
.participant-menu-stats p { margin: 0; color: var(--danger); font-size: 12px; }
</style>
