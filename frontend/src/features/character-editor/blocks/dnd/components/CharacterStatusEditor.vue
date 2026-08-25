<template>
  <EditorPanel compact>
    <EditorSection title="Активные эффекты">
      <div v-if="statuses.length" class="cse-list">
        <div v-for="status in statuses" :key="status.uid" class="cse-row" :class="`cse-row--${status.polarity}`">
          <span class="cse-mark" :style="{ '--c': status.color }">
            <ItemIcon
              v-if="status.item?.iconImageUrl || status.item?.svg"
              :item="status.item"
              :fallback-to-type="false"
              :size="24"
            />
          </span>
          <span class="cse-copy">
            <strong>{{ status.title }}</strong>
            <small>{{ meta(status) }}</small>
          </span>
          <RemoveButton label="Убрать эффект" @click="$emit('remove', status.uid)" />
        </div>
      </div>
      <div v-else class="cse-empty">Активных эффектов нет</div>
      <AddButton block @click="$emit('add')">Добавить эффект</AddButton>
    </EditorSection>
  </EditorPanel>
</template>

<script setup>
import { AddButton, EditorPanel, EditorSection, RemoveButton } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

defineProps({ statuses: { type: Array, default: () => [] } })
defineEmits(['add', 'remove'])

function meta(status) {
  const polarity = status.polarity === 'positive' ? 'Положительный' : status.polarity === 'negative' ? 'Отрицательный' : 'Нейтральный'
  const level = Number(status.item?.data?.level) > 0 ? ` · уровень ${Number(status.item.data.level)}` : ''
  const source = status.source?.label ? ` · ${status.source.label}` : status.source?.kind === 'manual' ? ' · добавлен вручную' : ''
  const concentration = status.concentration ? ' · концентрация' : ''
  const durations = { rounds: 'раунд.', minutes: 'мин.', hours: 'ч.', until_rest: 'до отдыха', permanent: 'постоянно' }
  const duration = status.duration?.kind && status.duration.kind !== 'manual'
    ? ` · ${status.duration.value ? `${status.duration.value} ` : ''}${durations[status.duration.kind] || status.duration.kind}`
    : ''
  return `${polarity}${level}${source}${duration}${concentration}`
}
</script>

<style scoped>
.cse-list { display: flex; flex-direction: column; gap: 7px; margin-bottom: 9px; }
.cse-row { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 9px; align-items: center; padding: 8px 9px; border: 1px solid var(--border); border-left-width: 3px; border-radius: var(--r-sm); background: var(--surface-raised); }
.cse-row--positive { border-left-color: var(--success); }
.cse-row--negative { border-left-color: var(--danger); }
.cse-row--neutral { border-left-color: var(--info); }
.cse-mark { display: grid; width: 24px; height: 24px; place-items: center; color: var(--c); }
.cse-mark :deep(svg) { width: 22px; height: 22px; }
.cse-mark:empty::after { width: 10px; height: 10px; border-radius: 50%; background: var(--c); content: ''; }
.cse-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.cse-copy strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.cse-copy small { color: var(--text-muted); font-size: 9px; line-height: 1.3; }
.cse-empty { margin-bottom: 9px; color: var(--text-muted); font-size: 12px; }
</style>
