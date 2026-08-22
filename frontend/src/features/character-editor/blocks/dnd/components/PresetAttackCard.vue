<template>
  <RowActionMenu block :title="`Действия: ${title}`">
    <template #trigger="{ open }">
      <BaseTile
        class="pac-card action-menu-source"
        :class="{ 'action-menu-source--open': open }"
      >
        <div class="pac-main">
          <ItemIcon
            class="pac-icon"
            :item="iconItem"
            :size="64"
            :fallback-to-type="false"
            :placeholder="!iconItem"
          />
          <div class="pac-view">
            <div class="pac-title">
              <strong>{{ title }}</strong>
              <small>{{ subtitle }}</small>
              <span v-if="proficient" class="pac-proficiency">Владение</span>
            </div>
            <AttackDamage
              :attack="formatBonus(attackBonus)"
              :damage-parts="damageParts"
              :modifier="damageModifier"
              :flat-damage="damageParts.length ? null : flatDamage.total"
              :flat-damage-type="damageType"
              :flat-damage-title="flatDamageTitle"
            />
          </div>
        </div>
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
import { computed } from 'vue'
import { BaseTile, RowActionMenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import AttackDamage from '@/features/character-editor/blocks/dnd/components/AttackDamage.vue'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  attackBonus: { type: Number, required: true },
  damageParts: { type: Array, default: () => [] },
  damageModifier: { type: Number, default: 0 },
  flatDamage: { type: Object, default: () => ({ base: 0, modifier: 0, total: 0 }) },
  damageType: { type: String, default: '' },
  iconItem: { type: Object, default: null },
  proficient: { type: Boolean, default: false },
})

const emit = defineEmits(['attack', 'damage', 'critical'])

function run(close, action) {
  close()
  emit(action)
}

function formatBonus(value) {
  const bonus = Number(value) || 0
  return bonus >= 0 ? `+${bonus}` : String(bonus)
}

function signed(value) {
  const number = Number(value) || 0
  if (number === 0) return ''
  return `${number > 0 ? '+' : '−'} ${Math.abs(number)}`
}

const flatDamageTitle = computed(() => (
  `${props.flatDamage.base} ${signed(props.flatDamage.modifier)} = ${props.flatDamage.total}`.replace(/\s+/g, ' ').trim()
))
</script>

<style scoped>
.pac-card {
  position: relative;
  box-sizing: border-box;
  padding-left: 16px;
  overflow: clip;
  cursor: pointer;
}
.pac-main { display: flex; align-items: stretch; min-width: 0; min-height: 86px; }
.pac-icon { display: flex; flex: 0 0 64px; align-self: center; align-items: center; justify-content: center; width: 64px; height: 64px; overflow: hidden; }
.pac-view {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  min-width: 0;
  padding: 14px 20px 14px 16px;
}
.pac-title { display: flex; min-width: 0; flex-direction: column; gap: 1px; }
.pac-title strong { overflow: hidden; color: var(--text-1); font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.pac-title small { overflow: hidden; color: var(--text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.pac-proficiency { color: var(--success); font-size: 10px; font-weight: 700; }

@media (max-width: 760px) {
  .pac-view { grid-template-columns: minmax(0, 1fr); align-items: start; gap: 10px; }
  .pac-title strong { font-size: 15px; }
  .pac-title small { white-space: normal; }
}
</style>
