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
          <span class="pac-formula" title="Формула броска атаки">
            <small>Атака</small>
            <span class="pac-formula-row">
              <SystemDie :sides="20" :size="30" color="var(--accent-soft)" :animated="false" />
              <span v-if="Number(attackBonus) !== 0" class="pac-op">{{ Number(attackBonus) > 0 ? '+' : '−' }}</span>
              <b v-if="Number(attackBonus) !== 0">{{ Math.abs(Number(attackBonus)) }}</b>
            </span>
          </span>
          <span class="pac-formula pac-damage" title="Формула урона">
            <small>Урон</small>
            <DamageDice
              v-if="damageParts.length"
              :parts="damageParts"
              :modifier="damageModifier"
            />
            <span v-else class="pac-flat">
              <b>{{ flatDamage.base }}</b>
              <template v-if="flatDamage.modifier">
                <span class="pac-op">{{ flatDamage.modifier > 0 ? '+' : '−' }}</span>
                <b>{{ Math.abs(flatDamage.modifier) }}</b>
              </template>
              <span class="pac-op">=</span>
              <b class="pac-flat-total">{{ flatDamage.total }}</b>
            </span>
            <span v-if="damageType" class="pac-type">{{ damageType }}</span>
          </span>
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
import SystemDie from '@/shared/ui/SystemDie.vue'
import DamageDice from '@/features/character-editor/blocks/dnd/components/DamageDice.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  attackBonus: { type: Number, required: true },
  damageParts: { type: Array, default: () => [] },
  damageModifier: { type: Number, default: 0 },
  flatDamage: { type: Object, default: () => ({ base: 0, modifier: 0, total: 0 }) },
  damageType: { type: String, default: '' },
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
.pac-metrics { display: flex; align-items: stretch; gap: 8px; }
.pac-formula { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; min-width: 54px; padding: 5px 8px; border: 1px solid color-mix(in srgb, var(--accent-soft) 24%, transparent); border-radius: 9px; color: var(--text-1); }
.pac-formula > small { color: var(--accent-soft); font-size: 8px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
.pac-formula-row, .pac-flat { display: inline-flex; align-items: center; gap: 3px; min-height: 32px; font-size: 14px; font-weight: 800; white-space: nowrap; }
.pac-op { color: var(--text-muted); font-weight: 700; }
.pac-flat-total { color: var(--warning); }
.pac-damage { min-width: 76px; }
.pac-damage :deep(.system-die) { width: 32px !important; height: 32px !important; }
.pac-damage :deep(.dd-count), .pac-damage :deep(.dd-term) { font-size: 14px; }
.pac-type { margin-top: -2px; color: var(--warning); font-size: 8px; font-weight: 650; }

@media (max-width: 620px) {
  .pac-card { grid-template-columns: 38px minmax(0, 1fr); }
  .pac-icon { width: 36px; height: 36px; }
  .pac-metrics { grid-column: 1 / -1; justify-content: space-between; }
}
</style>
