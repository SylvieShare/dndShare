<template>
  <RowActionMenu block :title="`Действия: ${title}`">
    <template #trigger="{ open }">
      <BaseTile
        class="pac-card action-menu-source"
        :class="{ 'action-menu-source--open': open }"
      >
        <span class="pac-icon" aria-hidden="true">
          <component :is="icon" :size="25" :stroke-width="1.7" />
        </span>
        <span class="pac-copy">
          <strong>{{ title }}</strong>
          <small>{{ subtitle }}</small>
        </span>
        <span class="pac-metrics">
          <span class="pac-attack"><small>Атака</small>{{ attack }}</span>
          <span class="pac-damage">{{ damageLabel }}</span>
        </span>
      </BaseTile>
    </template>

    <template #default="{ close }">
      <RowActionItem action="attack" @click="run(close, 'attack')">Бросок на атаку</RowActionItem>
      <RowActionItem action="damage" @click="run(close, 'damage')">Бросок на урон</RowActionItem>
      <RowActionItem action="critical" tone="warning" @click="run(close, 'critical')">Бросок на критический урон</RowActionItem>
    </template>
  </RowActionMenu>
</template>

<script setup>
import { BaseTile, RowActionMenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  attack: { type: String, required: true },
  damageLabel: { type: String, required: true },
  icon: { type: [Object, Function], required: true },
})

const emit = defineEmits(['attack', 'damage', 'critical'])

function run(close, action) {
  close()
  emit(action)
}
</script>

<style scoped>
.pac-card {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 78px;
  padding: 12px;
  cursor: pointer;
}

.pac-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid color-mix(in srgb, var(--accent-soft) 30%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent-soft);
}

.pac-copy { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.pac-copy strong { overflow: hidden; color: var(--text-1); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.pac-copy small { color: var(--text-muted); font-size: 10px; line-height: 1.25; }
.pac-metrics { display: flex; align-items: center; gap: 8px; }
.pac-attack { display: inline-flex; flex-direction: column; align-items: center; min-width: 42px; padding: 5px 8px; border: 1px solid color-mix(in srgb, var(--accent-soft) 28%, transparent); border-radius: 8px; color: var(--text-1); font-size: 14px; font-weight: 800; }
.pac-attack small { color: var(--accent-soft); font-size: 8px; letter-spacing: .05em; text-transform: uppercase; }
.pac-damage { color: var(--text-2); font-size: 12px; font-weight: 800; white-space: nowrap; }

@media (max-width: 620px) {
  .pac-card { grid-template-columns: 38px minmax(0, 1fr); }
  .pac-icon { width: 36px; height: 36px; }
  .pac-metrics { grid-column: 1 / -1; justify-content: space-between; }
}
</style>
