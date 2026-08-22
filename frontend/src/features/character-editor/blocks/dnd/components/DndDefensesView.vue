<template>
  <div class="ddv" :class="{ 'ddv--panel': panel }">
    <SheetBlockTitle
      title="Защиты"
      :show-edit="manage"
      :edit-fade="editFade"
      @edit="$emit('manage')"
    />

    <div v-if="displayRows.length" class="ddv-list">
      <div v-for="row in displayRows" :key="row.key" class="ddv-row" :class="`ddv-row--${row.kind}`">
        <span class="ddv-kind">{{ kindLabel(row.kind) }}</span>
        <strong>{{ damageTypeLabel(row.damage_type) }}</strong>
      </div>
    </div>
    <span v-else class="ddv-empty">нет</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SheetBlockTitle from '@/shared/ui/SheetBlockTitle'
import { DEFENSE_KINDS } from '@/features/character-editor/lib/characterDefenses'

const props = defineProps({
  defenses: { type: Array, default: () => [] },
  damageTypes: { type: Array, default: () => [] },
  manage: { type: Boolean, default: false },
  editFade: { type: Boolean, default: false },
  panel: { type: Boolean, default: false },
})

defineEmits(['manage'])

const displayRows = computed(() => {
  const seen = new Set()
  return props.defenses.filter((row) => {
    const key = `${row.kind}:${row.damage_type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})

function kindLabel(kind) {
  return DEFENSE_KINDS.find((entry) => entry.value === kind)?.label || 'Сопротивление'
}

function damageTypeLabel(id) {
  return props.damageTypes.find((entry) => String(entry.id) === String(id))?.value || `Тип #${id}`
}
</script>

<style scoped>
.ddv { display: flex; min-width: 0; flex-direction: column; gap: 9px; padding: 9px 10px 10px; box-sizing: border-box; }
.ddv--panel { padding-right: 14px; }
.ddv-list { display: flex; flex-direction: column; gap: 7px; }
.ddv-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 9px; padding: 8px 9px; border: 1px solid var(--border); border-left-width: 3px; border-radius: 8px; background: var(--surface-raised); }
.ddv-row--resistance { border-left-color: var(--info); }
.ddv-row--immunity { border-left-color: var(--success); }
.ddv-row--vulnerability { border-left-color: var(--danger); }
.ddv-kind { color: var(--text-muted); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.ddv-row strong { color: var(--text-1); font-size: 12px; text-align: right; }
.ddv-empty { color: var(--text-muted); font-size: 12px; }
</style>
